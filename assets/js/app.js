const CONFIG = {
  appsScriptUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
  weddingDate: "2026-11-15T22:12:00+05:30",
  demoCodes: ["BER001", "JYO001", "TOBI001", "FAMILY001"]
};

const translations = {
  en: {
    "login.private":"Private Wedding Guest Portal","login.copy":"Please enter your invitation code to access the wedding hub.","login.code":"Invitation Code","login.enter":"Enter Wedding Hub","login.note":"This portal is for invited guests only.",
    "nav.story":"Story","nav.guide":"Wedding Guide","nav.schedule":"Schedule","nav.travel":"Travel","nav.stay":"Stay","nav.outfits":"Outfits","nav.gallery":"Gallery","nav.contact":"Contact",
    "hero.eyebrow":"13–15 November 2026 · Visakhapatnam, India","hero.subtitle":"A motorcycle trip, a Bumble coincidence, and a Telugu wedding by the coast.","hero.rsvp":"Submit RSVP","hero.travel":"Share Travel Plans",
    "count.days":"Days","count.hours":"Hours","count.minutes":"Minutes","count.seconds":"Seconds","story.eyebrow":"Our Story","story.title":"The Swipe That Almost Never Happened",
    "story.leipzig.title":"Leipzig","story.leipzig.text":"Jyothsna set Bumble to Leipzig only. Tobias lived in Berlin, but came to Leipzig on a motorcycle tour. Otherwise, they may never have seen each other.",
    "story.berlin.title":"Berlin","story.berlin.text":"After two weeks of phone calls, they met in Berlin. The plan was a motorcycle ride if they vibed. Instead, they spent the whole weekend together.",
    "story.bike.title":"Motorcycle Adventures","story.bike.text":"The first motorcycle trip came the following summer, turning a shared love for the road into one of their favourite memories.",
    "story.budapest.title":"Budapest","story.budapest.text":"On an island in the Danube, Tobias proposed with a diamond ring. When Jyothsna asked about their “diamonds are overrated” conversation, he said, “I think you are worth the diamonds.”",
    "guide.eyebrow":"For Our German Guests","guide.title":"First Time at an Indian Wedding?","guide.copy":"Here is a gentle introduction to what you will experience during our Telugu wedding celebrations.",
    "guide.haldi.title":"Haldi","guide.haldi.text":"A joyful turmeric ceremony full of laughter, blessings, music and yellow clothes.","guide.haldi.dress":"Dress code: Yellow / Gold",
    "guide.sangeeth.title":"Sangeeth","guide.sangeeth.text":"A festive evening with music, dancing, performances, food and celebration.","guide.sangeeth.dress":"Dress code: Festive Indian / Glam",
    "guide.wedding.title":"Telugu Wedding","guide.wedding.text":"A South Indian ceremony with rituals, blessings and the sacred tying of the knot.","guide.wedding.dress":"Dress code: Elegant traditional / formal",
    "guide.muhurtham.title":"Muhurtham","guide.muhurtham.text":"The exact auspicious moment for tying the knot is 10:12 PM on 15 November 2026.",
    "schedule.eyebrow":"Three Days in Vizag","schedule.title":"Wedding Schedule","schedule.day1.title":"Haldi & Sangeeth · Sai Priya Resort","schedule.day1.haldi":"Haldi starts","schedule.day1.sangeeth":"Sangeeth evening","schedule.day2.title":"Preparation Day","schedule.day2.text":"A smaller ceremony for getting the bride and groom ready in their respective places. Tobias' ceremony will be at Sai Priya Resort.","schedule.day3.title":"Wedding · Simba Resort","schedule.day3.reception":"Reception starts","schedule.day3.rituals":"Wedding rituals begin","schedule.day3.muhurtham":"Muhurtham / tying the knot",
    "common.map":"Open map","common.submit":"Submit","rsvp.title":"Confirm Your Attendance","travel.eyebrow":"Airport Pickup Planning","travel.title":"Share Your Travel Plans","travel.notice":"Vizag's new Bhogapuram airport is expected to open before the wedding. We will update recommendations once flights are clearer.",
    "stay.eyebrow":"Rooms & Logistics","stay.title":"Where Should I Stay?","stay.saipriya":"Recommended for Haldi and Sangeeth. Tell us if you want us to book rooms together.","stay.simba":"All 16 rooms are reserved for wedding day relaxing and getting ready between ceremonies.",
    "outfits.eyebrow":"Sarees, Lehengas & Measurements","outfits.title":"Outfit Selection","outfits.copy":"Choose your preferred outfit style and share measurements so Jyothsna can coordinate stitching in India.",
    "gallery.eyebrow":"Memories","gallery.title":"Gallery","gallery.copy":"Photo uploads will save to Google Drive after Apps Script setup.","gallery.upload":"Upload Photo",
    "faq.title":"Helpful Notes","faq.spicy.q":"Will the food be spicy?","faq.spicy.a":"There will be both mild and spicy options.","faq.cash.q":"Do I need cash?","faq.cash.a":"Some cash in Indian Rupees is useful for small purchases and tips.","faq.clothes.q":"Can I wear Western clothes?","faq.clothes.a":"Yes, but festive Indian clothes are warmly encouraged for the celebrations.",
    "contact.eyebrow":"Need Help?","contact.title":"Contact Us"
  },
  de: {
    "login.private":"Privates Hochzeitsportal","login.copy":"Bitte gib deinen Einladungscode ein, um das Hochzeitsportal zu öffnen.","login.code":"Einladungscode","login.enter":"Hochzeitsportal öffnen","login.note":"Dieses Portal ist nur für eingeladene Gäste.",
    "nav.story":"Geschichte","nav.guide":"Hochzeitsguide","nav.schedule":"Programm","nav.travel":"Reise","nav.stay":"Unterkunft","nav.outfits":"Outfits","nav.gallery":"Galerie","nav.contact":"Kontakt",
    "hero.eyebrow":"13.–15. November 2026 · Visakhapatnam, Indien","hero.subtitle":"Eine Motorradreise, ein Bumble-Zufall und eine Telugu-Hochzeit an der Küste.","hero.rsvp":"RSVP senden","hero.travel":"Reisepläne teilen",
    "count.days":"Tage","count.hours":"Stunden","count.minutes":"Minuten","count.seconds":"Sekunden","story.eyebrow":"Unsere Geschichte","story.title":"Der Swipe, der fast nie passiert wäre",
    "story.leipzig.title":"Leipzig","story.leipzig.text":"Jyothsna hatte Bumble nur auf Leipzig eingestellt. Tobias lebte in Berlin, war aber auf einer Motorradreise in Leipzig. Sonst hätten sie sich wahrscheinlich nie gesehen.",
    "story.berlin.title":"Berlin","story.berlin.text":"Nach zwei Wochen Telefonaten trafen sie sich in Berlin. Geplant war eine Motorradfahrt, falls es passt. Stattdessen verbrachten sie das ganze Wochenende zusammen.",
    "story.bike.title":"Motorradabenteuer","story.bike.text":"Im nächsten Sommer folgte die erste gemeinsame Motorradreise – eine ihrer schönsten Erinnerungen.",
    "story.budapest.title":"Budapest","story.budapest.text":"Auf einer Insel in der Donau machte Tobias den Antrag mit einem Diamantring. Als Jyothsna an ihr Gespräch über überschätzte Diamanten erinnerte, sagte er: „Ich finde, du bist die Diamanten wert.“",
    "guide.eyebrow":"Für unsere deutschen Gäste","guide.title":"Zum ersten Mal auf einer indischen Hochzeit?","guide.copy":"Hier ist eine einfache Einführung in das, was euch bei unserer Telugu-Hochzeit erwartet.",
    "guide.haldi.title":"Haldi","guide.haldi.text":"Eine fröhliche Zeremonie mit Kurkuma, Musik, Segen und gelber Kleidung.","guide.haldi.dress":"Dresscode: Gelb / Gold",
    "guide.sangeeth.title":"Sangeeth","guide.sangeeth.text":"Ein festlicher Abend mit Musik, Tanz, Auftritten, Essen und Feiern.","guide.sangeeth.dress":"Dresscode: Festlich indisch / Glamourös",
    "guide.wedding.title":"Telugu-Hochzeit","guide.wedding.text":"Eine südindische Zeremonie mit Ritualen, Segen und dem heiligen Knoten.","guide.wedding.dress":"Dresscode: Elegant traditionell / formell",
    "guide.muhurtham.title":"Muhurtham","guide.muhurtham.text":"Der wichtigste Moment der Zeremonie ist exakt um 22:12 Uhr am 15. November 2026.",
    "schedule.eyebrow":"Drei Tage in Vizag","schedule.title":"Hochzeitsprogramm","schedule.day1.title":"Haldi & Sangeeth · Sai Priya Resort","schedule.day1.haldi":"Haldi beginnt","schedule.day1.sangeeth":"Sangeeth-Abend","schedule.day2.title":"Vorbereitungstag","schedule.day2.text":"Eine kleinere Zeremonie, bei der Braut und Bräutigam vorbereitet werden. Tobias' Zeremonie findet im Sai Priya Resort statt.","schedule.day3.title":"Hochzeit · Simba Resort","schedule.day3.reception":"Empfang beginnt","schedule.day3.rituals":"Hochzeitsrituale beginnen","schedule.day3.muhurtham":"Muhurtham / heiliger Knoten",
    "common.map":"Karte öffnen","common.submit":"Absenden","rsvp.title":"Teilnahme bestätigen","travel.eyebrow":"Planung für Flughafentransfers","travel.title":"Teile deine Reisepläne","travel.notice":"Der neue Bhogapuram-Flughafen bei Vizag soll vor der Hochzeit öffnen. Wir aktualisieren Empfehlungen, sobald die Flugpläne klarer sind.",
    "stay.eyebrow":"Zimmer & Logistik","stay.title":"Wo soll ich übernachten?","stay.saipriya":"Empfohlen für Haldi und Sangeeth. Sag uns, ob wir Zimmer gemeinsam buchen sollen.","stay.simba":"Alle 16 Zimmer sind für den Hochzeitstag reserviert, um sich zwischen den Zeremonien auszuruhen und fertigzumachen.",
    "outfits.eyebrow":"Sarees, Lehengas & Maße","outfits.title":"Outfit-Auswahl","outfits.copy":"Wähle deinen bevorzugten Outfit-Stil und teile deine Maße, damit Jyothsna das Nähen in Indien koordinieren kann.",
    "gallery.eyebrow":"Erinnerungen","gallery.title":"Galerie","gallery.copy":"Foto-Uploads werden nach dem Apps-Script-Setup in Google Drive gespeichert.","gallery.upload":"Foto hochladen",
    "faq.title":"Hilfreiche Hinweise","faq.spicy.q":"Ist das Essen scharf?","faq.spicy.a":"Es wird milde und scharfe Optionen geben.","faq.cash.q":"Brauche ich Bargeld?","faq.cash.a":"Etwas Bargeld in indischen Rupien ist für kleine Einkäufe und Trinkgeld hilfreich.","faq.clothes.q":"Kann ich westliche Kleidung tragen?","faq.clothes.a":"Ja, aber festliche indische Kleidung ist sehr willkommen.",
    "contact.eyebrow":"Brauchst du Hilfe?","contact.title":"Kontakt"
  }
};

