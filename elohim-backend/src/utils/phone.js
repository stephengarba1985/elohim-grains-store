const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits;
  }

  if (digits.length === 10) {
    return `0${digits}`;
  }

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("234")) {
    return `0${digits.slice(3)}`;
  }

  return null;
};

const canonicalPhone = (value) => {
  const local = normalizePhone(value);

  if (!local || local.length !== 11) {
    return null;
  }

  return `234${local.slice(1)}`;
};

module.exports = {
  normalizePhone,
  canonicalPhone,
};
