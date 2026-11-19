# QR tisk

Jednoduchá webová aplikace pro tvorbu QR kódů s přesnými rozměry a jejich export do PDF ve formátu A4. Funguje kompletně v prohlížeči; vložené texty se nikam neodesílají.

## Co aplikace umí

- vložit více odkazů nebo textů najednou, oddělených řádky nebo čárkami,
- nastavit výchozí velikost nového QR kódu (přednastaveno 30 × 30 mm),
- upravit text, velikost a volitelný popisek zvlášť u každého QR kódu,
- zkopírovat velikost jedné položky na všechny ostatní,
- automaticky rozmístit různě velké QR kódy do řádků na A4,
- nastavit okraj stránky a mezery mezi kódy,
- procházet náhledem všech vytvořených stránek,
- stáhnout A4 PDF s rozměry zadanými přímo v milimetrech,
- přepínat rozhraní mezi češtinou a angličtinou; volba se pamatuje,
- uložit rozepsanou práci lokálně v prohlížeči,
- po spuštění přes HTTP/HTTPS fungovat offline a nabídnout instalaci jako aplikaci.

## Jazyk rozhraní

V hlavičce je přepínač **CS / EN**. Výchozí jazyk se vybere podle jazyka prohlížeče. Jazyk lze vynutit i parametrem adresy:

- `?lang=cs` — čeština,
- `?lang=en` — angličtina.

## Spuštění na počítači

Nejrychlejší způsob je otevřít soubor **`index.html`** dvojklikem v aktuálním Chromu, Edge, Firefoxu nebo Safári. Není potřeba Node.js ani instalace balíčků. QR kódy i PDF fungují i při tomto způsobu spuštění.

Pro instalaci jako aplikace a offline režim spusťte v této složce například:

```bat
py -m http.server 8080
```

Poté otevřete [http://localhost:8080](http://localhost:8080).

## Nasazení na GitHub Pages a vlastní doménu

Aplikace je čistě statická, nepotřebuje build ani serverovou část.

1. Nahrajte obsah tohoto repozitáře do větve `main`.
2. V nastavení repozitáře otevřete **Settings → Pages**.
3. U položky **Source** zvolte **Deploy from a branch**, větev `main` a složku `/(root)`.
4. Aplikace bude dostupná na adrese `https://<uživatel>.github.io/<repozitář>/`.
5. Pro vlastní doménu vyplňte v **Settings → Pages → Custom domain** svou doménu a v DNS:
   - u subdomény (např. `qr.example.com`) vytvořte `CNAME` záznam mířící na `<uživatel>.github.io`,
   - u kořenové domény (např. `example.com`) použijte `A` záznamy GitHub Pages.
6. Zapněte **Enforce HTTPS**.

Soubor `CNAME` si GitHub Pages vytvoří sám. Offline režim a instalace aplikace vyžadují HTTPS.

## Použití v Androidu

Aplikaci stačí nahrát na libovolný statický hosting s HTTPS (například GitHub Pages, Cloudflare Pages nebo Netlify). Poté:

1. Otevřete adresu aplikace v Chromu.
2. Z menu prohlížeče zvolte **Přidat na plochu** nebo **Nainstalovat aplikaci**.
3. Po prvním načtení jsou potřebné soubory uloženy i pro použití offline.

## Tisk ve správné velikosti

PDF má skutečnou velikost A4, tedy **210 × 297 mm**. V dialogu tiskárny zvolte:

- **Skutečná velikost**, případně měřítko **100 %**,
- nepoužívat „Přizpůsobit stránce“ ani automatické zvětšení/zmenšení.

Tichá zóna kolem QR kódu je součástí zadaného čtvercového rozměru.

## Struktura

- `index.html` — rozhraní aplikace,
- `styles.css` — responzivní vzhled,
- `i18n.js` — české a anglické texty a přepínač jazyka,
- `app.js` — QR kódy, náhled, lokální ukládání a PDF export,
- `utils.js` — dělení vstupu a výpočet rozložení na A4,
- `vendor/` — lokálně uložené knihovny node-qrcode a jsPDF,
- `manifest.webmanifest`, `service-worker.js` — instalace a offline režim.

Licence zapouzdřených knihoven jsou uvedeny v `THIRD_PARTY_NOTICES.md` a složce `vendor`.

## English

QR Print is a static, browser-only QR code generator with exact millimetre sizes and A4 PDF export. Nothing you type is sent to a server. Use the **CS / EN** switch in the header to change the interface language; the choice is remembered and can also be forced with `?lang=cs` or `?lang=en`.

To deploy, upload the repository contents to any static host (GitHub Pages works without a build step). Enable HTTPS to keep offline mode and PWA installation available.