const defaultOutfits = [
  {id:"HALDI-01", event:"Haldi", title:"Yellow Saree", image:"https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80", description:"Elegant yellow saree inspiration for the Haldi ceremony."},
  {id:"SANGEETH-01", event:"Sangeeth", title:"Festive Lehenga", image:"https://images.unsplash.com/photo-1610173827043-62d0d4b42130?auto=format&fit=crop&w=900&q=80", description:"Glam festive look for dancing and evening celebration."},
  {id:"WEDDING-01", event:"Wedding", title:"Silk Saree", image:"https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=900&q=80", description:"Traditional South Indian wedding guest look."}
];

let currentGuest = null;

function translate(lang){
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if(translations[lang] && translations[lang][key]) el.textContent = translations[lang][key];
  });
  localStorage.setItem("weddingLang", lang);
}

async function api(action, payload = {}){
  if(!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl.includes("PASTE_YOUR")){
    if(action === "login"){
      return {success: CONFIG.demoCodes.includes(String(payload.code || "").trim().toUpperCase()), guest:{code:payload.code, name:"Demo Guest", group:"Demo"}};
    }
    return {success:true, demo:true};
  }
  const res = await fetch(CONFIG.appsScriptUrl, {method:"POST", body: JSON.stringify({action, ...payload})});
  return res.json();
}

