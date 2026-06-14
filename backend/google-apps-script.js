/**
 * Jyothsna & Tobias Wedding Hub - Google Apps Script backend
 * Deploy as Web App: Execute as Me, access Anyone with the link.
 */
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const DRIVE_FOLDER_ID = 'PASTE_GOOGLE_DRIVE_FOLDER_ID_FOR_UPLOADS_HERE';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    if (action === 'login') return json(login(body));
    if (action === 'rsvp') return json(append('RSVP', body));
    if (action === 'travel') return json(append('Travel', body));
    if (action === 'accommodation') return json(append('Accommodation', body));
    if (action === 'outfit') return json(append('OutfitOrders', body));
    if (action === 'photoUpload') return json(uploadPhoto(body));
    if (action === 'getOutfits') return json(getOutfits());
    return json({success:false, error:'Unknown action'});
  } catch (err) {
    return json({success:false, error:String(err)});
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }

function sheet(name){
  const s = ss().getSheetByName(name) || ss().insertSheet(name);
  return s;
}

function login(body){
  const code = String(body.code || '').trim().toUpperCase();
  const rows = sheet('Guests').getDataRange().getValues();
  const headers = rows.shift();
  const codeIndex = headers.indexOf('Code');
  const nameIndex = headers.indexOf('Name');
  const groupIndex = headers.indexOf('Group');
  const match = rows.find(r => String(r[codeIndex]).trim().toUpperCase() === code);
  if(!match) return {success:false};
  return {success:true, guest:{code:code, name:match[nameIndex] || '', group:match[groupIndex] || ''}};
}

function append(sheetName, body){
  const s = sheet(sheetName);
  const obj = Object.assign({}, body);
  delete obj.action;
  obj.timestamp = new Date();
  const keys = Object.keys(obj);
  ensureHeaders(s, keys);
  const headers = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  const row = headers.map(h => obj[h] || '');
  s.appendRow(row);
  return {success:true};
}

function ensureHeaders(s, keys){
  if(s.getLastRow() === 0){ s.appendRow(keys); return; }
  const headers = s.getRange(1,1,1,Math.max(1,s.getLastColumn())).getValues()[0].filter(Boolean);
  let changed = false;
  keys.forEach(k => { if(headers.indexOf(k) === -1){ headers.push(k); changed = true; }});
  if(changed) s.getRange(1,1,1,headers.length).setValues([headers]);
}

function uploadPhoto(body){
  const bytes = Utilities.base64Decode(body.fileData);
  const blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = file.getUrl();
  append('Gallery', {invitationCode:body.invitationCode || '', caption:body.caption || '', category:body.category || '', url:url, timestamp:new Date()});
  return {success:true, url:url};
}

function getOutfits(){
  const s = sheet('Outfits');
  const rows = s.getDataRange().getValues();
  if(rows.length < 2) return {success:true, outfits:[]};
  const headers = rows.shift();
  const outfits = rows.filter(r => r.join('').trim()).map(r => {
    const o = {};
    headers.forEach((h,i) => o[String(h).trim()] = r[i]);
    return {id:o.ID || o.id, event:o.Event || o.event, title:o.Title || o.title, image:o.Image || o.image, description:o.Description || o.description};
  });
  return {success:true, outfits:outfits};
}
