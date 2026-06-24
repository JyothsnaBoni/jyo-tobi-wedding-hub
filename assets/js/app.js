const CONFIG = {
  weddingDate: "2026-11-15T22:12:00+05:30",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxIXIzzkE3lVvRDDizGaRZjWdHOQ6T1x-KnYHJnYnP9y7sXpGk76dqfmUc41-zw3oE2/exec"
};

let CURRENT_USER = null;
let CURRENT_DATA = {};
let PUBLIC_CONTENT = {};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function api(action, payload = {}) {
  const response = await fetch(CONFIG.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });

  const text = await response.text();
  return JSON.parse(text);
}

function getInvitationCode() {
  return localStorage.getItem("jyoTobiInvitationCode") || "";
}

function setMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("error", isError);
  element.classList.remove("hidden");
}

function unlockSite() {
  $("#loginScreen")?.classList.add("hidden");
  $("#site")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function lockSite() {
  localStorage.removeItem("jyoTobiInvitationCode");
  localStorage.removeItem("jyoTobiGuestName");
  CURRENT_USER = null;
  CURRENT_DATA = {};
  $("#site")?.classList.add("hidden");
  $("#loginScreen")?.classList.remove("hidden");
}

async function initLogin() {
  const savedCode = getInvitationCode();

  if (savedCode) {
    await loginWithCode(savedCode, true);
  }

  $("#loginButton")?.addEventListener("click", async () => {
    await loginWithCode($("#inviteCode").value.trim(), false);
  });

  $("#inviteCode")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      await loginWithCode($("#inviteCode").value.trim(), false);
    }
  });
}

async function loginWithCode(code, silent = false) {
  const loginError = $("#loginError");

  if (!code) {
    setMessage(loginError, "Please enter your invitation code.", true);
    return;
  }

  try {
    setMessage(loginError, silent ? "" : "Checking invitation code...");

    const result = await api("login", { InvitationCode: code });

    if (!result.success) {
      localStorage.removeItem("jyoTobiInvitationCode");
      setMessage(loginError, result.error || "Invalid invitation code.", true);
      return;
    }

    CURRENT_USER = result.guest;
    CURRENT_DATA = result.data || {};
    PUBLIC_CONTENT = result.publicContent || {};

    localStorage.setItem("jyoTobiInvitationCode", result.invitationCode);
    localStorage.setItem("jyoTobiGuestName", result.guest?.GuestName || "");

    unlockSite();
    prefillAllForms();
    injectGuestDashboard();
    renderPublicContent();
    renderGuestDirectory();
    setupAdminMode(result.isAdmin);
  } catch (error) {
    console.error(error);
    setMessage(loginError, "Could not connect to the wedding database.", true);
  }
}

function prefillAllForms() {
  const code = getInvitationCode();

  $$("form[data-form]").forEach((form) => {
    const formName = form.dataset.form;
    const saved = CURRENT_DATA[formName];

    form.querySelectorAll("[name='InvitationCode']").forEach((input) => {
      input.value = code;
      input.readOnly = true;
    });

    if (CURRENT_USER?.GuestName) {
      form.querySelectorAll("[name='FullName']").forEach((input) => {
        if (!input.value) input.value = CURRENT_USER.GuestName;
      });
    }

    if (CURRENT_USER?.Email) {
      form.querySelectorAll("[name='Email']").forEach((input) => {
        if (!input.value) input.value = CURRENT_USER.Email;
      });
    }

    if (CURRENT_USER?.Phone) {
      form.querySelectorAll("[name='Phone'], [name='WhatsApp']").forEach((input) => {
        if (!input.value) input.value = CURRENT_USER.Phone;
      });
    }

    if (!saved || Array.isArray(saved)) return;

    Object.entries(saved).forEach(([key, value]) => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field && value !== undefined && value !== null) field.value = value;
    });
  });

  hydrateGuestDirectoryTravelDates(document.querySelector('form[data-form="GuestDirectory"]'));
  prefillOutfitByEvent();
}

function prefillOutfitByEvent() {
  const outfitForm = document.querySelector('form[data-form="Outfits"]');
  if (!outfitForm || !Array.isArray(CURRENT_DATA.Outfits)) return;

  const eventSelect = outfitForm.querySelector('[name="Event"]');

  eventSelect?.addEventListener("change", () => {
    const selectedEvent = eventSelect.value;
    const existing = CURRENT_DATA.Outfits.find(row => String(row.Event) === String(selectedEvent));

    if (!existing) return;

    Object.entries(existing).forEach(([key, value]) => {
      const field = outfitForm.querySelector(`[name="${key}"]`);
      if (field && value !== undefined && value !== null) field.value = value;
    });
  });
}