function unlockApp(guest){
  currentGuest = guest;
  sessionStorage.setItem("weddingGuest", JSON.stringify(guest));
  document.getElementById("login-screen").style.display = "none";
  const app = document.getElementById("app");
  app.classList.remove("locked");
  app.setAttribute("aria-hidden", "false");
}

function setupLogin(){
  const saved = sessionStorage.getItem("weddingGuest");
  if(saved) unlockApp(JSON.parse(saved));
  document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const code = document.getElementById("invite-code").value.trim().toUpperCase();
    const msg = document.getElementById("login-message");
    msg.textContent = "Checking code...";
    try{
      const data = await api("login", {code});
      if(data.success){ unlockApp(data.guest || {code}); }
      else msg.textContent = "Sorry, this invitation code was not found.";
    } catch(err){ msg.textContent = "Login failed. Please try again."; }
  });
}

function setupCountdown(){
  const target = new Date(CONFIG.weddingDate).getTime();
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("days").textContent = d;
    document.getElementById("hours").textContent = h;
    document.getElementById("minutes").textContent = m;
    document.getElementById("seconds").textContent = s;
  };
  tick(); setInterval(tick, 1000);
}

function formToObject(form){
  const obj = {};
  new FormData(form).forEach((value, key) => obj[key] = value);
  if(currentGuest) obj.invitationCode = currentGuest.code;
  return obj;
}

