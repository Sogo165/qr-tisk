(function () {
  "use strict";

  const utils = window.QRAppUtils;
  const i18n = window.QRAppI18n;
  const t = (key, ...args) => i18n.t(key, ...args);
  const STORAGE_KEY = "qr-tisk-state-v1";
  const QR_IMAGE_SIZE = 512;

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
  };

  let state = loadState();
  let laidOutPages = [];
  let currentPage = 0;
  let toastTimer = null;
  let installPrompt = null;
  let exporting = false;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `qr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadState() {
    const fallback = {
      defaultSize: 30,
      splitCommas: true,
      margin: 10,
      gap: 8,
      showLabels: true,
      bulkText: "",
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
        items: Array.isArray(saved.items)
          ? saved.items.slice(0, 500).filter((item) => item && typeof item.text === "string").map((item) => ({
              id: typeof item.id === "string" ? item.id : createId(),
              text: item.text,
              size: utils.clamp(item.size, 10, 200, fallback.defaultSize),
              label: typeof item.label === "string" ? item.label.slice(0, 100) : "",
              image: "",
              error: "",
              generating: false,
              generation: 0,
            }))
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
        items: state.items.map((item) => ({
          id: item.id,
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
    image.alt = item.image ? t("card.alt", item.text) : "";

    card.classList.toggle("has-error", Boolean(item.error));
    error.classList.toggle("hidden", !item.error);
    error.textContent = item.error ? t(`error.${item.error}`) : "";
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

  function invalidateQr(item) {
    item.generation += 1;
    item.image = "";
    item.error = "";
    item.generating = true;
    window.clearTimeout(item.editTimer);
    updateCardState(item);
    updatePreview();
  }

  async function generateQr(item) {
    window.clearTimeout(item.editTimer);
    const generation = ++item.generation;
    const text = item.text.trim();

    if (!text) {
      item.image = "";
      item.generating = false;
      item.error = "emptyText";
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
      if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
        throw new Error("libraryMissing");
      }

      const image = await window.QRCode.toDataURL(text, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: QR_IMAGE_SIZE,
        color: { dark: "#111714", light: "#ffffff" },
      });

      if (item.generation !== generation || !state.items.includes(item)) return;
      item.image = image;
      item.error = "";
    } catch (error) {
      if (item.generation !== generation) return;
      console.error("QR kód se nepodařilo vytvořit.", error);
      item.image = "";
      const message = String(error.message || error).toLowerCase();
      item.error = message.includes("big") ? "tooLong" : error.message === "libraryMissing" ? "libraryMissing" : "generic";
    } finally {
      if (item.generation === generation) {
        item.generating = false;
        updateCardState(item);
        updatePreview();
        saveState();
      }
    }
  }

  function scheduleQr(item) {
    invalidateQr(item);
    item.editTimer = window.setTimeout(() => generateQr(item), 260);
  }

  function createCard(item) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    i18n.apply(fragment);
    const card = fragment.querySelector(".qr-card");
    card.dataset.id = item.id;

    const textInput = card.querySelector(".item-text");
    const sizeInput = card.querySelector(".item-size");
    const labelInput = card.querySelector(".item-label");
    textInput.value = item.text;
    sizeInput.value = item.size;
    labelInput.value = item.label;

    textInput.addEventListener("input", () => {
      item.text = textInput.value;
      scheduleQr(item);
      saveState();
    });
    textInput.addEventListener("blur", () => {
      if (!item.generating && !item.image) generateQr(item);
    });

    sizeInput.addEventListener("input", () => {
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
      state.items.forEach((entry) => { entry.size = size; });
      Array.from(elements.itemsList.children).forEach((entryCard) => {
        entryCard.querySelector(".item-size").value = size;
      });
      updatePreview();
      saveState();
      showToast(t("toast.appliedSize", size));
    });

    card.querySelector(".duplicate-button").addEventListener("click", () => {
      const index = state.items.indexOf(item);
      const duplicate = {
        id: createId(),
        text: item.text,
        size: item.size,
        label: item.label,
        image: item.image,
        error: item.error,
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
      image.alt = t("card.alt", placement.item.label || placement.item.text);
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

  function addItems() {
    const texts = utils.parseBulkInput(elements.bulkInput.value, state.splitCommas);
    if (!texts.length) {
      showToast(t("toast.emptyInput"), true);
      elements.bulkInput.focus();
      return;
    }

    const newItems = texts.map((text) => ({
      id: createId(),
      text,
      size: state.defaultSize,
      label: "",
      image: "",
      error: "",
      generating: true,
      generation: 0,
    }));

    state.items.push(...newItems);
    state.bulkText = "";
    elements.bulkInput.value = "";
    renderItems();
    updatePreview();
    saveState();
    showToast(t("toast.added", texts.length));
    Promise.allSettled(newItems.map((item) => generateQr(item)));
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

  i18n.onChange(() => {
    renderItems();
    updatePreview();
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