function syncGuestDirectoryTravelDates(form) {
  if (!form || form.dataset.form !== "GuestDirectory") return;

  const start = form.querySelector('[name="TravelStartDate"]')?.value || "";
  const end = form.querySelector('[name="TravelEndDate"]')?.value || "";
  const hidden = form.querySelector('[name="TravelDates"]');

  if (!hidden) return;

  if (start && end) {
    hidden.value = `${start} to ${end}`;
  } else if (start) {
    hidden.value = `From ${start}`;
  } else if (end) {
    hidden.value = `Until ${end}`;
  } else {
    hidden.value = "";
  }
}

function hydrateGuestDirectoryTravelDates(form) {
  if (!form || form.dataset.form !== "GuestDirectory") return;

  const travelDates = form.querySelector('[name="TravelDates"]')?.value || "";
  const startInput = form.querySelector('[name="TravelStartDate"]');
  const endInput = form.querySelector('[name="TravelEndDate"]');

  if (!travelDates || !startInput || !endInput) return;

  const dates = travelDates.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates[0]) startInput.value = dates[0];
  if (dates[1]) endInput.value = dates[1];
}

function getActionForForm(formName) {
  return {
    RSVP: "saveRSVP",
    Travel: "saveTravel",
    Accommodation: "saveAccommodation",
    Outfits: "saveOutfit",
    GuestDirectory: "saveGuestDirectory"
  }[formName];
}

function initForms() {
  $$("form[data-form]").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formName = form.dataset.form;
      const action = getActionForForm(formName);
      const message = form.querySelector(".form-message");

      if (!action) {
        setMessage(message, "Unknown form type.", true);
        return;
      }

      syncGuestDirectoryTravelDates(form);

      const data = Object.fromEntries(new FormData(form).entries());
      data.InvitationCode = getInvitationCode();

      const referenceImage = form.querySelector("[name='ReferenceImage']")?.files?.[0];
      if (formName === "Outfits" && referenceImage) {
        const filePayload = await readFileAsBase64(referenceImage);
        data.FileName = referenceImage.name;
        data.MimeType = referenceImage.type;
        data.fileBase64 = filePayload;
      }

      try {
        setMessage(message, "Saving...");
        const result = await api(action, data);

        if (!result.success) {
          setMessage(message, result.error || "Could not save.", true);
          return;
        }

        if (formName === "RSVP") {
          await syncGuestDirectoryFromRSVP(data);
        }

        setMessage(message, result.mode === "updated" ? "Updated successfully." : "Saved successfully.");
        await refreshGuestData();
      } catch (error) {
        console.error(error);
        setMessage(message, "Could not save. Please try again.", true);
      }
    });
  });
}

async function syncGuestDirectoryFromRSVP(rsvpData = {}) {
  const invitationCode = rsvpData.InvitationCode || getInvitationCode();
  if (!invitationCode) return;

  const allowDirectory = normalizeText(rsvpData.AllowGuestDirectory) === "yes";
  const allowContact = normalizeText(rsvpData.AllowContactSharing) === "yes";

  const guestDirectoryPayload = {
    InvitationCode: invitationCode,
    DisplayName: rsvpData.FullName || CURRENT_USER?.GuestName || "",
    City: rsvpData.City || "",
    Country: rsvpData.Country || "",
    GuestGroup: CURRENT_USER?.GuestGroup || "",
    AttendingEvents: rsvpData.Attendance || "",
    ShowInDirectory: allowDirectory ? "Yes" : "No",
    ShareWhatsApp: allowContact ? "Yes" : "No",
    ShareEmail: allowContact ? "Yes" : "No",
    WhatsApp: allowContact ? (rsvpData.Phone || CURRENT_USER?.Phone || "") : "",
    Email: allowContact ? (rsvpData.Email || CURRENT_USER?.Email || "") : "",
    Notes: ""
  };

  const existingDirectory = CURRENT_DATA?.GuestDirectory;
  if (existingDirectory && !Array.isArray(existingDirectory)) {
    guestDirectoryPayload.TravelDates = existingDirectory.TravelDates || "";
    guestDirectoryPayload.CitiesVisiting = existingDirectory.CitiesVisiting || "";
    guestDirectoryPayload.Notes = existingDirectory.Notes || "";
    guestDirectoryPayload.GuestGroup = existingDirectory.GuestGroup || guestDirectoryPayload.GuestGroup;
  }

  try {
    const syncResult = await api("saveGuestDirectory", guestDirectoryPayload);
    if (!syncResult.success) {
      console.warn("GuestDirectory sync from RSVP failed:", syncResult.error || syncResult);
    }
  } catch (error) {
    console.warn("GuestDirectory sync from RSVP failed:", error);
  }
}