function setupForms(){
  document.querySelectorAll("form[data-form]").forEach(form => {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const type = form.dataset.form;
      const msg = form.querySelector(".form-message");
      msg.textContent = "Submitting...";
      try{
        if(type === "photoUpload"){
          const file = form.querySelector('input[type="file"]').files[0];
          if(file){
            const base64 = await fileToBase64(file);
            const payload = formToObject(form);
            payload.fileName = file.name; payload.mimeType = file.type; payload.fileData = base64.split(',')[1];
            await api("photoUpload", payload);
          }
        } else {
          await api(type, formToObject(form));
        }
        msg.textContent = "Thank you! Your information has been saved.";
        form.reset();
      } catch(err){ msg.textContent = "Something went wrong. Please try again or message Jyothsna."; }
    });
  });
}

function fileToBase64(file){
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
}

function renderOutfits(outfits = defaultOutfits){
  const grid = document.getElementById("outfit-grid");
  grid.innerHTML = outfits.map(o => `<article class="outfit-card"><img src="${o.image}" alt="${o.title}"><span class="tag">${o.event}</span><h3>${o.title}</h3><p>${o.description}</p><b>${o.id}</b></article>`).join("");
}

async function loadDynamicData(){
  renderOutfits(defaultOutfits);
  try{
    const data = await api("getOutfits", {});
    if(data.success && Array.isArray(data.outfits) && data.outfits.length) renderOutfits(data.outfits);
  }catch(e){}
}

function setupNav(){
  document.getElementById("mobile-menu-btn").addEventListener("click", () => document.getElementById("nav-links").classList.toggle("open"));
  document.querySelectorAll(".nav-links a").forEach(a => a.addEventListener("click", () => document.getElementById("nav-links").classList.remove("open")));
}

function init(){
  const lang = localStorage.getItem("weddingLang") || "en";
  document.getElementById("language-select").value = lang; translate(lang);
  document.getElementById("language-select").addEventListener("change", e => translate(e.target.value));
  setupLogin(); setupCountdown(); setupForms(); setupNav(); loadDynamicData();
}

document.addEventListener("DOMContentLoaded", init);
