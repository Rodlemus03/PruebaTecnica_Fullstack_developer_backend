const request = require('supertest');
const app = require('../src/app');
const { Supplier, Land, Product, TicketDetail } = require('../src/models');
const { sequelize, loadExcelData, toMillis } = require('./helpers/database');

const catalogIds = {};

async function findId(Model, code) {
  const record = await Model.findOne({ where: { code } });
  return record.id;
}

beforeAll(async () => {
  await loadExcelData();
  catalogIds.sup009 = await findId(Supplier, 'SUP009');
  catalogIds.sup004 = await findId(Supplier, 'SUP004');
  catalogIds.loc010 = await findId(Land, 'LOC010');
  catalogIds.loc001 = await findId(Land, 'LOC001');
  catalogIds.prd001 = await findId(Product, 'PRD001');
  catalogIds.prd003 = await findId(Product, 'PRD003');
  catalogIds.prd010 = await findId(Product, 'PRD010');
});

afterAll(() => sequelize.close());

describe('GET /api/tickets', () => {
  test('pagina los tickets con proveedor, land y total', async () => {
    const response = await request(app).get('/api/tickets').expect(200);

    expect(response.body.meta).toEqual({ page: 1, limit: 20, totalItems: 367, totalPages: 19 });
    expect(response.body.data).toHaveLength(20);
    expect(response.body.data[0]).toEqual({
      id: expect.any(Number),
      code: expect.any(String),
      date: '2023-02-27',
      total: expect.stringMatching(/^\d+\.\d{3}$/),
      lineCount: expect.any(Number),
      supplier: { id: expect.any(Number), code: expect.any(String), name: expect.any(String) },
      land: { id: expect.any(Number), code: expect.any(String), name: expect.any(String) },
    });
  });

  test('la suma de todas las páginas cuadra con el Excel', async () => {
    let totalMillis = 0;
    let ticketCount = 0;

    for (let page = 1; page <= 4; page += 1) {
      const response = await request(app).get(`/api/tickets?limit=100&page=${page}`).expect(200);
      response.body.data.forEach((ticket) => {
        totalMillis += toMillis(ticket.total);
        ticketCount += 1;
      });
    }

    expect(ticketCount).toBe(367);
    expect(totalMillis).toBe(769320702);
  });

  test.each([
    ['proveedor', () => `supplierId=${catalogIds.sup009}`, 33],
    ['land', () => `landId=${catalogIds.loc010}`, 80],
    ['producto', () => `productId=${catalogIds.prd010}`, 35],
    ['rango de fechas', () => 'dateFrom=2023-01-02&dateTo=2023-01-08', 70],
    ['búsqueda por proveedor', () => 'search=iota', 33],
    ['búsqueda por código', () => 'search=gpe', 1],
  ])('filtra por %s', async (label, buildQuery, expected) => {
    const response = await request(app).get(`/api/tickets?${buildQuery()}`).expect(200);

    expect(response.body.meta.totalItems).toBe(expected);
  });

  test('ordena por total de mayor a menor', async () => {
    const response = await request(app).get('/api/tickets?sort=-total&limit=2').expect(200);

    expect(response.body.data.map(({ code, total }) => ({ code, total }))).toEqual([
      { code: 'GPE01', total: '269077.200' },
      { code: '1136256', total: '53087.600' },
    ]);
  });

  test('rechaza parámetros inválidos indicando el campo', async () => {
    const response = await request(app).get('/api/tickets?page=0&limit=500&sort=precio').expect(400);

    expect(response.body.error.details.map((detail) => detail.field)).toEqual(['page', 'limit', 'sort']);
  });
});

describe('GET /api/tickets/:id', () => {
  test('devuelve el ticket con sus líneas ordenadas', async () => {
    const list = await request(app).get('/api/tickets?search=1115651');
    const response = await request(app).get(`/api/tickets/${list.body.data[0].id}`).expect(200);

    expect(response.body.data).toMatchObject({
      code: '1115651',
      date: '2023-01-07',
      total: '6845.000',
      lineCount: 2,
      supplier: { code: 'SUP009' },
      land: { code: 'LOC010' },
    });
    expect(
      response.body.data.details.map((line) => [line.lineNumber, line.product.code, line.quantity, line.price, line.total]),
    ).toEqual([
      [1, 'PRD003', 1475, '0.700', '1032.500'],
      [2, 'PRD001', 4650, '1.250', '5812.500'],
    ]);
  });

  test('responde 404 si no existe y 400 si el id no es válido', async () => {
    await request(app).get('/api/tickets/999999').expect(404);
    await request(app).get('/api/tickets/abc').expect(400);
  });
});