async function refreshGuestData() {
  const code = getInvitationCode();
  if (!code) return;

  const result = await api("getGuestData", { InvitationCode: code });

  if (result.success) {
    CURRENT_DATA = result.data || {};
    PUBLIC_CONTENT = result.publicContent || {};
    prefillAllForms();
    injectGuestDashboard();
    renderPublicContent();
    renderGuestDirectory();
  }
}

function injectGuestDashboard() {
  $("#guestDashboard")?.remove();

  const main = document.querySelector("main");
  const firstSection = $("#couple") || $("#story");
  if (!main || !firstSection) return;

  const name = CURRENT_USER?.GuestName || "Guest";

  const dashboard = document.createElement("section");
  dashboard.id = "guestDashboard";
  dashboard.className = "section guest-dashboard-section";
  dashboard.innerHTML = `
    <div class="dashboard-card reveal visible">
      <p class="eyebrow">Your Wedding Dashboard</p>
      <h2>Welcome, ${escapeHtml(name)}</h2>
      <p>You can update your RSVP, travel, accommodation and outfit preferences anytime.</p>
      <div class="dashboard-actions">
        <a class="button primary" href="#rsvp">Edit RSVP</a>
        <a class="button primary" href="#travel">Edit Travel</a>
        <a class="button primary" href="#stay">Edit Stay</a>
        <a class="button primary" href="#outfits">Edit Outfits</a>
        <a class="button primary" href="#guest-connect">Guest Connect</a>
      </div>
      <button class="button logout-button" type="button" onclick="lockSite()">Log out</button>
    </div>
  `;

  main.insertBefore(dashboard, firstSection);
}


