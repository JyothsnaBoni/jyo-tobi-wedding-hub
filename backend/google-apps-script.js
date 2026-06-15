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
        return jsonResponse(saveByInvitationCode("RSVP", payload));

      case "saveTravel":
        return jsonResponse(saveByInvitationCode("Travel", payload));

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
    if (Object.prototype.hasOwnProperty.call(cleanData, header)) {
      return cleanData[header];
    }

    if (existing && Object.prototype.hasOwnProperty.call(existing, header)) {
      return existing[header];
    }

    return "";
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
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
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
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
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
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
  const result = validateGuest(code);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const data = sanitizePayload(payload);
  data.InvitationCode = code;

  return upsertRow(sheetName, { InvitationCode: code }, data);
}

function saveOutfit(payload) {
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
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
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
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
  const code = String(payload.InvitationCode || payload.invitationCode || "").trim();
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

function getSetting(key) {
  const row = findRowBy("Settings", "Key", key);
  return row ? row.Value : "";
}

function requireAdmin(payload) {
  const code = String(payload.InvitationCode || payload.invitationCode || payload.adminCode || "").trim();
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

function isImage(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

function isVideo(mimeType) {
  return String(mimeType || "").startsWith("video/");
}