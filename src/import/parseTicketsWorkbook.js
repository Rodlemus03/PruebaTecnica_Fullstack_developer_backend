const fs = require('fs');
const ExcelJS = require('exceljs');

const COLUMNS = {
  ticketCode: 'ticket.code',
  date: 'date',
  supplierCode: 'supplier.code',
  supplierName: 'supplier.name',
  landCode: 'land.code',
  landName: 'land.name',
  productCode: 'product.code',
  productName: 'product.name',
  quantity: 'total_qty',
  price: 'price',
  total: 'total',
};

const CODE_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 150;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_DAYS = 25569;

function importError(message, details) {
  const error = new Error(message);
  if (details) {
    error.details = details;
  }
  return error;
}

function cellValue(cell) {
  const { value } = cell;

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
  }

  return value;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toDateOnly(value) {
  let time = NaN;

  if (value instanceof Date) {
    time = value.getTime();
  } else if (typeof value === 'number') {
    time = (value - EXCEL_EPOCH_DAYS) * MS_PER_DAY;
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    time = Date.parse(`${value.trim()}T00:00:00Z`);
  }

  if (!Number.isFinite(time)) return null;

  const date = new Date(Math.round(time / MS_PER_DAY) * MS_PER_DAY).toISOString().slice(0, 10);

  if (typeof value === 'string' && date !== value.trim()) return null;

  return date;
}

function toNumber(value) {
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return value;
}

function toMillis(value) {
  const number = toNumber(value);
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;

  const millis = Math.round(number * 1000);
  if (Math.abs(number * 1000 - millis) > 1e-6) return null;

  return millis;
}

function readHeader(row) {
  const positions = {};

  row.eachCell((cell, columnNumber) => {
    positions[toText(cellValue(cell)).toLowerCase()] = columnNumber;
  });

  const missing = Object.values(COLUMNS).filter((name) => !positions[name]);
  if (missing.length > 0) {
    throw importError(`Faltan columnas en el encabezado: ${missing.join(', ')}`);
  }

  return Object.fromEntries(Object.entries(COLUMNS).map(([key, name]) => [key, positions[name]]));
}

function parseRow(raw, rowNumber, errors) {
  const rowErrors = [];
  const addError = (key, message) => rowErrors.push({ row: rowNumber, column: COLUMNS[key], message });

  const line = {
    ticketCode: toText(raw.ticketCode),
    date: toDateOnly(raw.date),
    supplierCode: toText(raw.supplierCode),
    supplierName: toText(raw.supplierName),
    landCode: toText(raw.landCode),
    landName: toText(raw.landName),
    productCode: toText(raw.productCode),
    productName: toText(raw.productName),
    quantity: toNumber(raw.quantity),
    priceMillis: toMillis(raw.price),
    totalMillis: toMillis(raw.total),
  };

  ['ticketCode', 'supplierCode', 'landCode', 'productCode'].forEach((key) => {
    if (!line[key]) addError(key, 'es obligatorio');
    else if (line[key].length > CODE_MAX_LENGTH) addError(key, `no puede superar ${CODE_MAX_LENGTH} caracteres`);
  });

  ['supplierName', 'landName', 'productName'].forEach((key) => {
    if (!line[key]) addError(key, 'es obligatorio');
    else if (line[key].length > NAME_MAX_LENGTH) addError(key, `no puede superar ${NAME_MAX_LENGTH} caracteres`);
  });

  if (!line.date) addError('date', 'no es una fecha válida');

  if (!Number.isInteger(line.quantity) || line.quantity < 0) {
    addError('quantity', 'debe ser un número entero mayor o igual a 0');
  }

  if (line.priceMillis === null || line.priceMillis <= 0) {
    addError('price', 'debe ser un número mayor que 0 con máximo 3 decimales');
  }

  if (line.totalMillis === null) {
    addError('total', 'debe ser un número con máximo 3 decimales');
  } else if (rowErrors.length === 0 && line.totalMillis !== line.quantity * line.priceMillis) {
    addError('total', `no coincide con cantidad x precio (${line.quantity} x ${line.priceMillis / 1000})`);
  }

  if (rowErrors.length > 0) {
    errors.push(...rowErrors);
    return null;
  }

  return line;
}

function registerCatalogItem(catalog, code, name, label, rowNumber, errors) {
  const existing = catalog.get(code);

  if (!existing) {
    catalog.set(code, { code, name, firstRow: rowNumber });
  } else if (existing.name !== name) {
    errors.push({
      row: rowNumber,
      message: `El ${label} ${code} tiene el nombre "${name}" pero en la fila ${existing.firstRow} es "${existing.name}"`,
    });
  }
}

function registerTicketLine(tickets, line, rowNumber, errors) {
  const ticket = tickets.get(line.ticketCode);
  const lineData = {
    productCode: line.productCode,
    quantity: line.quantity,
    priceMillis: line.priceMillis,
  };

  if (!ticket) {
    tickets.set(line.ticketCode, {
      code: line.ticketCode,
      date: line.date,
      supplierCode: line.supplierCode,
      landCode: line.landCode,
      firstRow: rowNumber,
      lines: [lineData],
    });
    return;
  }

  if (ticket.date !== line.date || ticket.supplierCode !== line.supplierCode || ticket.landCode !== line.landCode) {
    errors.push({
      row: rowNumber,
      message: `El ticket ${line.ticketCode} tiene fecha, proveedor o land distintos a los de la fila ${ticket.firstRow}`,
    });
    return;
  }

  ticket.lines.push(lineData);
}

async function parseTicketsWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw importError(`No se encontró el archivo ${filePath}`);
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(filePath);
  } catch (error) {
    throw importError(`No se pudo leer el archivo como Excel (.xlsx): ${error.message}`);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw importError('El archivo no contiene hojas');
  }

  const columns = readHeader(sheet.getRow(1));
  const errors = [];
  const suppliers = new Map();
  const lands = new Map();
  const products = new Map();
  const tickets = new Map();
  let rowCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw = Object.fromEntries(
      Object.entries(columns).map(([key, columnNumber]) => [key, cellValue(row.getCell(columnNumber))]),
    );

    if (Object.values(raw).every((value) => toText(value) === '')) return;

    rowCount += 1;
    const line = parseRow(raw, rowNumber, errors);
    if (!line) return;

    registerCatalogItem(suppliers, line.supplierCode, line.supplierName, 'proveedor', rowNumber, errors);
    registerCatalogItem(lands, line.landCode, line.landName, 'land', rowNumber, errors);
    registerCatalogItem(products, line.productCode, line.productName, 'producto', rowNumber, errors);
    registerTicketLine(tickets, line, rowNumber, errors);
  });

  if (rowCount === 0) {
    errors.push({ row: null, message: 'El archivo no contiene filas de datos' });
  }

  if (errors.length > 0) {
    throw importError(`El archivo contiene ${errors.length} error(es) de datos`, errors);
  }

  const toCatalogList = (catalog) => [...catalog.values()].map(({ code, name }) => ({ code, name }));

  return {
    rowCount,
    suppliers: toCatalogList(suppliers),
    lands: toCatalogList(lands),
    products: toCatalogList(products),
    tickets: [...tickets.values()],
  };
}

module.exports = { parseTicketsWorkbook };
