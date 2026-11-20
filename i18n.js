(function (root) {
  "use strict";

  const STORAGE_KEY = "qr-tisk-lang";
  const SUPPORTED = ["cs", "en"];
  const listeners = [];
  let lang = "cs";

  function czechPlural(count, one, few, many) {
    if (count === 1) return one;
    if (count >= 2 && count <= 4) return few;
    return many;
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB", { maximumFractionDigits: 1 }).format(number);
  }

  const MESSAGES = {
    cs: {
      "meta.title": "QR tisk — QR kódy na A4 PDF",
      "meta.description": "Vytvořte QR kódy na míru a stáhněte je jako PDF ve formátu A4. Vše funguje lokálně ve vašem prohlížeči.",

      "brand.name": "QR tisk",
      "brand.homeTitle": "Zpět na začátek",
      "header.privacy": "Data zůstávají v prohlížeči",
      "header.install": "Nainstalovat",
      "header.github": "Otevřít repozitář na GitHubu",
      "lang.group": "Jazyk rozhraní",
      "history.undo": "Zpět",
      "history.redo": "Znovu",
      "history.undoTitle": "Vrátit poslední změnu (Ctrl+Z)",
      "history.redoTitle": "Opakovat změnu (Ctrl+Y)",

      "intro.eyebrow": "Jednoduše z textu na papír",
      "intro.title": "QR kódy přesně na míru.",
      "intro.copy": "Vložte odkazy, zvolte rozměry v milimetrech a stáhněte si PDF připravené k tisku na A4.",
      "intro.saveNote": "Rozepsané kódy se ukládají v tomto zařízení",

      "input.title": "Vložte odkazy nebo texty",
      "input.desc": "Každý řádek vytvoří samostatný QR kód.",
      "input.ariaLabel": "Odkazy nebo texty pro QR kódy",
      "input.placeholder": "https://priklad.cz/prvni-odkaz,\nhttps://priklad.cz/druhy-odkaz",
      "input.splitCommas": "Oddělovat také čárkami",
      "input.newQr": "Nový QR",
      "input.add": "Přidat QR kódy",
      "input.hint": "Čárky uvnitř již vytvořeného textu zůstanou zachovány.",

      "items.title": "Upravte QR kódy",
      "items.clear": "Vymazat vše",
      "items.emptyTitle": "Zatím tu není žádný QR kód",
      "items.emptyText": "Vložte výše jeden nebo více textů a stiskněte „Přidat QR kódy“.",

      "preview.eyebrow": "Výstup pro tisk",
      "preview.title": "Náhled A4",
      "preview.paperAria": "Náhled stránky A4",
      "preview.previous": "Předchozí stránka",
      "preview.next": "Další stránka",
      "preview.pageBadge": (count) => `${count} ${czechPlural(count, "stránka", "stránky", "stránek")}`,
      "preview.pageIndicator": (current, total) => `Stránka ${current} / ${total}`,
      "preview.pageIndicatorEmpty": "Stránka 0 / 0",
      "preview.paperEmpty": "Zde se objeví náhled<br>vašich QR kódů",
      "preview.settings": "Nastavení stránky",
      "preview.margin": "Okraj",
      "preview.gaps": "Mezery",
      "preview.labels": "Popisky",
      "preview.addFirst": "Přidejte alespoň jeden QR kód",
      "preview.summaryPending": "Dokončuji náhled QR kódů…",
      "preview.summaryErrors": "Před exportem opravte označené položky",
      "preview.summaryReady": (codes, pages) => `${codes} ${czechPlural(codes, "QR kód", "QR kódy", "QR kódů")} · ${pages} × A4 · přesné rozměry v mm`,
      "preview.download": "Stáhnout A4 PDF",
      "preview.downloading": "Vytvářím PDF…",
      "preview.printNote": "Při tisku PDF zvolte <strong>„Skutečná velikost“ / 100 %</strong>, aby rozměry seděly.",

      "style.title": "Vzhled QR kódů",
      "style.foreground": "Barva kódu",
      "style.background": "Pozadí",
      "style.shape": "Tvar modulů",
      "style.shapeSquare": "Čtverce",
      "style.shapeRounded": "Zaoblené",
      "style.shapeDots": "Tečky",
      "style.logoUpload": "Nahrát logo",
      "style.logoRemove": "Odebrat",
      "style.logoHint": "Logo zvětší korekci chyb na H. Doporučujeme otestovat skenování.",
      "style.contrastWarning": "Nízký kontrast mezi kódem a pozadím může zhoršit skenování.",
      "style.reset": "Obnovit výchozí",

      "footer.tagline": "Žádné účty. Žádné odesílání textů na server.",

      "card.title": (number) => `QR kód ${number}`,
      "card.type": "Typ obsahu",
      "card.textLabel": "Text nebo URL",
      "card.size": "Velikost",
      "card.label": "Popisek (nepovinný)",
      "card.labelPlaceholder": "Např. Sdílená složka",
      "card.applyAll": "Rozměr pro všechny",
      "card.duplicateAria": (number) => `Duplikovat QR kód ${number}`,
      "card.deleteAria": (number) => `Odstranit QR kód ${number}`,
      "card.duplicateAriaGeneric": "Duplikovat QR kód",
      "card.deleteAriaGeneric": "Odstranit QR kód",
      "card.duplicateTitle": "Duplikovat",
      "card.deleteTitle": "Odstranit",
      "card.ready": "Připraveno",
      "card.generating": "Vytvářím…",
      "card.error": "Chyba",
      "card.alt": (text) => `Náhled QR kódu: ${text}`,

      "type.text": "Text",
      "type.url": "URL",
      "type.wifi": "Wi-Fi",
      "type.vcard": "Kontakt",
      "type.email": "E-mail",
      "type.sms": "SMS",
      "type.phone": "Telefon",
      "type.geo": "Poloha",
      "type.event": "Událost",

      "field.text": "Text nebo URL",
      "field.url": "Odkaz",
      "field.urlPlaceholder": "https://example.com",
      "field.ssid": "Název sítě (SSID)",
      "field.password": "Heslo",
      "field.security": "Zabezpečení",
      "field.securityWpa": "WPA/WPA2",
      "field.securityWep": "WEP",
      "field.securityNone": "Bez hesla",
      "field.hiddenNetwork": "Skrytá síť",
      "field.name": "Jméno a příjmení",
      "field.company": "Firma",
      "field.phone": "Telefon",
      "field.email": "E-mail",
      "field.website": "Web",
      "field.emailTo": "Komu (e-mail)",
      "field.subject": "Předmět",
      "field.body": "Zpráva",
      "field.phoneNumber": "Telefonní číslo",
      "field.smsMessage": "Text zprávy",
      "field.latitude": "Zeměpisná šířka",
      "field.latitudePlaceholder": "např. 50.087",
      "field.longitude": "Zeměpisná délka",
      "field.longitudePlaceholder": "např. 14.421",
      "field.eventTitle": "Název události",
      "field.location": "Místo",
      "field.start": "Začátek",
      "field.end": "Konec (nepovinný)",
      "field.description": "Popis",

      "error.emptyText": "Doplňte text nebo adresu pro tento QR kód.",
      "error.libraryMissing": "Knihovna pro QR kódy není načtená.",
      "error.tooLong": "Text je příliš dlouhý pro jeden QR kód. Zkraťte ho nebo ho rozdělte.",
      "error.generic": "QR kód se nepodařilo vytvořit. Zkontrolujte text a zkuste to znovu.",
      "error.pdfFailed": "PDF se nepodařilo vytvořit. Zkuste to prosím znovu.",
      "error.required": "Vyplňte prosím povinná pole.",
      "error.invalidUrl": "Zadejte platnou adresu začínající http:// nebo https://.",
      "error.invalidEmail": "Zadejte platnou e-mailovou adresu.",
      "error.invalidPhone": "Zadejte platné telefonní číslo.",
      "error.invalidGeo": "Zadejte platnou zeměpisnou šířku a délku.",
      "error.invalidEventDates": "Konec události musí být po jejím začátku.",

      "toast.emptyInput": "Nejprve vložte alespoň jeden odkaz nebo text.",
      "toast.invalidSize": "Nejprve zadejte platnou velikost od 10 do 200 mm.",
      "toast.appliedSize": (size) => `Všechny QR kódy mají nyní velikost ${formatNumber(size)} mm.`,
      "toast.duplicated": "QR kód byl duplikován.",
      "toast.added": (count) => `${count === 1 ? "Přidán" : "Přidáno"} ${count} ${czechPlural(count, "QR kód", "QR kódy", "QR kódů")}.`,
      "toast.cleared": "Všechny QR kódy byly odstraněny.",
      "toast.installed": "Aplikace byla nainstalována.",
      "toast.logoAdded": "Logo bylo přidáno.",
      "toast.logoRemoved": "Logo bylo odebráno.",
      "toast.logoError": "Logo se nepodařilo načíst. Zkuste menší obrázek (PNG, JPG nebo SVG).",
      "toast.pdfDone": (codes, pages) => `PDF je hotové: ${codes} ${czechPlural(codes, "QR kód", "QR kódy", "QR kódů")} na ${pages} ${czechPlural(pages, "stránce", "stránkách", "stránkách")}.`,

      "confirm.clear": "Opravdu chcete odstranit všechny QR kódy? Nastavení stránky zůstane zachováno.",

      "layout.invalidMargin": "Zadaný okraj stránky není platný.",
      "layout.invalidSize": (params) => `QR kód ${params.index} nemá platnou velikost.`,
      "layout.tooLarge": (params) => `QR kód ${params.index} se při tomto okraji na A4 nevejde. Největší možná velikost je přibližně ${formatNumber(params.maximum)} mm.`,
      "layout.generic": "Rozmístění se nepodařilo vypočítat.",

      "pdf.title": "QR kódy na A4",
      "pdf.subject": "QR kódy s přesnými rozměry v milimetrech",
      "pdf.filename": (date) => `qr-kody-${date}.pdf`,
    },

    en: {
      "meta.title": "QR Print — QR codes on A4 PDF",
      "meta.description": "Create custom QR codes and download them as an A4 PDF. Everything runs locally in your browser.",

      "brand.name": "QR Print",
      "brand.homeTitle": "Back to start",
      "header.privacy": "Data stays in your browser",
      "header.install": "Install",
      "header.github": "Open GitHub repository",
      "lang.group": "Interface language",
      "history.undo": "Undo",
      "history.redo": "Redo",
      "history.undoTitle": "Undo last change (Ctrl+Z)",
      "history.redoTitle": "Redo change (Ctrl+Y)",

      "intro.eyebrow": "From text to paper, simply",
      "intro.title": "QR codes, precisely sized.",
      "intro.copy": "Paste links, choose dimensions in millimetres and download a PDF ready to print on A4.",
      "intro.saveNote": "Drafts are saved on this device",

      "input.title": "Paste links or text",
      "input.desc": "Each line creates a separate QR code.",
      "input.ariaLabel": "Links or text for QR codes",
      "input.placeholder": "https://example.com/first-link,\nhttps://example.com/second-link",
      "input.splitCommas": "Also split on commas",
      "input.newQr": "New QR",
      "input.add": "Add QR codes",
      "input.hint": "Commas inside the text of an existing code are preserved.",

      "items.title": "Edit QR codes",
      "items.clear": "Clear all",
      "items.emptyTitle": "No QR codes yet",
      "items.emptyText": "Paste one or more texts above and click “Add QR codes”.",

      "preview.eyebrow": "Print output",
      "preview.title": "A4 preview",
      "preview.paperAria": "A4 page preview",
      "preview.previous": "Previous page",
      "preview.next": "Next page",
      "preview.pageBadge": (count) => `${count} ${count === 1 ? "page" : "pages"}`,
      "preview.pageIndicator": (current, total) => `Page ${current} / ${total}`,
      "preview.pageIndicatorEmpty": "Page 0 / 0",
      "preview.paperEmpty": "Your QR codes will appear<br>here",
      "preview.settings": "Page settings",
      "preview.margin": "Margin",
      "preview.gaps": "Gaps",
      "preview.labels": "Labels",
      "preview.addFirst": "Add at least one QR code",
      "preview.summaryPending": "Finishing QR code previews…",
      "preview.summaryErrors": "Fix the highlighted items before exporting",
      "preview.summaryReady": (codes, pages) => `${codes} ${codes === 1 ? "QR code" : "QR codes"} · ${pages} × A4 · exact dimensions in mm`,
      "preview.download": "Download A4 PDF",
      "preview.downloading": "Creating PDF…",
      "preview.printNote": "When printing the PDF choose <strong>“Actual size” / 100%</strong> so the dimensions match.",

      "style.title": "QR code style",
      "style.foreground": "Code color",
      "style.background": "Background",
      "style.shape": "Module shape",
      "style.shapeSquare": "Squares",
      "style.shapeRounded": "Rounded",
      "style.shapeDots": "Dots",
      "style.logoUpload": "Upload logo",
      "style.logoRemove": "Remove",
      "style.logoHint": "Adding a logo raises error correction to H. Test scanning before printing.",
      "style.contrastWarning": "Low contrast between the code and background can make scanning unreliable.",
      "style.reset": "Reset defaults",

      "footer.tagline": "No accounts. No text sent to a server.",

      "card.title": (number) => `QR code ${number}`,
      "card.type": "Content type",
      "card.textLabel": "Text or URL",
      "card.size": "Size",
      "card.label": "Label (optional)",
      "card.labelPlaceholder": "E.g. Shared folder",
      "card.applyAll": "Apply size to all",
      "card.duplicateAria": (number) => `Duplicate QR code ${number}`,
      "card.deleteAria": (number) => `Delete QR code ${number}`,
      "card.duplicateAriaGeneric": "Duplicate QR code",
      "card.deleteAriaGeneric": "Delete QR code",
      "card.duplicateTitle": "Duplicate",
      "card.deleteTitle": "Delete",
      "card.ready": "Ready",
      "card.generating": "Generating…",
      "card.error": "Error",
      "card.alt": (text) => `QR code preview: ${text}`,

      "type.text": "Text",
      "type.url": "URL",
      "type.wifi": "Wi-Fi",
      "type.vcard": "Contact",
      "type.email": "Email",
      "type.sms": "SMS",
      "type.phone": "Phone",
      "type.geo": "Location",
      "type.event": "Event",

      "field.text": "Text or URL",
      "field.url": "Link",
      "field.urlPlaceholder": "https://example.com",
      "field.ssid": "Network name (SSID)",
      "field.password": "Password",
      "field.security": "Security",
      "field.securityWpa": "WPA/WPA2",
      "field.securityWep": "WEP",
      "field.securityNone": "No password",
      "field.hiddenNetwork": "Hidden network",
      "field.name": "Full name",
      "field.company": "Company",
      "field.phone": "Phone",
      "field.email": "Email",
      "field.website": "Website",
      "field.emailTo": "To (email)",
      "field.subject": "Subject",
      "field.body": "Message",
      "field.phoneNumber": "Phone number",
      "field.smsMessage": "Message text",
      "field.latitude": "Latitude",
      "field.latitudePlaceholder": "e.g. 50.087",
      "field.longitude": "Longitude",
      "field.longitudePlaceholder": "e.g. 14.421",
      "field.eventTitle": "Event title",
      "field.location": "Location",
      "field.start": "Starts",
      "field.end": "Ends (optional)",
      "field.description": "Description",

      "error.emptyText": "Add text or a URL for this QR code.",
      "error.libraryMissing": "The QR code library is not loaded.",
      "error.tooLong": "The text is too long for one QR code. Shorten or split it.",
      "error.generic": "The QR code could not be created. Check the text and try again.",
      "error.pdfFailed": "The PDF could not be created. Please try again.",
      "error.required": "Please fill in the required fields.",
      "error.invalidUrl": "Enter a valid URL starting with http:// or https://.",
      "error.invalidEmail": "Enter a valid email address.",
      "error.invalidPhone": "Enter a valid phone number.",
      "error.invalidGeo": "Enter a valid latitude and longitude.",
      "error.invalidEventDates": "The event end must be after its start.",

      "toast.emptyInput": "Paste at least one link or text first.",
      "toast.invalidSize": "Enter a valid size between 10 and 200 mm first.",
      "toast.appliedSize": (size) => `All QR codes are now ${formatNumber(size)} mm.`,
      "toast.duplicated": "QR code duplicated.",
      "toast.added": (count) => `${count} ${count === 1 ? "QR code" : "QR codes"} added.`,
      "toast.cleared": "All QR codes were removed.",
      "toast.installed": "The app has been installed.",
      "toast.logoAdded": "Logo added.",
      "toast.logoRemoved": "Logo removed.",
      "toast.logoError": "The logo could not be loaded. Try a smaller image (PNG, JPG or SVG).",
      "toast.pdfDone": (codes, pages) => `PDF is ready: ${codes} ${codes === 1 ? "QR code" : "QR codes"} on ${pages} ${pages === 1 ? "page" : "pages"}.`,

      "confirm.clear": "Remove all QR codes? Page settings will be kept.",

      "layout.invalidMargin": "The page margin is not valid.",
      "layout.invalidSize": (params) => `QR code ${params.index} has an invalid size.`,
      "layout.tooLarge": (params) => `QR code ${params.index} does not fit on A4 with this margin. The maximum size is about ${formatNumber(params.maximum)} mm.`,
      "layout.generic": "The layout could not be calculated.",

      "pdf.title": "QR codes on A4",
      "pdf.subject": "QR codes with exact dimensions in millimetres",
      "pdf.filename": (date) => `qr-codes-${date}.pdf`,
    },
  };

  function t(key, ...args) {
    const dictionary = MESSAGES[lang] || MESSAGES.cs;
    const value = Object.prototype.hasOwnProperty.call(dictionary, key)
      ? dictionary[key]
      : MESSAGES.cs[key];
    if (value === undefined) return key;
    return typeof value === "function" ? value(...args) : value;
  }

  function apply(rootNode) {
    const scope = rootNode || document;

    scope.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((element) => {
      element.innerHTML = t(element.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", t(element.getAttribute("data-i18n-title")));
    });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.getAttribute("data-i18n-aria-label")));
    });
    scope.querySelectorAll("[data-i18n-content]").forEach((element) => {
      element.setAttribute("content", t(element.getAttribute("data-i18n-content")));
    });

    if (!rootNode) {
      document.title = t("meta.title");
      updateSwitcher();
    }
  }

  function updateSwitcher() {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-lang") === lang));
    });
  }

  function readStoredLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(stored) ? stored : "";
    } catch (error) {
      return "";
    }
  }

  function detectLang() {
    const fromUrl = new URLSearchParams(root.location.search).get("lang");
    if (SUPPORTED.includes(fromUrl)) return fromUrl;

    const stored = readStoredLang();
    if (stored) return stored;

    const preferred = String(root.navigator.language || "").toLowerCase();
    return preferred.startsWith("cs") || preferred.startsWith("sk") ? "cs" : "en";
  }

  function setLang(nextLang, options) {
    const normalized = SUPPORTED.includes(nextLang) ? nextLang : "cs";
    if (normalized !== lang) lang = normalized;
    document.documentElement.lang = lang;

    if (!options || options.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (error) {
        /* Local storage can be unavailable; the switch still works for this visit. */
      }
    }

    apply();
    listeners.forEach((listener) => {
      try {
        listener(lang);
      } catch (error) {
        console.error("Language change handler failed.", error);
      }
    });
    return lang;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    setLang(button.getAttribute("data-lang"));
  });

  lang = detectLang();
  document.documentElement.lang = lang;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply());
  } else {
    apply();
  }

  root.QRAppI18n = {
    get lang() { return lang; },
    supported: SUPPORTED.slice(),
    t,
    apply,
    setLang,
    formatNumber,
    onChange(listener) {
      if (typeof listener === "function") listeners.push(listener);
    },
  };
})(window);