describe('creación, edición y eliminación', () => {
  let ticketId;

  const buildPayload = (overrides = {}) => ({
    code: 'API-TEST-1',
    date: '2023-03-06',
    supplierId: catalogIds.sup009,
    landId: catalogIds.loc010,
    details: [
      { productId: catalogIds.prd001, quantity: 3, price: '1.023' },
      { productId: catalogIds.prd003, quantity: 1475, price: 0.7 },
      { productId: catalogIds.prd001, quantity: 3, price: '1.023' },
    ],
    ...overrides,
  });

  test('crea un ticket con totales exactos', async () => {
    const response = await request(app).post('/api/tickets').send(buildPayload()).expect(201);
    ticketId = response.body.data.id;

    expect(response.body.data).toMatchObject({ code: 'API-TEST-1', total: '1038.638', lineCount: 3 });
    expect(response.body.data.details.map((line) => line.total)).toEqual(['3.069', '1032.500', '3.069']);
  });

  test('rechaza un código duplicado con 409', async () => {
    const response = await request(app).post('/api/tickets').send(buildPayload()).expect(409);

    expect(response.body.error.message).toBe('Ya existe un ticket con el código "API-TEST-1"');
  });

  test('devuelve todos los errores de validación', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .send({ code: '', date: '2023-02-30', supplierId: '1', details: [{ productId: 0, quantity: -1, price: '1.2345' }] })
      .expect(400);

    expect(response.body.error.details.map((detail) => detail.field)).toEqual([
      'code',
      'date',
      'supplierId',
      'landId',
      'details[0].productId',
      'details[0].quantity',
      'details[0].price',
    ]);
  });

  test('rechaza proveedores y productos inexistentes', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .send(buildPayload({ code: 'API-TEST-2', supplierId: 999999, details: [{ productId: 999999, quantity: 1, price: '1' }] }))
      .expect(400);

    expect(response.body.error.details.map((detail) => detail.field)).toEqual(['supplierId', 'details[0].productId']);
  });

  test('rechaza un cuerpo que no es JSON válido', async () => {
    await request(app).post('/api/tickets').set('Content-Type', 'application/json').send('{"code":').expect(400);
  });

  test('edita la cabecera y reemplaza las líneas', async () => {
    const response = await request(app)
      .put(`/api/tickets/${ticketId}`)
      .send(
        buildPayload({
          code: 'API-TEST-1B',
          date: '2023-03-07',
          supplierId: catalogIds.sup004,
          landId: catalogIds.loc001,
          details: [{ productId: catalogIds.prd010, quantity: 1800, price: '0.75' }],
        }),
      )
      .expect(200);

    expect(response.body.data).toMatchObject({
      code: 'API-TEST-1B',
      date: '2023-03-07',
      total: '1350.000',
      lineCount: 1,
      supplier: { code: 'SUP004' },
      land: { code: 'LOC001' },
    });
    expect(await TicketDetail.count({ where: { ticketId } })).toBe(1);
  });

  test('no permite cambiar el código por uno existente', async () => {
    await request(app).put(`/api/tickets/${ticketId}`).send(buildPayload({ code: 'GPE01' })).expect(409);
  });

  test('elimina el ticket junto con sus líneas', async () => {
    await request(app).delete(`/api/tickets/${ticketId}`).expect(204);
    await request(app).get(`/api/tickets/${ticketId}`).expect(404);
    await request(app).delete(`/api/tickets/${ticketId}`).expect(404);

    expect(await TicketDetail.count({ where: { ticketId } })).toBe(0);
  });
});

describe('catálogos', () => {
  test.each([
    ['/api/suppliers', 59, 'SUP001'],
    ['/api/lands', 11, 'LOC001'],
    ['/api/products', 13, 'PRD001'],
  ])('GET %s devuelve %i registros ordenados por código', async (url, count, firstCode) => {
    const response = await request(app).get(url).expect(200);

    expect(response.body.data).toHaveLength(count);
    expect(response.body.data[0]).toEqual({ id: expect.any(Number), code: firstCode, name: expect.any(String) });
  });
});
