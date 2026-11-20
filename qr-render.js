(function (root) {
  "use strict";

  const DEFAULT_SIZE = 512;
  const DEFAULT_MARGIN = 4;
  const SHAPES = ["square", "rounded", "dots"];
  const logoCache = new Map();

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeColor(value, fallback) {
    const color = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
    }
    return fallback;
  }

  function channelToLinear(value) {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function relativeLuminance(hex) {
    const color = normalizeColor(hex, "#ffffff");
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return 0.2126 * channelToLinear(red) + 0.7152 * channelToLinear(green) + 0.0722 * channelToLinear(blue);
  }

  function contrastRatio(first, second) {
    const light = Math.max(relativeLuminance(first), relativeLuminance(second));
    const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
    return (light + 0.05) / (dark + 0.05);
  }

  function loadLogo(src) {
    if (!src) return Promise.resolve(null);
    if (logoCache.has(src)) return logoCache.get(src);

    const promise = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
    logoCache.set(src, promise);
    return promise;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    if (typeof context.roundRect === "function") {
      context.beginPath();
      context.roundRect(x, y, width, height, safeRadius);
      return;
    }
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function isFinderModule(column, row, count) {
    return (column < 7 && row < 7) || (column >= count - 7 && row < 7) || (column < 7 && row >= count - 7);
  }

  function drawModule(context, x, y, cell, shape, solid) {
    if (solid || shape === "square") {
      context.fillRect(x, y, cell, cell);
      return;
    }

    if (shape === "dots") {
      context.beginPath();
      context.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2);
      context.fill();
      return;
    }

    const inset = cell * 0.055;
    roundedRect(context, x + inset, y + inset, cell - inset * 2, cell - inset * 2, cell * 0.26);
    context.fill();
  }

  function drawLogo(context, image, size, background) {
    const box = size * 0.22;
    const padding = box * 0.16;
    const outer = box + padding * 2;
    const start = (size - outer) / 2;

    context.fillStyle = background;
    roundedRect(context, start, start, outer, outer, outer * 0.18);
    context.fill();

    const ratio = Math.min(box / image.width, box / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }

  async function render(text, options) {
    const settings = options || {};
    const requestedSize = Math.round(clampNumber(settings.size, 128, 4096, DEFAULT_SIZE));
    const margin = Math.round(clampNumber(settings.margin, 0, 8, DEFAULT_MARGIN));
    const foreground = normalizeColor(settings.foreground, "#111714");
    const background = normalizeColor(settings.background, "#ffffff");
    const shape = SHAPES.includes(settings.shape) ? settings.shape : "square";
    const errorCorrectionLevel = settings.logo
      ? "H"
      : (["L", "M", "Q", "H"].includes(settings.errorCorrectionLevel) ? settings.errorCorrectionLevel : "M");

    if (!root.QRCode || typeof root.QRCode.create !== "function") {
      return root.QRCode.toDataURL(text, {
        errorCorrectionLevel,
        margin,
        width: requestedSize,
        color: { dark: foreground, light: background },
      });
    }

    const qr = root.QRCode.create(text, { errorCorrectionLevel });
    const count = qr.modules.size;
    const cell = Math.max(1, Math.round(requestedSize / (count + margin * 2)));
    const size = cell * (count + margin * 2);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");

    context.fillStyle = background;
    context.fillRect(0, 0, size, size);

    const offset = margin * cell;
    context.fillStyle = foreground;

    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (!qr.modules.get(row, column)) continue;
        drawModule(
          context,
          offset + column * cell,
          offset + row * cell,
          cell,
          shape,
          isFinderModule(column, row, count)
        );
      }
    }

    if (settings.logo) {
      const logo = await loadLogo(settings.logo);
      if (logo) drawLogo(context, logo, size, background);
    }

    return canvas.toDataURL("image/png");
  }

  root.QRAppQrRender = {
    SHAPES,
    render,
    contrastRatio,
    relativeLuminance,
    normalizeColor,
  };
})(window);
