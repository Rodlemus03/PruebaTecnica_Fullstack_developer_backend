const HttpError = require('../utils/httpError');

const MAX_INTEGER = 2147483647;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_INTEGER;
}

function toPositiveInteger(text) {
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return isPositiveInteger(number) ? number : null;
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readQueryParam(query, field, errors) {
  const value = query[field];

  if (value === undefined) return undefined;

  if (typeof value !== 'string') {
    errors.push({ field, message: 'debe enviarse una sola vez como texto' });
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseIdParam(value) {
  const id = toPositiveInteger(String(value));

  if (id === null) {
    throw new HttpError(400, 'El id debe ser un entero positivo');
  }

  return id;
}

module.exports = {
  isPositiveInteger,
  toPositiveInteger,
  isDateOnly,
  readQueryParam,
  parseIdParam,
};
