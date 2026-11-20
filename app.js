(function () {
  "use strict";

  const utils = window.QRAppUtils;
  const content = window.QRContent;
  const i18n = window.QRAppI18n;
  const renderer = window.QRAppQrRender;
  const t = (key, ...args) => i18n.t(key, ...args);
  const STORAGE_KEY = "qr-tisk-state-v1";
  const QR_IMAGE_SIZE = 512;
  const HISTORY_LIMIT = 60;
  const EDIT_BURST_MS = 700;
  const DEFAULT_STYLE = Object.freeze({
    foreground: "#111714",
    background: "#ffffff",
    shape: "square",
    logo: "",
  });

  const elements = {
    bulkInput: document.getElementById("bulk-input"),
    splitCommas: document.getElementById("split-commas"),
    defaultSize: document.getElementById("default-size"),
    addButton: document.getElementById("add-button"),
    clearButton: document.getElementById("clear-button"),
    itemCount: document.getElementById("item-count"),
    itemsList: document.getElementById("items-list"),
    emptyState: document.getElementById("empty-state"),
    cardTemplate: document.getElementById("qr-card-template"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),
    pageIndicator: document.getElementById("page-indicator"),
    pageBadge: document.getElementById("page-badge"),
    placements: document.getElementById("placements"),
    paperEmpty: document.getElementById("paper-empty"),
    layoutError: document.getElementById("layout-error"),
    pageMargin: document.getElementById("page-margin"),
    itemGap: document.getElementById("item-gap"),
    showLabels: document.getElementById("show-labels"),
    exportSummary: document.getElementById("export-summary"),
    downloadButton: document.getElementById("download-button"),
    installButton: document.getElementById("install-button"),
    toast: document.getElementById("toast"),
    undoButton: document.getElementById("undo-button"),
    redoButton: document.getElementById("redo-button"),
    foreground: document.getElementById("qr-foreground"),
    background: document.getElementById("qr-background"),
    shape: document.getElementById("qr-shape"),
    logoInput: document.getElementById("logo-input"),
    logoUpload: document.getElementById("logo-upload-button"),
    logoRemove: document.getElementById("logo-remove-button"),
    logoPreview: document.getElementById("logo-preview"),
    contrastWarning: document.getElementById("contrast-warning"),
    styleReset: document.getElementById("style-reset"),
  };

  let state = loadState();
  let laidOutPages = [];
  let currentPage = 0;
  let toastTimer = null;
  let installPrompt = null;
  let exporting = false;
  const history = { past: [], future: [] };
  let editBurstTimer = null;
  let styleTimer = null;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `qr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeStyle(saved) {
    const source = saved && typeof saved === "object" ? saved : {};
    return {
      foreground: renderer.normalizeColor(source.foreground, DEFAULT_STYLE.foreground),
      background: renderer.normalizeColor(source.background, DEFAULT_STYLE.background),
      shape: renderer.SHAPES.includes(source.shape) ? source.shape : DEFAULT_STYLE.shape,
      logo: typeof source.logo === "string" && /^data:image\//.test(source.logo) ? source.logo : "",
    };
  }

  function reviveItem(saved) {
    const type = content.isType(saved && saved.type) ? saved.type : "text";
    const data = content.normalize(type, saved && saved.data, saved && saved.text);
    return {
      id: saved && typeof saved.id === "string" ? saved.id : createId(),
      type,
      data,
      text: content.encode(type, data),
      size: utils.clamp(saved && saved.size, 10, 200, 30),
      label: saved && typeof saved.label === "string" ? saved.label.slice(0, 100) : "",
      image: "",
      error: "",
      fieldError: "",
      generating: false,
      generation: 0,
    };
  }

  function loadState() {
    const fallback = {
      defaultSize: 30,
      splitCommas: true,
      margin: 10,
      gap: 8,
      showLabels: true,
      bulkText: "",
      style: { ...DEFAULT_STYLE },
      items: [],
    };

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return fallback;

      return {
        defaultSize: utils.clamp(saved.defaultSize, 10, 200, fallback.defaultSize),
        splitCommas: saved.splitCommas !== false,
        margin: utils.clamp(saved.margin, 0, 50, fallback.margin),
        gap: utils.clamp(saved.gap, 0, 50, fallback.gap),
        showLabels: saved.showLabels !== false,
        bulkText: typeof saved.bulkText === "string" ? saved.bulkText : "",
        style: normalizeStyle(saved.style),
        items: Array.isArray(saved.items)
          ? saved.items.slice(0, 500).filter((item) => item && typeof item === "object" && (typeof item.text === "string" || (item.data && typeof item.data === "object"))).map(reviveItem)
          : [],
      };
    } catch (error) {
      console.warn("Uložená data se nepodařilo načíst.", error);
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        defaultSize: state.defaultSize,
        splitCommas: state.splitCommas,
        margin: state.margin,
        gap: state.gap,
        showLabels: state.showLabels,
        bulkText: state.bulkText,
        style: state.style,
        items: state.items.map((item) => ({
          id: item.id,
          type: item.type,
          data: item.data,
          text: item.text,
          size: item.size,
          label: item.label,
        })),
      }));
    } catch (error) {
      console.warn("Změny se nepodařilo uložit lokálně.", error);
    }
  }

  function showToast(message, isError) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", Boolean(isError));
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3600);
  }

  /* ---------- History ---------- */

  function snapshotItems() {
    return state.items.map((item) => ({
      id: item.id,
      type: item.type,
      data: { ...item.data },
      text: item.text,
      size: item.size,
      label: item.label,
    }));
  }

  function updateHistoryButtons() {
    elements.undoButton.disabled = history.past.length === 0;
    elements.redoButton.disabled = history.future.length === 0;
  }

  function pushHistory() {
    if (editBurstTimer) {
      window.clearTimeout(editBurstTimer);
      editBurstTimer = null;
    }

    const snapshot = snapshotItems();
    const last = history.past[history.past.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snapshot)) {
      history.future = [];
      updateHistoryButtons();
      return;
    }

    history.past.push(snapshot);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future = [];
    updateHistoryButtons();
  }

  function noteEdit(force) {
    if (editBurstTimer) {
      window.clearTimeout(editBurstTimer);
      if (force) pushHistory();
    } else {
      pushHistory();
    }
    editBurstTimer = window.setTimeout(() => {
      editBurstTimer = null;
    }, EDIT_BURST_MS);
  }

  function restoreItems(snapshot) {
    state.items.forEach((item) => {
      window.clearTimeout(item.editTimer);
      item.generation += 1;
    });
    state.items = snapshot.map(reviveItem);
    window.clearTimeout(editBurstTimer);
    editBurstTimer = null;

    renderItems();
    updatePreview();
    saveState();
    Promise.allSettled(state.items.map((item) => generateQr(item)));
  }

  function undo() {
    if (!history.past.length) return;
    history.future.push(snapshotItems());
    if (history.future.length > HISTORY_LIMIT) history.future.shift();
    restoreItems(history.past.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!history.future.length) return;
    history.past.push(snapshotItems());
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    restoreItems(history.future.pop());
    updateHistoryButtons();
  }

  /* ---------- Item state ---------- */

  function findCard(item) {
    return Array.from(elements.itemsList.children).find((card) => card.dataset.id === item.id) || null;
  }

  function applyCardState(card, item) {
    const status = card.querySelector(".qr-status");
    const image = card.querySelector(".item-qr-image");
    const error = card.querySelector(".item-error");

    status.classList.toggle("error", Boolean(item.error));
    status.textContent = item.error ? t("card.error") : item.generating ? t("card.generating") : item.image ? t("card.ready") : "";

    if (item.image) image.src = item.image;
    else image.removeAttribute("src");
    image.alt = item.image ? t("card.alt", item.label || (item.text || "").split("\n")[0]) : "";

    card.classList.toggle("has-error", Boolean(item.error) || Boolean(item.fieldError));
    error.classList.toggle("hidden", !item.error);
    error.textContent = item.error ? t(`error.${item.error}`) : "";

    card.querySelectorAll("[data-field]").forEach((control) => {
      const invalid = Boolean(item.fieldError) && control.getAttribute("data-field") === item.fieldError;
      control.classList.toggle("invalid", invalid);
      if (invalid) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    });
  }

  function updateCardState(item) {
    const card = findCard(item);
    if (card) applyCardState(card, item);
  }

  function updateNumbers() {
    Array.from(elements.itemsList.children).forEach((card, index) => {
      card.querySelector(".qr-card-title").textContent = t("card.title", index + 1);
      const item = state.items.find((entry) => entry.id === card.dataset.id);
      if (item) {
        card.querySelector(".delete-button").setAttribute("aria-label", t("card.deleteAria", index + 1));
        card.querySelector(".duplicate-button").setAttribute("aria-label", t("card.duplicateAria", index + 1));
      }
    });
  }

  function validateItem(item) {
    const problem = content.validate(item.type, item.data);
    item.fieldError = problem ? problem.field || "" : "";
    if (problem) {
      item.error = problem.key;
      item.image = "";
      item.generating = false;
      return false;
    }
    item.error = "";
    item.text = content.encode(item.type, item.data);
    return true;
  }

  async function generateQr(item) {
    window.clearTimeout(item.editTimer);
    const generation = ++item.generation;

    if (!validateItem(item)) {
      item.generating = false;
      updateCardState(item);
      updatePreview();
      saveState();
      return;
    }

    const text = item.text.trim();
    if (!text) {
      item.image = "";
      item.generating = false;
      item.error = "emptyText";
      item.fieldError = item.type === "text" ? "text" : "";
      updateCardState(item);
      updatePreview();
      saveState();
      return;
    }

    item.generating = true;
    item.error = "";
    updateCardState(item);
    updatePreview();

    try {
      if (!renderer || typeof renderer.render !== "function") {
        throw new Error("libraryMissing");
      }

      const image = await renderer.render(text, {
        size: QR_IMAGE_SIZE,
        margin: 4,
        foreground: state.style.foreground,
        background: state.style.background,
        shape: state.style.shape,
        logo: state.style.logo,
      });

      if (item.generation !== generation || !state.items.includes(item)) return;
      item.image = image;
      item.error = "";
    } catch (error) {
      if (item.generation !== generation) return;
      console.error("QR kód se nepodařilo vytvořit.", error);
      item.image = "";
      const message = String(error && error.message ? error.message : error).toLowerCase();
      item.error = message.includes("big") || message.includes("too long") || message.includes("overflow")
        ? "tooLong"
        : message.includes("librarymissing")
          ? "libraryMissing"
          : "generic";
    } finally {
      if (item.generation === generation) {
        item.generating = false;
        updateCardState(item);
        updatePreview();
        saveState();
      }
    }
  }

  function refreshItem(item, immediate) {
    window.clearTimeout(item.editTimer);
    item.generation += 1;

    if (!validateItem(item)) {
      updateCardState(item);
      updatePreview();
      saveState();
      return;
    }

    item.generating = true;
    updateCardState(item);
    updatePreview();
    item.editTimer = window.setTimeout(() => generateQr(item), immediate ? 0 : 260);
  }

  /* ---------- Card rendering ---------- */

  function createTypeSelect(card, item) {
    const select = card.querySelector(".item-type");
    content.getTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type.id;
      option.textContent = t(type.labelKey);
      select.appendChild(option);
    });
    select.value = item.type;
    select.addEventListener("change", () => {
      if (!content.isType(select.value) || select.value === item.type) return;
      pushHistory();
      changeItemType(item, select.value);
    });
  }

  function changeItemType(item, type) {
    const previousText = item.text;
    item.type = type;
    item.data = content.defaults(type);
    if (type === "text") item.data.text = previousText;
    if (type === "url" && /^https?:\/\//i.test(previousText.trim())) item.data.url = previousText.trim();
    item.text = content.encode(type, item.data);
    item.fieldError = "";
    item.error = "";
    item.image = "";
    renderItems();
    updatePreview();
    saveState();
    refreshItem(item, true);
  }

  function buildField(field, item) {
    const label = document.createElement("label");
    label.className = `item-form-field${field.full ? " full" : ""}`;

    const caption = document.createElement("span");
    caption.textContent = t(field.labelKey);
    label.appendChild(caption);

    let control;
    if (field.control === "textarea") {
      control = document.createElement("textarea");
      control.rows = 2;
      control.className = "item-input item-textarea";
    } else if (field.control === "select") {
      control = document.createElement("select");
      control.className = "item-input";
      (field.options || []).forEach((option) => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = t(option.labelKey);
        control.appendChild(element);
      });
    } else {
      control = document.createElement("input");
      control.type = field.control;
      control.className = "item-input";
    }

    control.dataset.field = field.name;
    if (field.placeholderKey) control.placeholder = t(field.placeholderKey);
    control.value = item.data[field.name] == null ? "" : item.data[field.name];
    label.appendChild(control);
    bindField(control, field, item);
    return label;
  }

  function buildCheckbox(field, item) {
    const label = document.createElement("label");
    label.className = `item-checkbox${field.full ? " full" : ""}`;

    const control = document.createElement("input");
    control.type = "checkbox";
    control.dataset.field = field.name;
    control.checked = Boolean(item.data[field.name]);

    const caption = document.createElement("span");
    caption.textContent = t(field.labelKey);

    label.append(control, caption);
    bindField(control, field, item);
    return label;
  }

  function bindField(control, field, item) {
    const update = () => {
      noteEdit(field.control === "checkbox" || field.control === "select");
      if (field.control === "checkbox") item.data[field.name] = control.checked;
      else item.data[field.name] = control.value;
      refreshItem(item);
    };

    if (field.control === "checkbox" || field.control === "select") {
      control.addEventListener("change", update);
    } else {
      control.addEventListener("input", update);
    }
  }

  function renderItemForm(card, item) {
    const form = card.querySelector(".item-form");
    const fragment = document.createDocumentFragment();
    content.getFields(item.type).forEach((field) => {
      fragment.appendChild(field.control === "checkbox" ? buildCheckbox(field, item) : buildField(field, item));
    });
    form.replaceChildren(fragment);
  }

  function createCard(item) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    i18n.apply(fragment);
    const card = fragment.querySelector(".qr-card");
    card.dataset.id = item.id;

    createTypeSelect(card, item);
    renderItemForm(card, item);

    const sizeInput = card.querySelector(".item-size");
    const labelInput = card.querySelector(".item-label");
    sizeInput.value = item.size;
    labelInput.value = item.label;

    sizeInput.addEventListener("input", () => {
      noteEdit();
      item.size = utils.toNumber(sizeInput.value, 0);
      updatePreview();
      saveState();
    });
    sizeInput.addEventListener("change", () => {
      item.size = utils.clamp(sizeInput.value, 10, 200, 30);
      sizeInput.value = item.size;
      updatePreview();
      saveState();
    });

    labelInput.addEventListener("input", () => {
      noteEdit();
      item.label = labelInput.value;
      updatePreview();
      saveState();
    });

    card.querySelector(".apply-size-button").addEventListener("click", () => {
      const size = utils.toNumber(item.size, NaN);
      if (!Number.isFinite(size) || size < 10 || size > 200) {
        showToast(t("toast.invalidSize"), true);
        sizeInput.focus();
        return;
      }
      pushHistory();
      state.items.forEach((entry) => { entry.size = size; });
      Array.from(elements.itemsList.children).forEach((entryCard) => {
        entryCard.querySelector(".item-size").value = size;
      });
      updatePreview();
      saveState();
      showToast(t("toast.appliedSize", size));
    });

    card.querySelector(".duplicate-button").addEventListener("click", () => {
      pushHistory();
      const index = state.items.indexOf(item);
      const duplicate = {
        id: createId(),
        type: item.type,
        data: { ...item.data },
        text: item.text,
        size: item.size,
        label: item.label,
        image: item.image,
        error: item.error,
        fieldError: item.fieldError,
        generating: false,
        generation: 0,
      };
      state.items.splice(index + 1, 0, duplicate);
      renderItems();
      updatePreview();
      saveState();
      if (!duplicate.image && !duplicate.error) generateQr(duplicate);
      showToast(t("toast.duplicated"));
    });

    card.querySelector(".delete-button").addEventListener("click", () => {
      pushHistory();
      window.clearTimeout(item.editTimer);
      item.generation += 1;
      state.items = state.items.filter((entry) => entry.id !== item.id);
      renderItems();
      updatePreview();
      saveState();
    });

    applyCardState(card, item);
    return fragment;
  }

  function renderItems() {
    const fragment = document.createDocumentFragment();
    state.items.forEach((item) => fragment.appendChild(createCard(item)));
    elements.itemsList.replaceChildren(fragment);
    elements.emptyState.classList.toggle("hidden", state.items.length > 0);
    elements.clearButton.classList.toggle("hidden", state.items.length === 0);
    elements.itemCount.textContent = state.items.length;
    updateNumbers();
  }

  /* ---------- Preview and export ---------- */

  function updatePreview() {
    const previewItems = state.items.filter((item) => item.image && !item.error && Number(item.size) > 0);
    let layoutError = "";

    try {
      laidOutPages = utils.layoutPages(previewItems, state);
    } catch (error) {
      laidOutPages = [];
      layoutError = error.code ? t(`layout.${error.code}`, error.params) : (error.message || t("layout.generic"));
    }

    if (currentPage >= laidOutPages.length) currentPage = Math.max(0, laidOutPages.length - 1);
    const fragment = document.createDocumentFragment();
    const placements = laidOutPages[currentPage] || [];

    placements.forEach((placement) => {
      const wrapper = document.createElement("div");
      wrapper.className = "placement";
      wrapper.style.left = `${placement.x / utils.PAGE_WIDTH_MM * 100}%`;
      wrapper.style.top = `${placement.y / utils.PAGE_HEIGHT_MM * 100}%`;
      wrapper.style.width = `${placement.width / utils.PAGE_WIDTH_MM * 100}%`;
      wrapper.style.height = `${placement.height / utils.PAGE_HEIGHT_MM * 100}%`;
      wrapper.title = placement.item.label || placement.item.text;

      const image = document.createElement("img");
      image.src = placement.item.image;
      image.alt = t("card.alt", placement.item.label || (placement.item.text || "").split("\n")[0]);
      wrapper.appendChild(image);

      if (placement.label) {
        const label = document.createElement("span");
        label.className = "placement-label";
        label.textContent = placement.label;
        wrapper.appendChild(label);
      }
      fragment.appendChild(wrapper);
    });

    elements.placements.replaceChildren(fragment);
    elements.paperEmpty.classList.toggle("hidden", placements.length > 0);
    elements.layoutError.classList.toggle("hidden", !layoutError);
    elements.layoutError.textContent = layoutError;

    const pageCount = laidOutPages.length;
    elements.pageBadge.textContent = t("preview.pageBadge", pageCount);
    elements.pageIndicator.textContent = pageCount ? t("preview.pageIndicator", currentPage + 1, pageCount) : t("preview.pageIndicatorEmpty");
    elements.previousPage.disabled = currentPage <= 0;
    elements.nextPage.disabled = currentPage >= pageCount - 1;

    const hasPending = state.items.some((item) => item.generating);
    const hasItemErrors = state.items.some((item) => item.error || !item.image || !(Number(item.size) > 0));
    const canExport = state.items.length > 0 && !hasPending && !hasItemErrors && !layoutError && pageCount > 0 && !exporting;
    elements.downloadButton.disabled = !canExport;

    if (!state.items.length) {
      elements.exportSummary.textContent = t("preview.addFirst");
    } else if (hasPending) {
      elements.exportSummary.textContent = t("preview.summaryPending");
    } else if (hasItemErrors || layoutError) {
      elements.exportSummary.textContent = t("preview.summaryErrors");
    } else {
      elements.exportSummary.textContent = t("preview.summaryReady", state.items.length, pageCount);
    }
  }

  function normalizeControl(input, min, max, fallback) {
    const value = utils.clamp(input.value, min, max, fallback);
    input.value = value;
    return value;
  }

  function makeLabelImage(text, widthMm) {
    const scale = 10;
    const width = Math.max(1, Math.round(widthMm * scale));
    const height = utils.LABEL_HEIGHT_MM * scale;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#28332e";
    context.textAlign = "center";
    context.textBaseline = "middle";

    let fontSize = 27;
    let label = text;
    context.font = `600 ${fontSize}px Arial, sans-serif`;
    while (fontSize > 16 && context.measureText(label).width > width - 4) {
      fontSize -= 1;
      context.font = `600 ${fontSize}px Arial, sans-serif`;
    }
    while (label.length > 1 && context.measureText(label).width > width - 4) {
      label = `${label.slice(0, -2)}…`;
    }

    context.fillText(label, width / 2, 34, width - 4);
    return canvas.toDataURL("image/png");
  }

  async function downloadPdf() {
    if (exporting || elements.downloadButton.disabled) return;
    exporting = true;
    elements.downloadButton.querySelector("span").textContent = t("preview.downloading");
    updatePreview();

    try {
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("libraryMissing");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({
        title: t("pdf.title"),
        subject: t("pdf.subject"),
        creator: t("brand.name"),
      });

      laidOutPages.forEach((page, pageIndex) => {
        if (pageIndex > 0) pdf.addPage("a4", "portrait");
        page.forEach((placement) => {
          pdf.addImage(
            placement.item.image,
            "PNG",
            placement.x,
            placement.y,
            placement.qrSize,
            placement.qrSize,
            undefined,
            "FAST"
          );
          if (placement.label) {
            pdf.addImage(
              makeLabelImage(placement.label, placement.width),
              "PNG",
              placement.x,
              placement.y + placement.qrSize,
              placement.width,
              utils.LABEL_HEIGHT_MM,
              undefined,
              "FAST"
            );
          }
        });
      });

      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      pdf.save(t("pdf.filename", date));
      showToast(t("toast.pdfDone", state.items.length, laidOutPages.length));
    } catch (error) {
      console.error("PDF se nepodařilo vytvořit.", error);
      showToast(t("error.pdfFailed"), true);
    } finally {
      exporting = false;
      elements.downloadButton.querySelector("span").textContent = t("preview.download");
      updatePreview();
    }
  }

  /* ---------- Adding items ---------- */

  function createItem(text, size) {
    const data = content.defaults("text");
    data.text = text;
    return {
      id: createId(),
      type: "text",
      data,
      text: content.encode("text", data),
      size,
      label: "",
      image: "",
      error: "",
      fieldError: "",
      generating: true,
      generation: 0,
    };
  }

  function addItems() {
    const texts = utils.parseBulkInput(elements.bulkInput.value, state.splitCommas);
    if (!texts.length) {
      showToast(t("toast.emptyInput"), true);
      elements.bulkInput.focus();
      return;
    }

    pushHistory();
    const newItems = texts.map((text) => createItem(text, state.defaultSize));
    state.items.push(...newItems);
    state.bulkText = "";
    elements.bulkInput.value = "";
    renderItems();
    updatePreview();
    saveState();
    showToast(t("toast.added", texts.length));
    Promise.allSettled(newItems.map((item) => generateQr(item)));
  }

  /* ---------- QR style ---------- */

  function syncStyleControls() {
    elements.foreground.value = state.style.foreground;
    elements.background.value = state.style.background;
    elements.shape.value = state.style.shape;
    if (state.style.logo) elements.logoPreview.src = state.style.logo;
    else elements.logoPreview.removeAttribute("src");
    elements.logoPreview.classList.toggle("hidden", !state.style.logo);
    elements.logoRemove.classList.toggle("hidden", !state.style.logo);
  }

  function updateContrastWarning() {
    const ratio = renderer.contrastRatio(state.style.foreground, state.style.background);
    const inverted = renderer.relativeLuminance(state.style.foreground) >= renderer.relativeLuminance(state.style.background);
    elements.contrastWarning.classList.toggle("hidden", ratio >= 4.5 && !inverted);
  }

  function regenerateStyledItems() {
    state.items.forEach((item) => {
      if (item.text || item.error) refreshItem(item, true);
    });
  }

  function applyStyle(patch, options) {
    state.style = { ...state.style, ...patch };
    syncStyleControls();
    updateContrastWarning();
    saveState();

    if (options && options.regenerate === false) return;
    window.clearTimeout(styleTimer);
    styleTimer = window.setTimeout(regenerateStyledItems, options && options.immediate ? 0 : 180);
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function prepareLogo(file) {
    const source = await readImageFile(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image failed"));
      element.src = source;
    });

    const sourceWidth = image.naturalWidth || image.width || 256;
    const sourceHeight = image.naturalHeight || image.height || 256;
    const scale = Math.min(1, 512 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  /* ---------- Events ---------- */

  elements.addButton.addEventListener("click", addItems);
  elements.bulkInput.addEventListener("input", () => {
    state.bulkText = elements.bulkInput.value;
    saveState();
  });
  elements.bulkInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      addItems();
    }
  });
  elements.splitCommas.addEventListener("change", () => {
    state.splitCommas = elements.splitCommas.checked;
    saveState();
  });
  elements.defaultSize.addEventListener("change", () => {
    state.defaultSize = normalizeControl(elements.defaultSize, 10, 200, 30);
    saveState();
  });
  elements.clearButton.addEventListener("click", () => {
    if (!state.items.length || !window.confirm(t("confirm.clear"))) return;
    pushHistory();
    state.items.forEach((item) => {
      window.clearTimeout(item.editTimer);
      item.generation += 1;
    });
    state.items = [];
    currentPage = 0;
    renderItems();
    updatePreview();
    saveState();
    showToast(t("toast.cleared"));
  });
  elements.previousPage.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      updatePreview();
    }
  });
  elements.nextPage.addEventListener("click", () => {
    if (currentPage < laidOutPages.length - 1) {
      currentPage += 1;
      updatePreview();
    }
  });
  elements.pageMargin.addEventListener("input", () => {
    state.margin = utils.clamp(elements.pageMargin.value, 0, 50, 10);
    updatePreview();
    saveState();
  });
  elements.pageMargin.addEventListener("change", () => {
    state.margin = normalizeControl(elements.pageMargin, 0, 50, 10);
    updatePreview();
    saveState();
  });
  elements.itemGap.addEventListener("input", () => {
    state.gap = utils.clamp(elements.itemGap.value, 0, 50, 8);
    updatePreview();
    saveState();
  });
  elements.itemGap.addEventListener("change", () => {
    state.gap = normalizeControl(elements.itemGap, 0, 50, 8);
    updatePreview();
    saveState();
  });
  elements.showLabels.addEventListener("change", () => {
    state.showLabels = elements.showLabels.checked;
    updatePreview();
    saveState();
  });
  elements.downloadButton.addEventListener("click", downloadPdf);

  elements.undoButton.addEventListener("click", undo);
  elements.redoButton.addEventListener("click", redo);

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redo();
    }
  });

  elements.foreground.addEventListener("input", () => applyStyle({ foreground: elements.foreground.value }));
  elements.background.addEventListener("input", () => applyStyle({ background: elements.background.value }));
  elements.shape.addEventListener("change", () => applyStyle({ shape: elements.shape.value }, { immediate: true }));

  elements.logoUpload.addEventListener("click", () => elements.logoInput.click());
  elements.logoInput.addEventListener("change", async () => {
    const file = elements.logoInput.files && elements.logoInput.files[0];
    elements.logoInput.value = "";
    if (!file) return;

    if (!String(file.type || "").startsWith("image/") || file.size > 3 * 1024 * 1024) {
      showToast(t("toast.logoError"), true);
      return;
    }

    try {
      const logo = await prepareLogo(file);
      applyStyle({ logo }, { immediate: true });
      showToast(t("toast.logoAdded"));
    } catch (error) {
      console.error("Logo se nepodařilo načíst.", error);
      showToast(t("toast.logoError"), true);
    }
  });
  elements.logoRemove.addEventListener("click", () => {
    applyStyle({ logo: "" }, { immediate: true });
    showToast(t("toast.logoRemoved"));
  });
  elements.styleReset.addEventListener("click", () => {
    applyStyle({ ...DEFAULT_STYLE }, { immediate: true });
  });

  i18n.onChange(() => {
    renderItems();
    updatePreview();
    syncStyleControls();
    updateContrastWarning();
    updateHistoryButtons();
    elements.downloadButton.querySelector("span").textContent = t(exporting ? "preview.downloading" : "preview.download");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
  elements.installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installButton.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => {
    elements.installButton.classList.add("hidden");
    showToast(t("toast.installed"));
  });

  elements.bulkInput.value = state.bulkText;
  elements.splitCommas.checked = state.splitCommas;
  elements.defaultSize.value = state.defaultSize;
  elements.pageMargin.value = state.margin;
  elements.itemGap.value = state.gap;
  elements.showLabels.checked = state.showLabels;
  syncStyleControls();
  updateContrastWarning();
  updateHistoryButtons();
  renderItems();
  updatePreview();
  Promise.allSettled(state.items.map((item) => generateQr(item)));

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("Offline režim se nepodařilo aktivovat.", error);
      });
    });
  }
})();
