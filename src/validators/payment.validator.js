const HttpError = require('../utils/httpError');
const { toPositiveInteger, readQueryParam } = require('./common');
const { weeksInIsoYear } = require('../utils/isoWeek');

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function readIntegerInRange(query, field, min, max, errors) {
  const previousErrors = errors.length;
  const raw = readQueryParam(query, field, errors);

  if (errors.length > previousErrors) return undefined;

  if (raw === undefined) {
    errors.push({ field, message: 'es obligatorio' });
    return undefined;
  }

  const number = toPositiveInteger(raw);
  if (number === null || number < min || number > max) {
    errors.push({ field, message: `debe ser un entero entre ${min} y ${max}` });
    return undefined;
  }

  return number;
}

function validateWeeklyPaymentQuery(query) {
  const errors = [];
  const year = readIntegerInRange(query, 'year', MIN_YEAR, MAX_YEAR, errors);
  const week = readIntegerInRange(query, 'week', 1, 53, errors);

  if (year !== undefined && week !== undefined && week > weeksInIsoYear(year)) {
    errors.push({ field: 'week', message: `el año ${year} tiene ${weeksInIsoYear(year)} semanas ISO` });
  }

  if (errors.length > 0) {
    throw new HttpError(400, 'Parámetros de consulta inválidos', errors);
  }

  return { year, week };
}

module.exports = { validateWeeklyPaymentQuery };
