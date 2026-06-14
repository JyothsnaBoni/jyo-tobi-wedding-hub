# Jyothsna & Tobias Wedding Hub

This package contains a first working version of the private wedding guest portal.

## Files

- `index.html` — main GitHub Pages page
- `assets/css/styles.css` — luxury tropical Telugu wedding design
- `assets/js/app.js` — login, translations, countdown, forms, outfit loading
- `backend/google-apps-script.js` — Google Sheets + Drive backend

## Important

Your printed QR code URL does not need to change. Replace your current GitHub Pages project files with these files.

## Demo login codes before backend setup

Until Google Apps Script is connected, these invitation codes work:

- BER001
- JYO001
- TOBI001
- FAMILY001

You can change them in `assets/js/app.js`.

## Google Sheet tabs to create

Create a Google Sheet named `WeddingHub` with these tabs:

- Guests
- RSVP
- Travel
- Accommodation
- OutfitOrders
- Outfits
- Gallery

In `Guests`, add headers:

`Code | Name | Group | Email`

Example:

`BER001 | Anna Müller | Germany Guests | anna@example.com`

In `Outfits`, add headers:

`ID | Event | Title | Image | Description`

## Apps Script setup

1. Open your Google Sheet.
2. Extensions → Apps Script.
3. Paste `backend/google-apps-script.js`.
4. Replace `PASTE_GOOGLE_SHEET_ID_HERE` with your Sheet ID.
5. Create a Google Drive folder for uploads.
6. Replace `PASTE_GOOGLE_DRIVE_FOLDER_ID_FOR_UPLOADS_HERE` with that folder ID.
7. Deploy → New deployment → Web app.
8. Execute as: Me.
9. Who has access: Anyone with the link.
10. Copy the Web App URL.
11. Paste it into `CONFIG.appsScriptUrl` in `assets/js/app.js`.

## Notes

This is version 1. It includes the complete page structure and working form architecture. Next iterations can improve:

- More polished outfit catalogue
- Admin dashboard
- Gallery display from Google Drive
- Better German translations
- More detailed Telugu wedding explanations
