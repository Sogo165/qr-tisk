(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.QRAppUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PAGE_WIDTH_MM = 210;
  const PAGE_HEIGHT_MM = 297;
  const LABEL_HEIGHT_MM = 5;
  const EPSILON = 0.001;

  function parseBulkInput(value, splitCommas) {
    const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
    const values = [];

    lines.forEach((line) => {
      const parts = splitCommas ? line.split(",") : [line];
      parts.forEach((part) => {
        const text = part.trim();
        if (text) values.push(text);
      });
    });

    return values;
  }

  function toNumber(value, fallback) {
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max, fallback) {
    const parsed = toNumber(value, fallback);
    return Math.min(max, Math.max(min, parsed));
  }

  function czechPlural(count, one, few, many) {
    if (count === 1) return one;
    if (count >= 2 && count <= 4) return few;
    return many;
  }

  function layoutError(code, params) {
    const error = new Error(code);
    error.code = code;
    error.params = params || {};
    return error;
  }

  function layoutPages(items, settings) {
    const margin = toNumber(settings.margin, NaN);
    const gap = Math.max(0, toNumber(settings.gap, 0));
    const showLabels = Boolean(settings.showLabels);

    if (!Number.isFinite(margin) || margin < 0 || margin >= PAGE_WIDTH_MM / 2 || margin >= PAGE_HEIGHT_MM / 2) {
      throw layoutError("invalidMargin");
    }

    const availableWidth = PAGE_WIDTH_MM - margin * 2;
    const availableHeight = PAGE_HEIGHT_MM - margin * 2;
    const pages = [];
    let page = [];
    let row = [];
    let rowWidth = 0;
    let rowHeight = 0;
    let y = margin;

    function startPage() {
      if (page.length) pages.push(page);
      page = [];
      y = margin;
    }

    function flushRow() {
      if (!row.length) return;

      if (y + rowHeight > PAGE_HEIGHT_MM - margin + EPSILON && page.length) {
        startPage();
      }

      let x = margin;
      row.forEach((entry) => {
        page.push({
          item: entry.item,
          x,
          y,
          width: entry.width,
          height: entry.height,
          qrSize: entry.width,
          label: entry.label,
        });
        x += entry.width + gap;
      });

      y += rowHeight + gap;
      row = [];
      rowWidth = 0;
      rowHeight = 0;
    }

    items.forEach((item, index) => {
      const width = toNumber(item.size, NaN);
      if (!Number.isFinite(width) || width <= 0) {
        throw layoutError("invalidSize", { index: index + 1 });
      }

      const label = showLabels && String(item.label || "").trim() ? String(item.label).trim() : "";
      const height = width + (label ? LABEL_HEIGHT_MM : 0);

      if (width > availableWidth + EPSILON || height > availableHeight + EPSILON) {
        const maximum = Math.floor(Math.min(availableWidth, availableHeight - (label ? LABEL_HEIGHT_MM : 0)) * 10) / 10;
        throw layoutError("tooLarge", { index: index + 1, maximum });
      }

      const addedWidth = (row.length ? gap : 0) + width;
      if (row.length && rowWidth + addedWidth > availableWidth + EPSILON) {
        flushRow();
      }

      if (!row.length && y + height > PAGE_HEIGHT_MM - margin + EPSILON && page.length) {
        startPage();
      }

      row.push({ item, width, height, label });
      rowWidth += (row.length > 1 ? gap : 0) + width;
      rowHeight = Math.max(rowHeight, height);
    });

    flushRow();
    if (page.length) pages.push(page);
    return pages;
  }

  return {
    PAGE_WIDTH_MM,
    PAGE_HEIGHT_MM,
    LABEL_HEIGHT_MM,
    parseBulkInput,
    toNumber,
    clamp,
    czechPlural,
    layoutPages,
  };
});
