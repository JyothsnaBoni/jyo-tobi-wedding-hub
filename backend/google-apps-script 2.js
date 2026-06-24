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

  const uploadId = "UPLOAD-" + Date.now();
  const now = new Date();

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
    DriveFileId: file.getId(),
    DriveLink: file.getUrl(),
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

  upsertRow("GalleryUploads", { UploadId: uploadId }, {
    ...upload,
    Approved: approved
  });

  if (String(approved).toLowerCase() === "yes") {
    const galleryId = "GAL-" + uploadId;

    upsertRow("Gallery", { GalleryId: galleryId }, {
      GalleryId: galleryId,
      Category: upload.Event || "Guest Uploads",
      Title: upload.Event || "Wedding Memory",
      Caption: upload.Caption || "",
      ImageUrl: isImage(upload.MimeType) ? upload.DriveLink : "",
      VideoUrl: isVideo(upload.MimeType) ? upload.DriveLink : "",
      UploadedBy: upload.GuestName || "",
      InvitationCode: upload.InvitationCode || "",
      Approved: "Yes",
      Featured: "No",
      SortOrder: 999
    });
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


function isImage(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

function isVideo(mimeType) {
  return String(mimeType || "").startsWith("video/");
}