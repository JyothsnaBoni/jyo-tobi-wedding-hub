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

      const data = Object.fromEntries(new FormData(form).entries());
      data.InvitationCode = getInvitationCode();

      try {
        setMessage(message, "Saving...");
        const result = await api(action, data);

        if (!result.success) {
          setMessage(message, result.error || "Could not save.", true);
          return;
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
      </div>
      <button class="button logout-button" type="button" onclick="lockSite()">Log out</button>
    </div>
  `;

  main.insertBefore(dashboard, firstSection);
}

function renderPublicContent() {
  renderOutfitCatalog();
  renderSimplePeopleSection("weddingPartyDynamic", "WeddingParty", "Wedding Party", "Best man, bridesmaids, groomsmen and close friends.");
  renderSimplePeopleSection("familyDynamic", "Family", "Our Families", "The people who raised us, loved us and shaped our story.");
  renderSimplePeopleSection("indiaContactsDynamic", "IndiaContacts", "Need Help in India?", "Useful family contacts while you are in India.");
}

function renderSimplePeopleSection(sectionId, key, title, subtitle) {
  if ($(`#${sectionId}`)) return;

  const rows = PUBLIC_CONTENT[key] || [];
  const contactSection = $("#contact");

  if (!contactSection || !rows.length) return;

  const section = document.createElement("section");
  section.id = sectionId;
  section.className = "section dynamic-people-section";
  section.innerHTML = `
    <div class="section-heading reveal visible">
      <p class="eyebrow">${escapeHtml(subtitle)}</p>
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="people-grid">
      ${rows.map(row => `
        <article class="person-card reveal visible">
          <div class="person-photo">
            ${row.PhotoUrl ? `<img src="${escapeAttr(row.PhotoUrl)}" alt="${escapeAttr(row.Name)}">` : `<span>${getInitials(row.Name)}</span>`}
          </div>
          <h3>${escapeHtml(row.Name || "")}</h3>
          <p>${escapeHtml(row.Role || row.Relation || row.Group || "")}</p>
          <div class="person-links">
            ${row.WhatsApp ? `<a href="${escapeAttr(toWhatsAppLink(row.WhatsApp))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            ${row.Instagram ? `<a href="${escapeAttr(row.Instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;

  contactSection.parentNode.insertBefore(section, contactSection);
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
  if ($("#guestDirectoryDynamic")) return;

  const result = await api("getGuestDirectory", { InvitationCode: getInvitationCode() });
  if (!result.success) return;

  const rows = result.data || [];
  const travelSection = $("#travel");
  if (!travelSection) return;

  const section = document.createElement("section");
  section.id = "guestDirectoryDynamic";
  section.className = "section guest-directory-section";
  section.innerHTML = `
    <div class="section-heading reveal visible">
      <p class="eyebrow">Guest Connect</p>
      <h2>Who’s Coming?</h2>
      <p>Guests who opt in can connect here for flights, India travel plans and wedding coordination.</p>
    </div>

    <div class="directory-grid">
      ${rows.length ? rows.map(row => `
        <article class="directory-card">
          <h3>${escapeHtml(row.DisplayName || "")}</h3>
          <p>${escapeHtml([row.City, row.Country].filter(Boolean).join(", "))}</p>
          <p>${escapeHtml(row.CitiesVisiting || "")}</p>
          <div class="person-links">
            ${row.WhatsApp ? `<a href="${escapeAttr(toWhatsAppLink(row.WhatsApp))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            ${row.Email ? `<a href="mailto:${escapeAttr(row.Email)}">Email</a>` : ""}
          </div>
        </article>
      `).join("") : `<p class="empty-note">No guests have chosen to appear here yet.</p>`}
    </div>

    <form class="lux-form compact" data-form="GuestDirectory">
      <h3>Join Guest Connect</h3>
      <div class="form-row">
        <input name="DisplayName" placeholder="Display name" />
        <input name="GuestGroup" placeholder="Guest group, e.g. Germany friends" />
      </div>
      <div class="form-row">
        <input name="City" placeholder="City" />
        <input name="Country" placeholder="Country" />
      </div>
      <div class="form-row">
        <input name="TravelDates" placeholder="Travel dates" />
        <input name="CitiesVisiting" placeholder="Cities visiting in India" />
      </div>
      <div class="form-row">
        <select name="ShowInDirectory">
          <option value="">Show me in guest directory?</option>
          <option>Yes</option>
          <option>No</option>
        </select>
        <select name="ShareWhatsApp">
          <option value="">Share WhatsApp?</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </div>
      <div class="form-row">
        <select name="ShareEmail">
          <option value="">Share email?</option>
          <option>Yes</option>
          <option>No</option>
        </select>
        <input name="AttendingEvents" placeholder="Events attending" />
      </div>
      <input name="InvitationCode" type="hidden" />
      <input name="WhatsApp" placeholder="WhatsApp number" />
      <input name="Email" type="email" placeholder="Email" />
      <button class="button primary" type="submit">Save Guest Connect Preferences</button>
      <p class="form-message"></p>
    </form>
  `;

  travelSection.parentNode.insertBefore(section, travelSection);
  initForms();
  prefillAllForms();
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
      <p>Manage catalogue, wedding party, family contacts and gallery approvals from Google Sheets for now.</p>
    </div>
    <div class="admin-grid">
      <div class="admin-card"><h3>Outfit Catalogue</h3><p>Edit OutfitCatalog in Google Sheets.</p></div>
      <div class="admin-card"><h3>Wedding Party</h3><p>Edit WeddingParty tab.</p></div>
      <div class="admin-card"><h3>Family & Contacts</h3><p>Edit Family and IndiaContacts tabs.</p></div>
      <div class="admin-card"><h3>Gallery Approval</h3><p>Approve uploads in GalleryUploads.</p></div>
    </div>
  `;

  main.insertBefore(section, contact);
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
  initLogin();
  initCountdown();
  initRevealAnimations();
  initLanguage();
  initMobileNav();
  initForms();
  initGallery();
  initMediaUploadForm();
});