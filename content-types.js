(function (root) {
  "use strict";

  const TYPES = ["text", "url", "wifi", "vcard", "email", "sms", "phone", "geo", "event"];

  const FIELD_DEFS = {
    text: [
      { name: "text", control: "textarea", labelKey: "field.text", required: true, full: true },
    ],
    url: [
      { name: "url", control: "url", labelKey: "field.url", placeholderKey: "field.urlPlaceholder", required: true, full: true },
    ],
    wifi: [
      { name: "ssid", control: "text", labelKey: "field.ssid", required: true, full: true },
      { name: "password", control: "text", labelKey: "field.password" },
      {
        name: "security",
        control: "select",
        labelKey: "field.security",
        defaultValue: "WPA",
        options: [
          { value: "WPA", labelKey: "field.securityWpa" },
          { value: "WEP", labelKey: "field.securityWep" },
          { value: "nopass", labelKey: "field.securityNone" },
        ],
      },
      { name: "hidden", control: "checkbox", labelKey: "field.hiddenNetwork", full: true },
    ],
    vcard: [
      { name: "name", control: "text", labelKey: "field.name", required: true, full: true },
      { name: "company", control: "text", labelKey: "field.company" },
      { name: "phone", control: "tel", labelKey: "field.phone" },
      { name: "email", control: "email", labelKey: "field.email" },
      { name: "website", control: "url", labelKey: "field.website", full: true },
    ],
    email: [
      { name: "email", control: "email", labelKey: "field.emailTo", required: true, full: true },
      { name: "subject", control: "text", labelKey: "field.subject", full: true },
      { name: "body", control: "textarea", labelKey: "field.body", full: true },
    ],
    sms: [
      { name: "phone", control: "tel", labelKey: "field.phoneNumber", required: true, full: true },
      { name: "message", control: "textarea", labelKey: "field.smsMessage", full: true },
    ],
    phone: [
      { name: "phone", control: "tel", labelKey: "field.phoneNumber", required: true, full: true },
    ],
    geo: [
      { name: "latitude", control: "text", labelKey: "field.latitude", placeholderKey: "field.latitudePlaceholder", required: true },
      { name: "longitude", control: "text", labelKey: "field.longitude", placeholderKey: "field.longitudePlaceholder", required: true },
    ],
    event: [
      { name: "title", control: "text", labelKey: "field.eventTitle", required: true, full: true },
      { name: "location", control: "text", labelKey: "field.location", full: true },
      { name: "start", control: "datetime-local", labelKey: "field.start", required: true },
      { name: "end", control: "datetime-local", labelKey: "field.end" },
      { name: "description", control: "textarea", labelKey: "field.description", full: true },
    ],
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isType(type) {
    return TYPES.includes(type);
  }

  function getTypes() {
    return TYPES.map((id) => ({ id, labelKey: `type.${id}` }));
  }

  function getFields(type) {
    return FIELD_DEFS[type] || FIELD_DEFS.text;
  }

  function defaults(type) {
    const data = {};
    getFields(type).forEach((field) => {
      if (field.control === "checkbox") data[field.name] = false;
      else if (field.defaultValue !== undefined) data[field.name] = field.defaultValue;
      else data[field.name] = "";
    });
    return data;
  }

  function normalize(type, data, legacyText) {
    const safeType = isType(type) ? type : "text";
    const result = defaults(safeType);

    if (data && typeof data === "object") {
      getFields(safeType).forEach((field) => {
        const value = data[field.name];
        if (field.control === "checkbox") {
          result[field.name] = Boolean(value);
        } else if (typeof value === "string") {
          result[field.name] = value;
        } else if (typeof value === "number" && Number.isFinite(value)) {
          result[field.name] = String(value);
        }
      });
    }

    if (safeType === "text" && !result.text && typeof legacyText === "string") {
      result.text = legacyText;
    }

    return result;
  }

  function escapeWifi(value) {
    return String(value == null ? "" : value).replace(/([\\;,:"])/g, "\\$1");
  }

  function escapeVcard(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  function escapeIcs(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  function toIcsDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!match) return "";
    return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
  }

  function splitName(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    const first = parts.shift() || "";
    return { first, last: parts.join(" ") };
  }

  function encode(type, data) {
    const value = data || {};

    switch (type) {
      case "url":
        return String(value.url || "").trim();

      case "wifi": {
        const security = ["WPA", "WEP", "nopass"].includes(value.security) ? value.security : "WPA";
        let payload = `WIFI:T:${security};S:${escapeWifi(String(value.ssid || "").trim())};`;
        if (security !== "nopass" && String(value.password || "")) {
          payload += `P:${escapeWifi(value.password)};`;
        }
        if (value.hidden) payload += "H:true;";
        return `${payload};`;
      }

      case "vcard": {
        const name = String(value.name || "").trim();
        const parts = splitName(name);
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${escapeVcard(parts.last)};${escapeVcard(parts.first)};;;`,
          `FN:${escapeVcard(name)}`,
        ];
        if (String(value.company || "").trim()) lines.push(`ORG:${escapeVcard(value.company.trim())}`);
        if (String(value.phone || "").trim()) lines.push(`TEL;TYPE=CELL:${escapeVcard(value.phone.trim())}`);
        if (String(value.email || "").trim()) lines.push(`EMAIL:${escapeVcard(value.email.trim())}`);
        if (String(value.website || "").trim()) lines.push(`URL:${escapeVcard(value.website.trim())}`);
        lines.push("END:VCARD");
        return lines.join("\n");
      }

      case "email": {
        let payload = `mailto:${String(value.email || "").trim()}`;
        const params = [];
        if (String(value.subject || "").trim()) params.push(`subject=${encodeURIComponent(value.subject.trim())}`);
        if (String(value.body || "").trim()) params.push(`body=${encodeURIComponent(value.body.trim())}`);
        if (params.length) payload += `?${params.join("&")}`;
        return payload;
      }

      case "sms":
        return `SMSTO:${String(value.phone || "").trim()}:${String(value.message || "").trim()}`;

      case "phone":
        return `tel:${String(value.phone || "").trim().replace(/[\s().-]/g, "")}`;

      case "geo":
        return `geo:${String(value.latitude || "").trim().replace(",", ".")},${String(value.longitude || "").trim().replace(",", ".")}`;

      case "event": {
        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "BEGIN:VEVENT",
          `SUMMARY:${escapeIcs(String(value.title || "").trim())}`,
        ];
        const start = toIcsDate(value.start);
        const end = toIcsDate(value.end);
        if (start) lines.push(`DTSTART:${start}`);
        if (end) lines.push(`DTEND:${end}`);
        if (String(value.location || "").trim()) lines.push(`LOCATION:${escapeIcs(value.location.trim())}`);
        if (String(value.description || "").trim()) lines.push(`DESCRIPTION:${escapeIcs(value.description.trim())}`);
        lines.push("END:VEVENT", "END:VCALENDAR");
        return lines.join("\n");
      }

      case "text":
      default:
        return String(value.text || "");
    }
  }

  function validate(type, data) {
    const value = data || {};
    const fields = getFields(type);

    for (const field of fields) {
      if (!field.required || field.control === "checkbox") continue;
      if (!String(value[field.name] == null ? "" : value[field.name]).trim()) {
        return { key: type === "text" ? "emptyText" : "required", field: field.name };
      }
    }

    if (type === "url") {
      try {
        const url = new URL(String(value.url || "").trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
      } catch (error) {
        return { key: "invalidUrl", field: "url" };
      }
    }

    if (type === "email" && !EMAIL_PATTERN.test(String(value.email || "").trim())) {
      return { key: "invalidEmail", field: "email" };
    }

    if ((type === "phone" || type === "sms") && String(value.phone || "").replace(/\D/g, "").length < 3) {
      return { key: "invalidPhone", field: "phone" };
    }

    if (type === "geo") {
      const latitude = Number(String(value.latitude || "").replace(",", "."));
      const longitude = Number(String(value.longitude || "").replace(",", "."));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return { key: "invalidGeo", field: "latitude" };
      }
    }

    if (type === "event") {
      const start = Date.parse(String(value.start || ""));
      const end = value.end ? Date.parse(String(value.end)) : null;
      if (!Number.isFinite(start) || (end !== null && (!Number.isFinite(end) || end <= start))) {
        return { key: "invalidEventDates", field: value.end ? "end" : "start" };
      }
    }

    return null;
  }

  root.QRContent = {
    TYPES,
    isType,
    getTypes,
    getFields,
    defaults,
    normalize,
    encode,
    validate,
  };
})(window);
