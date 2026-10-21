const request = require('supertest');
const app = require('../src/app');
const { sequelize, loadExcelData, toMillis } = require('./helpers/database');

const sumMillis = (items) => items.reduce((sum, item) => sum + toMillis(item.total), 0);

beforeAll(loadExcelData);

afterAll(() => sequelize.close());

describe('GET /api/payments/weekly', () => {
  test.each([
    [1, '2023-01-02', '2023-01-08', 70, 31, 144, '97194.820'],
    [2, '2023-01-09', '2023-01-15', 60, 30, 120, '67151.365'],
    [3, '2023-01-16', '2023-01-22', 57, 24, 116, '67143.047'],
    [4, '2023-01-23', '2023-01-29', 82, 27, 168, '149353.569'],
    [5, '2023-01-30', '2023-02-05', 39, 21, 81, '290018.951'],
    [6, '2023-02-06', '2023-02-12', 30, 14, 62, '53053.042'],
    [7, '2023-02-13', '2023-02-19', 18, 11, 37, '26831.578'],
    [8, '2023-02-20', '2023-02-26', 8, 7, 16, '8277.035'],
    [9, '2023-02-27', '2023-03-05', 3, 3, 7, '10297.295'],
  ])('2023-W%i (%s a %s) cuadra con el Excel', async (week, startDate, endDate, ticketCount, supplierCount, lineCount, total) => {
    const response = await request(app).get(`/api/payments/weekly?year=2023&week=${week}`).expect(200);

    expect(response.body.data).toMatchObject({ year: 2023, week, startDate, endDate });
    expect(response.body.data.summary).toEqual({ supplierCount, ticketCount, lineCount, total });
    expect(response.body.data.suppliers).toHaveLength(supplierCount);
  });

  test('los totales cuadran entre proveedores, productos, tickets y líneas', async () => {
    const { body } = await request(app).get('/api/payments/weekly?year=2023&week=4').expect(200);
    const { summary, suppliers } = body.data;

    expect(sumMillis(suppliers)).toBe(toMillis(summary.total));

    suppliers.forEach((supplier) => {
      expect(sumMillis(supplier.tickets)).toBe(toMillis(supplier.total));
      expect(sumMillis(supplier.products)).toBe(toMillis(supplier.total));
      expect(supplier.tickets).toHaveLength(supplier.ticketCount);

      supplier.tickets.forEach((ticket) => {
        expect(ticket.date >= body.data.startDate && ticket.date <= body.data.endDate).toBe(true);
        expect(sumMillis(ticket.details)).toBe(toMillis(ticket.total));
        ticket.details.forEach((line) => {
          expect(line.quantity * toMillis(line.price)).toBe(toMillis(line.total));
        });
      });
    });
  });

  test('desglosa el pago de un proveedor por producto y por ticket', async () => {
    const { body } = await request(app).get('/api/payments/weekly?year=2023&week=5').expect(200);
    const supplier = body.data.suppliers.find((item) => item.supplier.code === 'SUP007');

    expect(supplier.total).toBe('269077.200');
    expect(supplier.products.map(({ product, quantity, total }) => [product.code, quantity, total])).toEqual([
      ['PRD004', 95520, '133728.000'],
      ['PRD005', 51660, '135349.200'],
    ]);
    expect(supplier.tickets.map((ticket) => [ticket.code, ticket.date, ticket.land.code, ticket.details.length])).toEqual([
      ['GPE01', '2023-01-31', 'LOC008', 2],
    ]);
  });

  test('una semana sin registros responde con totales en cero', async () => {
    const { body } = await request(app).get('/api/payments/weekly?year=2023&week=20').expect(200);

    expect(body.data).toEqual({
      year: 2023,
      week: 20,
      startDate: '2023-05-15',
      endDate: '2023-05-21',
      summary: { supplierCount: 0, ticketCount: 0, lineCount: 0, total: '0.000' },
      suppliers: [],
    });
  });

  test('asigna a la semana ISO correcta un ticket que cruza de año', async () => {
    const created = await request(app)
      .post('/api/tickets')
      .send({ code: 'CRUCE-1', date: '2023-01-01', supplierId: 1, landId: 1, details: [{ productId: 1, quantity: 10, price: '1.5' }] })
      .expect(201);

    const previousYear = await request(app).get('/api/payments/weekly?year=2022&week=52').expect(200);
    const firstWeek = await request(app).get('/api/payments/weekly?year=2023&week=1').expect(200);

    expect(previousYear.body.data).toMatchObject({ startDate: '2022-12-26', endDate: '2023-01-01' });
    expect(previousYear.body.data.summary).toMatchObject({ ticketCount: 1, total: '15.000' });
    expect(firstWeek.body.data.summary.ticketCount).toBe(70);

    await request(app).delete(`/api/tickets/${created.body.data.id}`).expect(204);
  });

  test.each([
    ['week=4', 'year', 'es obligatorio'],
    ['year=2023', 'week', 'es obligatorio'],
    ['year=2023&week=53', 'week', 'el año 2023 tiene 52 semanas ISO'],
    ['year=2023&week=0', 'week', 'debe ser un entero entre 1 y 53'],
    ['year=abc&week=1', 'year', 'debe ser un entero entre 1900 y 2100'],
  ])('valida los parámetros (%s)', async (query, field, message) => {
    const response = await request(app).get(`/api/payments/weekly?${query}`).expect(400);

    expect(response.body.error.details).toEqual([{ field, message }]);
  });

  test('acepta la semana 53 en años que la tienen', async () => {
    const response = await request(app).get('/api/payments/weekly?year=2020&week=53').expect(200);

    expect(response.body.data).toMatchObject({ startDate: '2020-12-28', endDate: '2021-01-03' });
  });
});

describe('GET /api/payments/weeks', () => {
  test('lista las semanas con tickets y sus totales', async () => {
    const { body } = await request(app).get('/api/payments/weeks').expect(200);

    expect(body.data).toHaveLength(9);
    expect(body.data[0]).toEqual({
      year: 2023,
      week: 9,
      startDate: '2023-02-27',
      endDate: '2023-03-05',
      supplierCount: 3,
      ticketCount: 3,
      total: '10297.295',
    });
    expect(sumMillis(body.data)).toBe(769320702);
  });
});