function renderPublicContent() {
  renderOutfitCatalog();
  applyStaySettings();
  renderFamilySections();
  renderIndiaContactsSection();
  preparePagePanels();
  showPage(getCurrentPageId(), false);
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function rowMatches(row, terms) {
  const haystack = [
    row.Side,
    row.FamilySide,
    row.Group,
    row.Category,
    row.Role,
    row.Relation,
    row.Title
  ].map(normalizeText).join(" ");

  return terms.some(term => haystack.includes(term));
}

function renderCards(containerId, rows, fallbackRows = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const finalRows = rows && rows.length ? rows : fallbackRows;

  container.innerHTML = finalRows.map(row => `
    <article class="person-card reveal visible">
      <div class="person-photo">
        ${row.PhotoUrl ? `<img src="${escapeAttr(row.PhotoUrl)}" alt="${escapeAttr(row.Name)}">` : `<span>${getInitials(row.Name || row.Title || "")}</span>`}
      </div>
      <h3>${escapeHtml(row.Name || row.Title || "")}</h3>
      <p>${escapeHtml(row.Role || row.Relation || row.Group || row.Category || "")}</p>
      <div class="person-links">
        ${row.WhatsApp ? `<a href="${escapeAttr(toWhatsAppLink(row.WhatsApp))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${row.Instagram ? `<a href="${escapeAttr(row.Instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""}
      </div>
    </article>
  `).join("");
}

function renderPartySections() {
  const rows = PUBLIC_CONTENT.WeddingParty || [];

  const bachelorette = rows.filter(row => rowMatches(row, ["bride", "bridesmaid", "maid", "bachelorette"]));
  const bachelor = rows.filter(row => rowMatches(row, ["groom", "groomsmen", "groomsman", "best man", "bachelor"]));

  renderCards("bachelorettePartyGrid", bachelorette, [
    { Name: "Supriya", Role: "Maid of Honour" },
    { Name: "Samira", Role: "Bridesmaid" },
    { Name: "Lena", Role: "Bridesmaid" },
    { Name: "Shreya", Role: "Bridesmaid" },
    { Name: "Marissa", Role: "Bridesmaid" },
    { Name: "Lilly", Role: "Bridesmaid" }
  ]);

  renderCards("bachelorPartyGrid", bachelor, [
    { Name: "Maximilian Grußer", Role: "Best Man" },
    { Name: "Max", Role: "Groomsman" },
    { Name: "Frank", Role: "Groomsman" },
    { Name: "Ruben", Role: "Groomsman" },
    { Name: "Steven", Role: "Groomsman" }
  ]);
}

function renderFamilySections() {
  const rows = PUBLIC_CONTENT.Family || [];

  const brideFamily = rows.filter(row => rowMatches(row, ["bride", "jyo", "jyothsna"]));
  const groomFamily = rows.filter(row => rowMatches(row, ["groom", "tobi", "tobias"]));

  renderCards("brideFamilyGrid", brideFamily, [
    { Name: "Demudamma", Relation: "Mother" },
    { Name: "Aditya", Relation: "Brother" },
    { Name: "Bharathi", Relation: "Cousin / like own sibling" },
    { Name: "Jyothi", Relation: "Cousin / like own sibling" },
    { Name: "Sowjanya", Relation: "Cousin / like own sibling" },
    { Name: "Chaitanya", Relation: "Cousin / like own sibling" }
  ]);

  renderCards("groomFamilyGrid", groomFamily, [
    { Name: "Roland Scholtes", Relation: "Father" },
    { Name: "Claudia Scholtes", Relation: "Mother" },
    { Name: "Daniel", Relation: "Brother" },
    { Name: "Manuel", Relation: "Brother" },
    { Name: "Celina", Relation: "Sister" },
    { Name: "Jasmin", Relation: "Sister" },
     { Name: "Charlie", Relation: "Family Dog" }
  ]);
}

function renderIndiaContactsSection() {
  const rows = PUBLIC_CONTENT.IndiaContacts || [];
  renderCards("indiaContactsGrid", rows, [
    { Name: "Demudamma", Role: "Bride's mother" },
    { Name: "Aditya", Role: "Bride's brother" },
    { Name: "Bharathi", Role: "Local contact" },
    { Name: "Jyothi", Role: "Local contact" },
    { Name: "Sowjanya", Role: "Local contact" },
    { Name: "Chaitanya", Role: "Local contact" }
  ]);
}
function renderOutfitCatalog() {
  const catalog = PUBLIC_CONTENT.OutfitCatalog || [];
  const outfitsSection = $("#outfits");

  if (!outfitsSection || $("#outfitCatalogDynamic") || !catalog.length) return;

  const catalogBlock = document.createElement("div");
  catalogBlock.id = "outfitCatalogDynamic";
  catalogBlock.className = "outfit-catalog";
  catalogBlock.innerHTML = `
    <div class="catalog-tabs">
      <button type="button" data-filter="All" class="active">All</button>
      <button type="button" data-filter="Women">Women</button>
      <button type="button" data-filter="Men">Men</button>
    </div>

    <div class="catalog-grid">
      ${catalog.map(item => `
        <article class="catalog-card" data-gender="${escapeAttr(item.Gender)}">
          <div class="catalog-image">
            ${item.ImageUrl
              ? `<img src="${escapeAttr(item.ImageUrl)}" alt="${escapeAttr(item.Title)}">`
              : `<img src="assets/images/indian-couple-illustration.png" alt="Indian wedding outfit inspiration">`
            }
          </div>
          <p class="eyebrow">${escapeHtml(item.Gender || "")} · ${escapeHtml(item.Event || "")}</p>
          <h3>${escapeHtml(item.Title || "")}</h3>
          <p>${escapeHtml(item.Description || "")}</p>
          ${item.ReferenceLink ? `<a href="${escapeAttr(item.ReferenceLink)}" target="_blank" rel="noopener">Reference link →</a>` : ""}
        </article>
      `).join("")}
    </div>
  `;

  const form = outfitsSection.querySelector("form");
  outfitsSection.insertBefore(catalogBlock, form);

  $$(".catalog-tabs button").forEach(button => {
    button.addEventListener("click", () => {
      $$(".catalog-tabs button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");

      const filter = button.dataset.filter;
      $$(".catalog-card").forEach(card => {
        card.style.display = filter === "All" || card.dataset.gender === filter ? "" : "none";
      });
    });
  });
}

async function renderGuestDirectory() {
  const container = document.getElementById("guestDirectoryDynamic");
  if (!container) return;

  const result = await api("getGuestDirectory", { InvitationCode: getInvitationCode() });
  if (!result.success) return;

  const rows = result.data || [];
  container.innerHTML = rows.length ? rows.map(row => `
    <article class="directory-card reveal visible">
      <h3>${escapeHtml(row.DisplayName || "")}</h3>
      <p>${escapeHtml([row.City, row.Country].filter(Boolean).join(", "))}</p>
      <p>${escapeHtml(row.TravelDates || "")}</p>
      <p>${escapeHtml(row.CitiesVisiting || "")}</p>
      ${row.AttendingEvents ? `<p><strong>Events:</strong> ${escapeHtml(row.AttendingEvents)}</p>` : ""}
      ${row.Notes ? `<p class="guest-note">${escapeHtml(row.Notes)}</p>` : ""}
      <div class="person-links">
        ${row.WhatsApp ? `<a href="${escapeAttr(toWhatsAppLink(row.WhatsApp))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${row.Email ? `<a href="mailto:${escapeAttr(row.Email)}">Email</a>` : ""}
      </div>
    </article>
  `).join("") : `<p class="empty-note">No guests have chosen to appear here yet.</p>`;
}

function getSettingsMap() {
  const rows = PUBLIC_CONTENT.Settings || [];
  const map = {};
  rows.forEach(row => {
    if (row.Key) map[row.Key] = row.Value || "";
  });
  return map;
}

function applyStaySettings() {
  const settings = getSettingsMap();

  document.querySelectorAll("[data-setting]").forEach(el => {
    const key = el.dataset.setting;
    if (settings[key]) el.textContent = settings[key];
  });

  document.querySelectorAll("[data-setting-href]").forEach(el => {
    const key = el.dataset.settingHref;
    if (settings[key]) el.href = settings[key];
  });
}

function renderAdminStayEditor() {
  if (!CURRENT_USER) return "";

  const settings = getSettingsMap();
  const fields = [
    ["SaiPriyaTitle", "Sai Priya title"],
    ["SaiPriyaText", "Sai Priya description"],
    ["SaiPriyaLink", "Sai Priya map/link"],
    ["SimbaTitle", "Simba title"],
    ["SimbaText", "Simba description"],
    ["SimbaLink", "Simba map/link"],
    ["MarriottLink", "Marriott link"],
    ["NovotelLink", "Novotel link"],
    ["PalmBeachLink", "Palm Beach link"],
    ["RadissonLink", "Radisson link"]
  ];

  return `
    <form id="adminStayForm" class="lux-form compact admin-edit-form">
      <h3>Edit Stay Page</h3>
      <p class="form-helper">Admin only. This saves text and links into the existing Settings sheet.</p>
      ${fields.map(([key, label]) => `
        <label class="admin-field-label">${escapeHtml(label)}
          <input name="${escapeAttr(key)}" value="${escapeAttr(settings[key] || "")}" placeholder="${escapeAttr(label)}" />
        </label>
      `).join("")}
      <button class="button primary" type="submit">Save stay information</button>
      <p class="form-message"></p>
    </form>
  `;
}

function setupAdminMode(isAdmin) {
  if (!isAdmin || $("#adminPanel")) return;

  const main = document.querySelector("main");
  const contact = $("#contact");

  const section = document.createElement("section");
  section.id = "adminPanel";
  section.className = "section admin-section";
  section.innerHTML = `
    <div class="section-heading reveal visible">
      <p class="eyebrow">Admin Only</p>
      <h2>Jyothsna Admin Panel</h2>
      <p>Manage stay information and outfit suggestions from the front end. More detailed edits can still be done in Google Sheets.</p>
    </div>
    <div class="admin-grid">
      <div class="admin-card"><h3>Outfit Catalogue</h3><p>Edit OutfitCatalog in Google Sheets, or use the quick-add form below.</p></div>
      <div class="admin-card"><h3>Stay Page</h3><p>Edit accommodation text and hotel links from this admin page.</p></div>
      <div class="admin-card"><h3>Gallery Approval</h3><p>Approve uploads in GalleryUploads.</p></div>
    </div>
    ${renderAdminStayEditor()}
    <form id="adminOutfitForm" class="lux-form compact admin-edit-form">
      <h3>Add / Update Outfit Suggestion</h3>
      <p class="form-helper">Saves to the existing OutfitCatalog sheet. Use a unique title to update an existing item.</p>
      <div class="form-row">
        <input name="Title" placeholder="Title, e.g. Haldi yellow kurta" required />
        <select name="Gender"><option>Women</option><option>Men</option></select>
      </div>
      <div class="form-row">
        <select name="Event"><option>Haldi</option><option>Sangeeth</option><option>Wedding</option><option>Reception</option></select>
        <input name="PriceRange" placeholder="Budget / mid-range / premium" />
      </div>
      <input name="ReferenceLink" placeholder="Shopping link" />
      <input name="ImageUrl" placeholder="Image URL" />
      <textarea name="Description" placeholder="Description and styling advice"></textarea>
      <button class="button primary" type="submit">Save outfit suggestion</button>
      <p class="form-message"></p>
    </form>
  `;

  main.insertBefore(section, contact);
  bindAdminForms();
  preparePagePanels();
}

function bindAdminForms() {
  const stayForm = document.getElementById("adminStayForm");
  if (stayForm && stayForm.dataset.bound !== "true") {
    stayForm.dataset.bound = "true";
    stayForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = stayForm.querySelector(".form-message");
      const values = Object.fromEntries(new FormData(stayForm).entries());
      try {
        setMessage(message, "Saving...");
        for (const [key, value] of Object.entries(values)) {
          await api("adminSaveRow", {
            InvitationCode: getInvitationCode(),
            targetSheet: "Settings",
            lookupColumn: "Key",
            lookupValue: key,
            rowData: { Key: key, Value: value }
          });
        }
        setMessage(message, "Stay information saved.");
        await refreshGuestData();
      } catch (error) {
        console.error(error);
        setMessage(message, "Could not save stay information.", true);
      }
    });
  }

  const outfitForm = document.getElementById("adminOutfitForm");
  if (outfitForm && outfitForm.dataset.bound !== "true") {
    outfitForm.dataset.bound = "true";
    outfitForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = outfitForm.querySelector(".form-message");
      const data = Object.fromEntries(new FormData(outfitForm).entries());
      try {
        setMessage(message, "Saving...");
        await api("adminSaveRow", {
          InvitationCode: getInvitationCode(),
          targetSheet: "OutfitCatalog",
          lookupColumn: "Title",
          lookupValue: data.Title,
          rowData: {
            ...data,
            Available: "Yes",
            Visible: "Yes",
            SortOrder: 999
          }
        });
        setMessage(message, "Outfit suggestion saved.");
        outfitForm.reset();
        await refreshGuestData();
      } catch (error) {
        console.error(error);
        setMessage(message, "Could not save outfit suggestion.", true);
      }
    });
  }
}

