const path = require('path');
const { importTickets } = require('../src/import/importTickets');
const { Ticket, TicketDetail } = require('../src/models');
const { sequelize, excelPath, resetDatabase } = require('./helpers/database');

async function countRows() {
  const [counts] = await sequelize.query(
    `SELECT (SELECT COUNT(*) FROM suppliers)::int AS suppliers,
            (SELECT COUNT(*) FROM lands)::int AS lands,
            (SELECT COUNT(*) FROM products)::int AS products,
            (SELECT COUNT(*) FROM tickets)::int AS tickets,
            (SELECT COUNT(*) FROM ticket_details)::int AS details,
            (SELECT SUM(total) FROM ticket_details)::text AS total`,
    { type: 'SELECT' },
  );
  return counts;
}

beforeAll(resetDatabase);

afterAll(() => sequelize.close());

describe('importación del Excel', () => {
  test('importa todos los registros y cuadra con el archivo', async () => {
    const summary = await importTickets(excelPath);

    expect(summary).toEqual({
      rows: 751,
      suppliers: 59,
      lands: 11,
      products: 13,
      tickets: { total: 367, created: 367, updated: 0 },
      details: 751,
      total: '769320.702',
    });
    expect(await countRows()).toEqual({
      suppliers: 59,
      lands: 11,
      products: 13,
      tickets: 367,
      details: 751,
      total: '769320.702',
    });
  });

  test('guarda las líneas en el orden del archivo con su total calculado', async () => {
    const ticket = await Ticket.findOne({
      where: { code: '1115651' },
      include: [{ model: TicketDetail, as: 'details' }],
      order: [[{ model: TicketDetail, as: 'details' }, 'lineNumber', 'ASC']],
    });

    expect(ticket.date).toBe('2023-01-07');
    expect(ticket.details.map(({ lineNumber, quantity, price, total }) => ({ lineNumber, quantity, price, total }))).toEqual([
      { lineNumber: 1, quantity: 1475, price: '0.700', total: '1032.500' },
      { lineNumber: 2, quantity: 4650, price: '1.250', total: '5812.500' },
    ]);
  });

  test('reimportar no duplica, conserva tickets ajenos al Excel y restaura los editados', async () => {
    await Ticket.create(
      {
        code: 'MANUAL-1',
        date: '2023-03-01',
        supplierId: 1,
        landId: 1,
        details: [{ lineNumber: 1, productId: 1, quantity: 10, price: '2.000' }],
      },
      { include: [{ model: TicketDetail, as: 'details' }] },
    );
    const edited = await Ticket.findOne({ where: { code: '1115651' } });
    await TicketDetail.update({ quantity: 1 }, { where: { ticketId: edited.id, lineNumber: 1 } });

    const summary = await importTickets(excelPath);
    const restoredLine = await TicketDetail.findOne({ where: { ticketId: edited.id, lineNumber: 1 } });

    expect(summary.tickets).toEqual({ total: 367, created: 0, updated: 367 });
    expect(await countRows()).toMatchObject({ tickets: 368, details: 752, total: '769340.702' });
    expect(restoredLine.quantity).toBe(1475);
    expect(await Ticket.count({ where: { code: 'MANUAL-1' } })).toBe(1);
  });

  test('un archivo inválido no modifica la base de datos', async () => {
    const before = await countRows();

    await expect(importTickets(path.join(__dirname, 'no-existe.xlsx'))).rejects.toThrow('No se encontró el archivo');
    expect(await countRows()).toEqual(before);
  });
});
