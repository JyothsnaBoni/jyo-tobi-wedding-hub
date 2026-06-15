const CONFIG = {
  previewCode: "JYOTOBI",
  weddingDate: "2026-11-15T22:12:00+05:30",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxLJWqyz4Pe8eXt8txbSaLpHuzpLQ3Defcg-cMrr40tlYYpC9ZeaSz0SE1l327xjbI_/exec"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function unlockSite() {
  const loginScreen = $("#loginScreen");
  const site = $("#site");

  if (loginScreen) {
    loginScreen.classList.add("hidden");
  }

  if (site) {
    site.classList.remove("hidden");
  }

  localStorage.setItem("jyoTobiUnlocked", "true");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function initLogin() {
  const loginScreen = $("#loginScreen");
  const loginButton = $("#loginButton");
  const inviteCodeInput = $("#inviteCode");
  const loginError = $("#loginError");

  if (!loginScreen || !loginButton || !inviteCodeInput) {
    return;
  }

  if (localStorage.getItem("jyoTobiUnlocked") === "true") {
    unlockSite();
  }

  loginButton.addEventListener("click", () => {
    const code = inviteCodeInput.value.trim().toUpperCase();

    if (code === CONFIG.previewCode) {
      unlockSite();
    } else if (loginError) {
      loginError.classList.remove("hidden");
    }
  });

  inviteCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loginButton.click();
    }
  });
}

function initCountdown() {
  const daysEl = $("#days");
  const hoursEl = $("#hours");
  const minutesEl = $("#minutes");
  const secondsEl = $("#seconds");

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
    return;
  }

  const target = new Date(CONFIG.weddingDate).getTime();

  function updateCountdown() {
    const now = Date.now();
    const diff = Math.max(target - now, 0);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = String(days).padStart(3, "0");
    hoursEl.textContent = String(hours).padStart(2, "0");
    minutesEl.textContent = String(minutes).padStart(2, "0");
    secondsEl.textContent = String(seconds).padStart(2, "0");
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function initRevealAnimations() {
  const revealElements = $$(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => {
      element.classList.add("visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  revealElements.forEach((element) => observer.observe(element));
}

function setLanguage(lang) {
  const dictionary = translations[lang] || translations.en;

  document.documentElement.dataset.lang = lang;
  localStorage.setItem("jyoTobiLang", lang);

  $$("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  const languageSelect = $("#languageSelect");

  if (languageSelect) {
    languageSelect.value = lang;
  }
}

function initLanguage() {
  const languageSelect = $("#languageSelect");

  if (!languageSelect) {
    return;
  }

  const savedLanguage = localStorage.getItem("jyoTobiLang") || "en";

  setLanguage(savedLanguage);

  languageSelect.addEventListener("change", (event) => {
    setLanguage(event.target.value);
  });
}

function initMobileNav() {
  const navToggle = $("#navToggle");
  const navLinks = $("#navLinks");

  if (!navToggle || !navLinks) {
    return;
  }

  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });

  $$("#navLinks a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
    });
  });
}

async function submitToAppsScript(formName, data) {
  if (!CONFIG.appsScriptUrl) {
    return {
      ok: true,
      localOnly: true
    };
  }

  await fetch(CONFIG.appsScriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      formName,
      data,
      timestamp: new Date().toISOString()
    })
  });

  return {
    ok: true
  };
}

function initForms() {
  const forms = $$("form[data-form]");

  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formName = form.dataset.form;
      const message = form.querySelector(".form-message");

      if (message) {
        message.textContent = "Saving...";
        message.classList.remove("error");
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const inviteCodeInput = $("#inviteCode");

      data.inviteCode = inviteCodeInput ? inviteCodeInput.value : "";

      try {
        await submitToAppsScript(formName, data);

        if (message) {
          if (CONFIG.appsScriptUrl) {
            message.textContent = "Saved. Thank you!";
          } else {
            message.textContent =
              "Preview mode: form captured locally. Add your Google Apps Script URL later.";
          }
        }

        form.reset();
      } catch (error) {
        if (message) {
          message.textContent =
            "Something went wrong. Please try again or message Jyothsna.";
          message.classList.add("error");
        }

        console.error(error);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initCountdown();
  initRevealAnimations();
  initLanguage();
  initMobileNav();
  initForms();
});