function initCountdown() {
  const target = new Date(CONFIG.weddingDate).getTime();

  function updateCountdown() {
    const diff = Math.max(target - Date.now(), 0);

    $("#days") && ($("#days").textContent = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(3, "0"));
    $("#hours") && ($("#hours").textContent = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, "0"));
    $("#minutes") && ($("#minutes").textContent = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, "0"));
    $("#seconds") && ($("#seconds").textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, "0"));
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function initRevealAnimations() {
  const revealElements = $$(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach(el => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });

  revealElements.forEach(el => observer.observe(el));
}

function initLanguage() {
  const lang = localStorage.getItem("jyoTobiLang") || "en";
  setLanguage(lang);

  $("#languageSelect")?.addEventListener("change", event => {
    setLanguage(event.target.value);
  });
}

function setLanguage(lang) {
  const dictionary = window.translations?.[lang] || window.translations?.en || {};
  document.documentElement.dataset.lang = lang;
  localStorage.setItem("jyoTobiLang", lang);

  $$("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (dictionary[key]) element.textContent = dictionary[key];
  });

  if ($("#languageSelect")) $("#languageSelect").value = lang;
}

function initMobileNav() {
  $("#navToggle")?.addEventListener("click", () => {
    $("#navLinks")?.classList.toggle("open");
  });

  $$("#navLinks a").forEach(link => {
    link.addEventListener("click", () => $("#navLinks")?.classList.remove("open"));
  });
}

