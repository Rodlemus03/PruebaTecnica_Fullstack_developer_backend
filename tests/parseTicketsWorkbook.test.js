const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { parseTicketsWorkbook } = require('../src/import/parseTicketsWorkbook');
const { excelPath } = require('./helpers/database');

const HEADER = [
  'ticket.code',
  'date',
  'supplier.code',
  'supplier.name',
  'land.code',
  'land.name',
  'product.code',
  'product.name',
  'total_qty',
  'price',
  'total',
];

let tempDir;

async function writeWorkbook(name, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('tickets');
  rows.forEach((row) => sheet.addRow(row));

  const filePath = path.join(tempDir, name);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

const day = (value) => new Date(`${value}T00:00:00Z`);

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-tickets-'));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('lectura del Excel', () => {
  let workbook;

  beforeAll(async () => {
    workbook = await parseTicketsWorkbook(excelPath);
  });

  test('lee el archivo original completo', () => {
    const lines = workbook.tickets.flatMap((ticket) => ticket.lines);

    expect(workbook.rowCount).toBe(751);
    expect(workbook.tickets).toHaveLength(367);
    expect(lines).toHaveLength(751);
    expect(workbook.suppliers).toHaveLength(59);
    expect(workbook.lands).toHaveLength(11);
    expect(workbook.products).toHaveLength(13);
    expect(lines.reduce((sum, line) => sum + line.quantity * line.priceMillis, 0)).toBe(769320702);
  });

  test('conserva líneas idénticas, cantidades en cero y códigos alfanuméricos', () => {
    const duplicated = workbook.tickets.find((ticket) => ticket.code === '1068083');
    const alphanumeric = workbook.tickets.find((ticket) => ticket.code === 'GPE01');
    const zeroLines = workbook.tickets.flatMap((ticket) => ticket.lines).filter((line) => line.quantity === 0);

    expect(duplicated.lines).toEqual([
      { productCode: 'PRD001', quantity: 225, priceMillis: 1023 },
      { productCode: 'PRD001', quantity: 225, priceMillis: 1023 },
    ]);
    expect(alphanumeric).toMatchObject({ date: '2023-01-31', supplierCode: 'SUP007', landCode: 'LOC008' });
    expect(alphanumeric.lines).toHaveLength(2);
    expect(zeroLines).toHaveLength(11);
  });

  test('lee las fechas sin desfase de zona horaria', () => {
    const dates = workbook.tickets.map((ticket) => ticket.date).sort();

    expect(dates[0]).toBe('2023-01-02');
    expect(dates[dates.length - 1]).toBe('2023-02-27');
    expect(workbook.tickets.find((ticket) => ticket.code === '1115651').date).toBe('2023-01-07');
  });

  test('reporta cada fila inválida con su número de fila y columna', async () => {
    const filePath = await writeWorkbook('invalido.xlsx', [
      HEADER,
      ['T1', day('2023-01-02'), 'SUP1', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', 10, 1.5, 15],
      ['T2', 'no es fecha', 'SUP1', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', -1, 1.2345, 10],
      ['T3', day('2023-01-03'), '', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', 2, 1, 2],
      ['T4', day('2023-01-03'), 'SUP1', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', 3, 1.5, 4],
      ['T1', day('2023-01-05'), 'SUP1', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', 1, 1, 1],
      ['T5', day('2023-01-06'), 'SUP1', 'Otro nombre', 'L1', 'Land', 'P1', 'Producto', 1, 1, 1],
    ]);

    const error = await parseTicketsWorkbook(filePath).catch((caught) => caught);

    expect(error.message).toBe('El archivo contiene 7 error(es) de datos');
    expect(error.details).toEqual([
      expect.objectContaining({ row: 3, column: 'date' }),
      expect.objectContaining({ row: 3, column: 'total_qty' }),
      expect.objectContaining({ row: 3, column: 'price' }),
      expect.objectContaining({ row: 4, column: 'supplier.code', message: 'es obligatorio' }),
      expect.objectContaining({ row: 5, column: 'total', message: expect.stringContaining('no coincide') }),
      expect.objectContaining({ row: 6, message: expect.stringContaining('El ticket T1') }),
      expect.objectContaining({ row: 7, message: expect.stringContaining('El proveedor SUP1') }),
    ]);
  });

  test('falla si falta una columna del encabezado', async () => {
    const filePath = await writeWorkbook('sin-precio.xlsx', [
      HEADER.filter((column) => column !== 'price'),
      ['T1', day('2023-01-02'), 'SUP1', 'Proveedor', 'L1', 'Land', 'P1', 'Producto', 10, 15],
    ]);

    await expect(parseTicketsWorkbook(filePath)).rejects.toThrow('Faltan columnas en el encabezado: price');
  });

  test('falla si el archivo no tiene filas de datos', async () => {
    const filePath = await writeWorkbook('vacio.xlsx', [HEADER]);

    await expect(parseTicketsWorkbook(filePath)).rejects.toMatchObject({
      details: [{ row: null, message: 'El archivo no contiene filas de datos' }],
    });
  });

  test('falla si el archivo no existe o no es un Excel', async () => {
    const textFile = path.join(tempDir, 'texto.xlsx');
    fs.writeFileSync(textFile, 'no es un excel');

    await expect(parseTicketsWorkbook(path.join(tempDir, 'no-existe.xlsx'))).rejects.toThrow('No se encontró el archivo');
    await expect(parseTicketsWorkbook(textFile)).rejects.toThrow('No se pudo leer el archivo como Excel');
  });
});
