const HttpError = require('../utils/httpError');
const { isPositiveInteger, toPositiveInteger, isDateOnly, readQueryParam } = require('./common');

const CODE_MAX_LENGTH = 20;
const SEARCH_MAX_LENGTH = 50;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_LINES = 50;
const MAX_QUANTITY = 1000000;
const PRICE_PATTERN = /^\d{1,5}(\.\d{1,3})?$/;
const SORT_OPTIONS = ['date', '-date', 'code', '-code', 'total', '-total'];

function validateTicketQuery(query) {
  const errors = [];
  const filters = { page: 1, limit: DEFAULT_LIMIT, sort: '-date' };

  ['page', 'limit', 'supplierId', 'landId', 'productId'].forEach((field) => {
    const raw = readQueryParam(query, field, errors);
    if (raw === undefined) return;

    const number = toPositiveInteger(raw);
    if (number === null) {
      errors.push({ field, message: 'debe ser un entero positivo' });
    } else {
      filters[field] = number;
    }
  });

  if (filters.limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `no puede ser mayor que ${MAX_LIMIT}` });
  }

  ['dateFrom', 'dateTo'].forEach((field) => {
    const raw = readQueryParam(query, field, errors);
    if (raw === undefined) return;

    if (isDateOnly(raw)) {
      filters[field] = raw;
    } else {
      errors.push({ field, message: 'debe ser una fecha válida con formato YYYY-MM-DD' });
    }
  });

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    errors.push({ field: 'dateTo', message: 'debe ser igual o posterior a dateFrom' });
  }

  const search = readQueryParam(query, 'search', errors);
  if (search !== undefined) {
    if (search.length > SEARCH_MAX_LENGTH) {
      errors.push({ field: 'search', message: `no puede superar ${SEARCH_MAX_LENGTH} caracteres` });
    } else {
      filters.search = search;
    }
  }

  const sort = readQueryParam(query, 'sort', errors);
  if (sort !== undefined) {
    if (SORT_OPTIONS.includes(sort)) {
      filters.sort = sort;
    } else {
      errors.push({ field: 'sort', message: `debe ser uno de: ${SORT_OPTIONS.join(', ')}` });
    }
  }

  if (errors.length > 0) {
    throw new HttpError(400, 'Parámetros de consulta inválidos', errors);
  }

  return filters;
}

function normalizePrice(value) {
  let text = '';

  if (typeof value === 'number') text = String(value);
  else if (typeof value === 'string') text = value.trim();

  if (!PRICE_PATTERN.test(text) || Number(text) <= 0) return null;

  return text;
}

function validateDetail(line, index, errors) {
  const prefix = `details[${index}]`;

  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    errors.push({ field: prefix, message: 'debe ser un objeto' });
    return null;
  }

  if (!isPositiveInteger(line.productId)) {
    errors.push({ field: `${prefix}.productId`, message: 'debe ser un entero positivo' });
  }

  if (!Number.isInteger(line.quantity) || line.quantity < 0 || line.quantity > MAX_QUANTITY) {
    errors.push({ field: `${prefix}.quantity`, message: `debe ser un entero entre 0 y ${MAX_QUANTITY}` });
  }

  const price = normalizePrice(line.price);
  if (price === null) {
    errors.push({
      field: `${prefix}.price`,
      message: 'debe ser mayor que 0, menor que 100000 y tener máximo 3 decimales',
    });
  }

  return { productId: line.productId, quantity: line.quantity, price };
}

function validateTicketPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'El cuerpo de la petición debe ser un objeto JSON');
  }

  const errors = [];
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';

  if (!code) {
    errors.push({ field: 'code', message: 'es obligatorio' });
  } else if (code.length > CODE_MAX_LENGTH) {
    errors.push({ field: 'code', message: `no puede superar ${CODE_MAX_LENGTH} caracteres` });
  }

  if (!isDateOnly(date)) {
    errors.push({ field: 'date', message: 'debe ser una fecha válida con formato YYYY-MM-DD' });
  }

  ['supplierId', 'landId'].forEach((field) => {
    if (!isPositiveInteger(body[field])) {
      errors.push({ field, message: 'debe ser un entero positivo' });
    }
  });

  let details = [];

  if (!Array.isArray(body.details) || body.details.length === 0) {
    errors.push({ field: 'details', message: 'debe incluir al menos una línea' });
  } else if (body.details.length > MAX_LINES) {
    errors.push({ field: 'details', message: `no puede tener más de ${MAX_LINES} líneas` });
  } else {
    details = body.details.map((line, index) => validateDetail(line, index, errors));
  }

  if (errors.length > 0) {
    throw new HttpError(400, 'Datos del ticket inválidos', errors);
  }

  return {
    code,
    date,
    supplierId: body.supplierId,
    landId: body.landId,
    details,
  };
}

module.exports = {
  validateTicketQuery,
  validateTicketPayload,
};