function initGallery() {
  const track = $(".gallery-track");
  if (!track) return;

  const slides = $$(".gallery-slide");
  const tabs = $$("[data-gallery-filter]");

  function applyFilter(filter) {
    let visibleCount = 0;

    slides.forEach(slide => {
      const category = slide.dataset.category || "";
      const show = filter === "all" || category === filter;

      slide.classList.toggle("is-hidden", !show);
      if (show) visibleCount++;
    });

    let empty = $("#galleryEmptyState");
    if (!empty) {
      empty = document.createElement("article");
      empty.id = "galleryEmptyState";
      empty.className = "gallery-slide empty-gallery-card";
      empty.innerHTML = `
        <img src="assets/images/indian-couple-illustration.png" alt="Indian wedding couple illustration">
        <h3>No photos yet</h3>
        <p>Be the first to upload memories from this event.</p>
        <a href="#memories" class="button primary">Upload Photos / Videos</a>
      `;
      track.appendChild(empty);
    }

    empty.classList.toggle("is-hidden", visibleCount > 0);
    track.scrollTo({ left: 0, behavior: "smooth" });
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      applyFilter(tab.dataset.galleryFilter);
    });
  });

  $(".gallery-next")?.addEventListener("click", () => {
    track.scrollBy({ left: 380, behavior: "smooth" });
  });

  $(".gallery-prev")?.addEventListener("click", () => {
    track.scrollBy({ left: -380, behavior: "smooth" });
  });

  applyFilter("all");
}

