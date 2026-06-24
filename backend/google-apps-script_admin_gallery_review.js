const SPREADSHEET_ID = "1jho1KL65q0pvjQ3QBMYusCIoNDH1-GQhL1ovkUp9eN8";
const DEFAULT_UPLOAD_FOLDER_ID = ""; // Optional fallback. Prefer Settings → GalleryUploadFolderId.

const PUBLIC_TABS = [
  "OutfitCatalog",
  "Family",
  "WeddingParty",
  "IndiaContacts",
  "Gallery"
];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;

    if (!action) {
      return jsonResponse({ success: false, error: "Missing action" });
    }

    switch (action) {
      case "login":
        return jsonResponse(login(payload));

      case "getGuestData":
        return jsonResponse(getGuestData(payload));

      case "saveRSVP":
        return jsonResponse(saveRSVP(payload));

      case "saveTravel":
        return jsonResponse(saveTravel(payload));

      case "saveAccommodation":
        return jsonResponse(saveByInvitationCode("Accommodation", payload));

      case "saveOutfit":
        return jsonResponse(saveOutfit(payload));

      case "saveGuestDirectory":
        return jsonResponse(saveByInvitationCode("GuestDirectory", payload));

      case "getPublicContent":
        return jsonResponse(getPublicContent());

      case "getGuestDirectory":
        return jsonResponse(getGuestDirectory(payload));

      case "uploadMedia":
        return jsonResponse(uploadMedia(payload));

      case "adminSaveRow":
        return jsonResponse(adminSaveRow(payload));

      case "adminDeleteRow":
        return jsonResponse(adminDeleteRow(payload));

      case "adminApproveGallery":
        return jsonResponse(adminApproveGallery(payload));

      case "adminSyncGuestDirectory":
        return jsonResponse(adminSyncGuestDirectory(payload));

      case "syncApprovedGalleryUploads":
        return jsonResponse(syncApprovedGalleryUploadsToGallery());

      case "getGalleryUploads":
        return jsonResponse(getGalleryUploadsForAdmin(payload));

      case "adminDeleteGalleryUpload":
        return jsonResponse(adminDeleteGalleryUpload(payload));

      default:
        return jsonResponse({ success: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return e && e.parameter ? e.parameter : {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return e.parameter || {};
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet(name) {
  const s = ss().getSheetByName(name);
  if (!s) throw new Error("Missing sheet: " + name);
  return s;
}


function normalizeInvitationCode(value) {
  return String(value || "").trim().toUpperCase();
}

function isYes(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function firstNonEmpty() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function formatColumnAsPlainTextIfExists(sheetName, columnName) {
  const s = sheet(sheetName);
  const headers = getHeaders(sheetName);
  const index = headers.indexOf(columnName);

  if (index === -1) return;

  const maxRows = Math.max(s.getMaxRows() - 1, 1);
  s.getRange(2, index + 1, maxRows, 1).setNumberFormat("@");
}

function protectTextValue(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}


function getHeaders(sheetName) {
  const s = sheet(sheetName);
  return s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
}

function getRows(sheetName) {
  const s = sheet(sheetName);
  const values = s.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];

  return values.slice(1)
    .filter(row => row.some(cell => cell !== ""))
    .map((row, index) => {
      const obj = { _rowNumber: index + 2 };
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

function findRowBy(sheetName, columnName, value) {
  const rows = getRows(sheetName);
  return rows.find(row => String(row[columnName]).trim() === String(value).trim()) || null;
}

function findRowByMultiple(sheetName, conditions) {
  const rows = getRows(sheetName);

  return rows.find(row => {
    return Object.entries(conditions).every(([key, value]) => {
      return String(row[key]).trim() === String(value).trim();
    });
  }) || null;
}

function upsertRow(sheetName, lookupConditions, data) {
  const s = sheet(sheetName);
  const headers = getHeaders(sheetName);
  const now = new Date();

  const existing = findRowByMultiple(sheetName, lookupConditions);

  const cleanData = {
    ...data,
    LastUpdated: now
  };

  if (!existing) {
    cleanData.Timestamp = now;
  }

  const rowValues = headers.map(header => {
    let value = "";

    if (Object.prototype.hasOwnProperty.call(cleanData, header)) {
      value = cleanData[header];
    } else if (existing && Object.prototype.hasOwnProperty.call(existing, header)) {
      value = existing[header];
    }

    if (header === "InvitationCode") {
      return normalizeInvitationCode(value);
    }

    if (["PostalCode", "ZipCode", "PostCode"].indexOf(header) !== -1) {
      return protectTextValue(value);
    }

    return value;
  });

  if (existing) {
    s.getRange(existing._rowNumber, 1, 1, headers.length).setValues([rowValues]);
    return {
      success: true,
      mode: "updated",
      sheet: sheetName,
      rowNumber: existing._rowNumber
    };
  }

  s.appendRow(rowValues);
  return {
    success: true,
    mode: "created",
    sheet: sheetName
  };
}

function sanitizePayload(payload) {
  const copy = { ...payload };
  delete copy.action;
  delete copy.isAdmin;
  delete copy.adminCode;
  delete copy.fileBase64;
  delete copy.fileData;
  return copy;
}

function validateGuest(invitationCode) {
  invitationCode = normalizeInvitationCode(invitationCode);
  if (!invitationCode) throw new Error("Missing invitation code");

  const guest = findRowBy("Guests", "InvitationCode", invitationCode);

  if (!guest) {
    return { valid: false, error: "Invalid invitation code" };
  }

  if (String(guest.Status).toLowerCase() !== "active") {
    return { valid: false, error: "Invitation code is not active" };
  }

  return {
    valid: true,
    guest,
    isAdmin: String(guest.IsAdmin).toLowerCase() === "yes" || String(guest.Role).toLowerCase() === "admin"
  };
}

function login(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    invitationCode: code,
    isAdmin: result.isAdmin,
    guest: {
      InvitationCode: result.guest.InvitationCode,
      GuestName: result.guest.GuestName,
      Email: result.guest.Email,
      Phone: result.guest.Phone,
      GuestGroup: result.guest.GuestGroup,
      AllowedGuests: result.guest.AllowedGuests,
      Role: result.guest.Role,
      IsAdmin: result.guest.IsAdmin
    },
    data: getGuestSavedData(code),
    publicContent: getPublicContent().data
  };
}

function getGuestData(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    isAdmin: result.isAdmin,
    guest: result.guest,
    data: getGuestSavedData(code),
    publicContent: getPublicContent().data
  };
}

function getGuestSavedData(code) {
  return {
    RSVP: findRowBy("RSVP", "InvitationCode", code),
    Travel: findRowBy("Travel", "InvitationCode", code),
    Accommodation: findRowBy("Accommodation", "InvitationCode", code),
    Outfits: getRows("Outfits").filter(row => String(row.InvitationCode).trim() === code),
    GuestDirectory: findRowBy("GuestDirectory", "InvitationCode", code)
  };
}

function saveByInvitationCode(sheetName, payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const data = sanitizePayload(payload);
  data.InvitationCode = code;

  return upsertRow(sheetName, { InvitationCode: code }, data);
}


function saveRSVP(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = saveByInvitationCode("RSVP", payload);

  if (!result.success) {
    return result;
  }

  syncGuestDirectoryFromRSVPPayload({
    ...payload,
    InvitationCode: code
  });

  return result;
}

function saveTravel(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = saveByInvitationCode("Travel", payload);

  if (!result.success) {
    return result;
  }

  syncGuestDirectoryFromTravelPayload({
    ...payload,
    InvitationCode: code
  });

  return result;
}

function syncGuestDirectoryFromRSVPPayload(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  if (!code) return { success: false, error: "Missing invitation code for directory sync" };

  const allowDirectory = isYes(payload.AllowGuestDirectory);
  const allowContact = isYes(payload.AllowContactSharing);

  const existingDirectory = findRowBy("GuestDirectory", "InvitationCode", code) || {};
  const guest = findRowBy("Guests", "InvitationCode", code) || {};

  const displayName = firstNonEmpty(
    existingDirectory.DisplayName,
    payload.FullName,
    guest.GuestName
  );

  return upsertRow("GuestDirectory", { InvitationCode: code }, {
    InvitationCode: code,
    DisplayName: displayName,
    City: firstNonEmpty(existingDirectory.City, payload.City),
    Country: firstNonEmpty(existingDirectory.Country, payload.Country),
    GuestGroup: firstNonEmpty(existingDirectory.GuestGroup, guest.GuestGroup),
    AttendingEvents: firstNonEmpty(payload.Attendance, existingDirectory.AttendingEvents),
    TravelDates: existingDirectory.TravelDates || "",
    CitiesVisiting: existingDirectory.CitiesVisiting || "",
    ShowInDirectory: allowDirectory ? "Yes" : "No",
    ShareWhatsApp: allowContact ? "Yes" : "No",
    ShareEmail: allowContact ? "Yes" : "No",
    WhatsApp: allowContact ? firstNonEmpty(existingDirectory.WhatsApp, payload.Phone, guest.Phone) : "",
    Email: allowContact ? firstNonEmpty(existingDirectory.Email, payload.Email, guest.Email) : "",
    Notes: existingDirectory.Notes || ""
  });
}

function syncGuestDirectoryFromTravelPayload(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  if (!code) return { success: false, error: "Missing invitation code for travel directory sync" };

  const existingDirectory = findRowBy("GuestDirectory", "InvitationCode", code) || {};
  const guest = findRowBy("Guests", "InvitationCode", code) || {};

  const travelConsent = isYes(payload.TravelPrivacyConsent);
  const existingShow = isYes(existingDirectory.ShowInDirectory);

  const travelDates = [
    payload.ArrivalDate ? "Arrives " + payload.ArrivalDate : "",
    payload.DepartureDate ? "Leaves " + payload.DepartureDate : ""
  ].filter(Boolean).join(" · ");

  return upsertRow("GuestDirectory", { InvitationCode: code }, {
    InvitationCode: code,
    DisplayName: firstNonEmpty(existingDirectory.DisplayName, payload.FullName, guest.GuestName),
    City: firstNonEmpty(existingDirectory.City, payload.TravellingFrom),
    Country: existingDirectory.Country || "",
    GuestGroup: firstNonEmpty(existingDirectory.GuestGroup, guest.GuestGroup),
    AttendingEvents: existingDirectory.AttendingEvents || "",
    TravelDates: firstNonEmpty(existingDirectory.TravelDates, travelDates),
    CitiesVisiting: firstNonEmpty(existingDirectory.CitiesVisiting, payload.CitiesVisitingBeforeWedding),
    ShowInDirectory: travelConsent || existingShow ? "Yes" : (existingDirectory.ShowInDirectory || "No"),
    ShareWhatsApp: existingDirectory.ShareWhatsApp || "No",
    ShareEmail: existingDirectory.ShareEmail || "No",
    WhatsApp: firstNonEmpty(existingDirectory.WhatsApp, payload.Phone, guest.Phone),
    Email: firstNonEmpty(existingDirectory.Email, payload.Email, guest.Email),
    Notes: existingDirectory.Notes || ""
  });
}


function saveOutfit(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const event = String(payload.Event || "").trim();

  if (!event) {
    return { success: false, error: "Missing outfit event" };
  }

  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const data = sanitizePayload(payload);
  data.InvitationCode = code;

  return upsertRow("Outfits", {
    InvitationCode: code,
    Event: event
  }, data);
}

function getPublicContent() {
  const data = {};

  PUBLIC_TABS.forEach(tab => {
    let rows = getRows(tab);

    rows = rows.filter(row => {
      if (Object.prototype.hasOwnProperty.call(row, "Visible")) {
        return String(row.Visible).toLowerCase() !== "no";
      }

      if (Object.prototype.hasOwnProperty.call(row, "Available")) {
        return String(row.Available).toLowerCase() !== "no";
      }

      if (tab === "Gallery") {
        return String(row.Approved).toLowerCase() === "yes";
      }

      return true;
    });

    rows.sort((a, b) => Number(a.SortOrder || 999) - Number(b.SortOrder || 999));
    data[tab] = rows;
  });

  return { success: true, data };
}

function getGuestDirectory(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const rows = getRows("GuestDirectory")
    .filter(row => String(row.ShowInDirectory).toLowerCase() === "yes")
    .map(row => ({
      DisplayName: row.DisplayName,
      City: row.City,
      Country: row.Country,
      GuestGroup: row.GuestGroup,
      AttendingEvents: row.AttendingEvents,
      TravelDates: row.TravelDates,
      CitiesVisiting: row.CitiesVisiting,
      WhatsApp: String(row.ShareWhatsApp).toLowerCase() === "yes" ? row.WhatsApp : "",
      Email: String(row.ShareEmail).toLowerCase() === "yes" ? row.Email : ""
    }));

  return {
    success: true,
    data: rows
  };
}

function uploadMedia(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const fileBase64 = payload.fileBase64 || payload.fileData;
  const fileName = payload.FileName || payload.fileName || "wedding-upload";
  const mimeType = payload.MimeType || payload.mimeType || "application/octet-stream";

  if (!fileBase64) {
    return { success: false, error: "Missing file data" };
  }

  const folderId = getSetting("GalleryUploadFolderId") || DEFAULT_UPLOAD_FOLDER_ID;

  if (!folderId) {
    return { success: false, error: "Missing GalleryUploadFolderId in Settings tab" };
  }

  const folder = DriveApp.getFolderById(folderId);
  const bytes = Utilities.base64Decode(fileBase64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);

  // Required for GitHub Pages: otherwise Drive saves the file, but the website shows a broken image.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const uploadId = "UPLOAD-" + Date.now();
  const now = new Date();
  const fileId = file.getId();

  upsertRow("GalleryUploads", { UploadId: uploadId }, {
    Timestamp: now,
    UploadId: uploadId,
    InvitationCode: code,
    GuestName: payload.GuestName || result.guest.GuestName,
    Email: payload.Email || result.guest.Email,
    Event: payload.Event || "Guest Uploads",
    Caption: payload.Caption || "",
    FileName: fileName,
    MimeType: mimeType,
    DriveFileId: fileId,
    DriveLink: file.getUrl(),
    DirectFileUrl: getDriveDisplayUrl(fileId, mimeType),
    Approved: "No",
    LastUpdated: now
  });

  return {
    success: true,
    uploadId,
    driveLink: file.getUrl(),
    message: "Upload saved for admin approval"
  };
}


function getDriveThumbnailUrl(fileId) {
  return fileId ? "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600" : "";
}

function getDriveDirectUrl(fileId) {
  return fileId ? "https://drive.google.com/uc?export=view&id=" + fileId : "";
}

function getDriveDisplayUrl(fileId, mimeType) {
  if (!fileId) return "";
  return isImage(mimeType) ? getDriveThumbnailUrl(fileId) : getDriveDirectUrl(fileId);
}

function getDriveFileIdFromUrl(url) {
  const text = String(url || "");
  let match = text.match(/[?&]id=([^&]+)/);
  if (match) return match[1];
  match = text.match(/\/d\/([^/]+)/);
  if (match) return match[1];
  return "";
}

/**
 * Run this manually once from the Apps Script editor to copy existing RSVP rows
 * into GuestDirectory. It uses InvitationCode as the primary key and updates
 * existing GuestDirectory rows instead of creating duplicates.
 */
function syncExistingRSVPsToGuestDirectory() {
  formatColumnAsPlainTextIfExists("RSVP", "PostalCode");
  formatColumnAsPlainTextIfExists("GuestDirectory", "InvitationCode");

  const rsvpRows = getRows("RSVP");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  rsvpRows.forEach(row => {
    const code = normalizeInvitationCode(row.InvitationCode);

    if (!code) {
      skipped++;
      return;
    }

    const result = syncGuestDirectoryFromRSVPPayload({
      ...row,
      InvitationCode: code
    });

    if (result && result.mode === "created") created++;
    else if (result && result.mode === "updated") updated++;
    else skipped++;
  });

  return {
    success: true,
    source: "RSVP",
    processed: rsvpRows.length,
    created,
    updated,
    skipped
  };
}

/**
 * Optional: run this after syncExistingRSVPsToGuestDirectory() if you also want
 * already-saved travel dates/cities to appear in GuestDirectory.
 */
function syncExistingTravelToGuestDirectory() {
  const travelRows = getRows("Travel");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  travelRows.forEach(row => {
    const code = normalizeInvitationCode(row.InvitationCode);

    if (!code) {
      skipped++;
      return;
    }

    const result = syncGuestDirectoryFromTravelPayload({
      ...row,
      InvitationCode: code
    });

    if (result && result.mode === "created") created++;
    else if (result && result.mode === "updated") updated++;
    else skipped++;
  });

  return {
    success: true,
    source: "Travel",
    processed: travelRows.length,
    created,
    updated,
    skipped
  };
}

/**
 * Recommended one-time run:
 * 1. Select this function in Apps Script.
 * 2. Click Run.
 * 3. Check the execution log.
 */
function syncAllExistingGuestDirectoryData() {
  const rsvp = syncExistingRSVPsToGuestDirectory();
  const travel = syncExistingTravelToGuestDirectory();

  return {
    success: true,
    rsvp,
    travel
  };
}

/**
 * Optional admin endpoint if you want to trigger sync from the website later.
 */
function adminSyncGuestDirectory(payload) {
  requireAdmin(payload);
  return syncAllExistingGuestDirectoryData();
}


function getSetting(key) {
  const row = findRowBy("Settings", "Key", key);
  return row ? row.Value : "";
}

function requireAdmin(payload) {
  const code = normalizeInvitationCode(payload.InvitationCode || payload.invitationCode || payload.adminCode || "");
  const result = validateGuest(code);

  if (!result.valid) {
    throw new Error(result.error);
  }

  if (!result.isAdmin) {
    throw new Error("Admin access required");
  }

  return result;
}

function adminSaveRow(payload) {
  requireAdmin(payload);

  const targetSheet = payload.targetSheet;
  const lookupColumn = payload.lookupColumn;
  const lookupValue = payload.lookupValue;
  const rowData = payload.rowData || {};

  if (!targetSheet || !lookupColumn || !lookupValue) {
    return { success: false, error: "Missing admin save parameters" };
  }

  return upsertRow(targetSheet, { [lookupColumn]: lookupValue }, rowData);
}

function adminDeleteRow(payload) {
  requireAdmin(payload);

  const targetSheet = payload.targetSheet;
  const lookupColumn = payload.lookupColumn;
  const lookupValue = payload.lookupValue;

  if (!targetSheet || !lookupColumn || !lookupValue) {
    return { success: false, error: "Missing admin delete parameters" };
  }

  const row = findRowBy(targetSheet, lookupColumn, lookupValue);

  if (!row) {
    return { success: false, error: "Row not found" };
  }

  sheet(targetSheet).deleteRow(row._rowNumber);

  return {
    success: true,
    deleted: true,
    sheet: targetSheet
  };
}


function buildGalleryRowFromUpload(upload) {
  const uploadId = upload.UploadId || ("UPLOAD-" + Date.now());
  const galleryId = "GAL-" + uploadId;
  const mimeType = upload.MimeType || "";
  const fileId = upload.DriveFileId || getDriveFileIdFromUrl(upload.DirectFileUrl || upload.DriveLink || "");
  const driveLink = upload.DriveLink || (fileId ? "https://drive.google.com/file/d/" + fileId + "/view" : "");
  const usableUrl = fileId ? getDriveDisplayUrl(fileId, mimeType) : (upload.DirectFileUrl || driveLink);

  return {
    Timestamp: upload.Timestamp || new Date(),
    Title: upload.Event || "Wedding Memory",
    Category: upload.Event || "Guest Uploads",
    ImageURL: isImage(mimeType) ? usableUrl : "",
    Caption: upload.Caption || "",
    Visible: "Yes",
    GalleryId: galleryId,
    ImageUrl: isImage(mimeType) ? usableUrl : "",
    VideoUrl: isVideo(mimeType) ? usableUrl : "",
    UploadedBy: upload.GuestName || "",
    InvitationCode: upload.InvitationCode || "",
    Approved: "Yes",
    Featured: "No",
    SortOrder: 999,
    LastUpdated: new Date(),
    DriveLink: driveLink,
    DriveFileId: fileId,
    DirectFileUrl: usableUrl
  };
}

/**
 * Run this manually after changing GalleryUploads.Approved to Yes.
 * It copies approved rows from GalleryUploads into the public Gallery sheet.
 */
function syncApprovedGalleryUploadsToGallery() {
  const uploads = getRows("GalleryUploads");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  uploads.forEach(upload => {
    const approved = String(upload.Approved || "").trim().toLowerCase() === "yes";
    if (!approved) {
      skipped++;
      return;
    }

    const galleryRow = buildGalleryRowFromUpload(upload);
    const result = upsertRow("Gallery", { GalleryId: galleryRow.GalleryId }, galleryRow);

    if (result.mode === "created") created++;
    else if (result.mode === "updated") updated++;
  });

  return {
    success: true,
    processed: uploads.length,
    created,
    updated,
    skipped,
    message: "Approved GalleryUploads rows have been copied to Gallery."
  };
}


function getGalleryUploadsForAdmin(payload) {
  requireAdmin(payload);

  const uploads = getRows("GalleryUploads").map(row => {
    const fileId = row.DriveFileId || getDriveFileIdFromUrl(row.DirectFileUrl || row.DriveLink || "");
    const mimeType = row.MimeType || "";
    return {
      ...row,
      DriveFileId: fileId,
      DirectFileUrl: row.DirectFileUrl || getDriveDisplayUrl(fileId, mimeType),
      DownloadUrl: fileId ? "https://drive.google.com/uc?export=download&id=" + fileId : (row.DriveLink || "")
    };
  });

  uploads.sort((a, b) => new Date(b.Timestamp || b.LastUpdated || 0) - new Date(a.Timestamp || a.LastUpdated || 0));

  return {
    success: true,
    data: uploads
  };
}

function deleteGalleryRowsForUpload(uploadId) {
  const galleryId = "GAL-" + uploadId;
  let deleted = 0;

  while (true) {
    const row = findRowBy("Gallery", "GalleryId", galleryId);
    if (!row) break;
    sheet("Gallery").deleteRow(row._rowNumber);
    deleted++;
  }

  return deleted;
}

function adminDeleteGalleryUpload(payload) {
  requireAdmin(payload);

  const uploadId = payload.UploadId || payload.uploadId;
  const deleteDriveFile = String(payload.deleteDriveFile || "true").toLowerCase() !== "false";

  if (!uploadId) {
    return { success: false, error: "Missing UploadId" };
  }

  const upload = findRowBy("GalleryUploads", "UploadId", uploadId);
  if (!upload) {
    // Still remove gallery row if it exists.
    const deletedGalleryRows = deleteGalleryRowsForUpload(uploadId);
    return { success: true, deletedUpload: false, deletedGalleryRows, deletedDriveFile: false };
  }

  let deletedDriveFile = false;
  const fileId = upload.DriveFileId || getDriveFileIdFromUrl(upload.DirectFileUrl || upload.DriveLink || "");

  if (deleteDriveFile && fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      deletedDriveFile = true;
    } catch (err) {
      // Keep going: sheet cleanup is still useful even if Drive file is already missing.
    }
  }

  const deletedGalleryRows = deleteGalleryRowsForUpload(uploadId);
  sheet("GalleryUploads").deleteRow(upload._rowNumber);

  return {
    success: true,
    deletedUpload: true,
    deletedGalleryRows,
    deletedDriveFile
  };
}

function adminApproveGallery(payload) {
  requireAdmin(payload);

  const uploadId = payload.UploadId || payload.uploadId;
  const approved = payload.Approved || payload.approved || "Yes";

  if (!uploadId) {
    return { success: false, error: "Missing UploadId" };
  }

  const upload = findRowBy("GalleryUploads", "UploadId", uploadId);

  if (!upload) {
    return { success: false, error: "Upload not found" };
  }

  const updatedUpload = {
    ...upload,
    Approved: approved
  };

  upsertRow("GalleryUploads", { UploadId: uploadId }, updatedUpload);

  if (String(approved).toLowerCase() === "yes") {
    const galleryId = "GAL-" + uploadId;
    upsertRow("Gallery", { GalleryId: galleryId }, buildGalleryRowFromUpload(updatedUpload));
  } else {
    deleteGalleryRowsForUpload(uploadId);
  }

  return {
    success: true,
    approved
  };
}


/**
 * Optional safety setup. Run this if you want to make sure important guest-data
 * sheets contain InvitationCode and postal codes are treated as text.
 */
function repairGuestPrimaryKeysAndTextColumns() {
  const sheetsWithInvitationCode = [
    "RSVP",
    "Travel",
    "Accommodation",
    "Outfits",
    "GuestDirectory",
    "GalleryUploads",
    "Gallery"
  ];

  sheetsWithInvitationCode.forEach(sheetName => {
    const s = sheet(sheetName);
    const headers = getHeaders(sheetName);

    if (headers.indexOf("InvitationCode") === -1) {
      s.insertColumnAfter(1);
      s.getRange(1, 2).setValue("InvitationCode");
    }

    formatColumnAsPlainTextIfExists(sheetName, "InvitationCode");
  });

  formatColumnAsPlainTextIfExists("RSVP", "PostalCode");
  formatColumnAsPlainTextIfExists("RSVP", "ZipCode");
  formatColumnAsPlainTextIfExists("RSVP", "PostCode");

  return {
    success: true,
    message: "Guest primary-key columns checked and text columns formatted."
  };
}


/**
 * Run this once after this update. It fixes already-uploaded Drive files:
 * - makes them viewable by anyone with the link
 * - rewrites DirectFileUrl/ImageUrl/ImageURL to an embeddable thumbnail URL
 * - copies approved uploads into Gallery again
 */
function repairExistingGalleryDriveLinksAndSharing() {
  const uploads = getRows("GalleryUploads");
  let repaired = 0;
  let failed = 0;

  uploads.forEach(upload => {
    const fileId = upload.DriveFileId || getDriveFileIdFromUrl(upload.DirectFileUrl || upload.DriveLink || "");
    if (!fileId) return;

    try {
      const file = DriveApp.getFileById(fileId);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      upsertRow("GalleryUploads", { UploadId: upload.UploadId }, {
        ...upload,
        DriveFileId: fileId,
        DriveLink: upload.DriveLink || file.getUrl(),
        DirectFileUrl: getDriveDisplayUrl(fileId, upload.MimeType || file.getMimeType())
      });

      repaired++;
    } catch (err) {
      failed++;
    }
  });

  const sync = syncApprovedGalleryUploadsToGallery();

  return {
    success: true,
    repaired,
    failed,
    sync
  };
}


function isImage(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

function isVideo(mimeType) {
  return String(mimeType || "").startsWith("video/");
}