function initMediaUploadForm() {
  const form = $("#mediaUploadForm");
  if (!form || form.dataset.bound === "true") return;

  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = form.querySelector(".form-message");
    const fileInput = form.querySelector("[name='mediaFile']");
    const file = fileInput?.files?.[0];

    if (!file) {
      setMessage(message, "Please choose a photo or video.", true);
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.InvitationCode = getInvitationCode();

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        setMessage(message, "Uploading...");

        const base64 = String(reader.result).split(",")[1];

        const result = await api("uploadMedia", {
          ...data,
          FileName: file.name,
          MimeType: file.type,
          fileBase64: base64
        });

        if (!result.success) {
          setMessage(message, result.error || "Upload failed.", true);
          return;
        }

        setMessage(message, "Uploaded successfully. It will appear after admin approval.");
        form.reset();
      } catch (error) {
        console.error(error);
        setMessage(message, "Upload failed. Please try again.", true);
      }
    };

    reader.readAsDataURL(file);
  });
}


function preparePagePanels() {
  const panels = document.querySelectorAll("#site > .hero, main > section");
  panels.forEach(panel => panel.classList.add("page-panel"));
}

function getCurrentPageId() {
  const hash = (location.hash || "").replace("#", "");
  return hash || "home";
}

function showPage(pageId = "home", updateHash = true) {
  preparePagePanels();

  const target = document.getElementById(pageId) || document.getElementById("home");
  if (!target) return;

  document.querySelectorAll(".page-panel").forEach(panel => {
    panel.classList.remove("active-page");
  });

  target.classList.add("active-page");

  document.querySelectorAll(".nav-links a, .dashboard-actions a, .hero-actions a, .empty-gallery-card a").forEach(link => {
    const id = link.getAttribute("href")?.replace("#", "");
    link.classList.toggle("active-link", id === target.id);
  });

  if (updateHash && location.hash !== `#${target.id}`) {
    history.pushState(null, "", `#${target.id}`);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
  updateNavbarState();
}

function initPageNavigation() {
  preparePagePanels();

  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const pageId = link.getAttribute("href").replace("#", "");
    const target = document.getElementById(pageId);

    if (!target) return;

    event.preventDefault();
    showPage(pageId, true);
    document.querySelector("#navLinks")?.classList.remove("open");
  });

  window.addEventListener("popstate", () => {
    showPage(getCurrentPageId(), false);
  });

  showPage(getCurrentPageId(), false);
}


function updateNavbarState() {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const currentPage = document.querySelector(".page-panel.active-page");
  const isHome = currentPage?.id === "home";
  const shouldBeSolid = window.scrollY > 160;

  nav.classList.toggle("scrolled", shouldBeSolid);
}

function initTransparentNavbar() {
  updateNavbarState();
  window.addEventListener("scroll", updateNavbarState, { passive: true });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toWhatsAppLink(value) {
  if (!value) return "";
  if (String(value).startsWith("http")) return value;
  return "https://wa.me/" + String(value).replace(/[^\d]/g, "");
}

function getInitials(name = "") {
  return name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initRevealAnimations();
  initLanguage();
  initMobileNav();
  initForms();
  initGallery();
  initMediaUploadForm();
  initPageNavigation();
  initTransparentNavbar();
  initLogin();
});