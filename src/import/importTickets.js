const { QueryTypes } = require('sequelize');
const { sequelize, Supplier, Land, Product, Ticket, TicketDetail } = require('../models');
const { parseTicketsWorkbook } = require('./parseTicketsWorkbook');

const formatMillis = (millis) => (millis / 1000).toFixed(3);

async function upsertByCode(Model, records, updateFields, transaction) {
  await Model.bulkCreate(records, {
    updateOnDuplicate: [...updateFields, 'updatedAt'],
    conflictAttributes: ['code'],
    transaction,
  });

  const saved = await Model.findAll({
    attributes: ['id', 'code'],
    where: { code: records.map((record) => record.code) },
    transaction,
  });

  return new Map(saved.map((record) => [record.code, record.id]));
}

async function importTickets(filePath) {
  const workbook = await parseTicketsWorkbook(filePath);
  const ticketCodes = workbook.tickets.map((ticket) => ticket.code);
  const expectedLines = workbook.tickets.reduce((sum, ticket) => sum + ticket.lines.length, 0);
  const expectedTotal = formatMillis(
    workbook.tickets
      .flatMap((ticket) => ticket.lines)
      .reduce((sum, line) => sum + line.quantity * line.priceMillis, 0),
  );

  return sequelize.transaction(async (transaction) => {
    const supplierIds = await upsertByCode(Supplier, workbook.suppliers, ['name'], transaction);
    const landIds = await upsertByCode(Land, workbook.lands, ['name'], transaction);
    const productIds = await upsertByCode(Product, workbook.products, ['name'], transaction);

    const existingTickets = await Ticket.count({ where: { code: ticketCodes }, transaction });

    const ticketIds = await upsertByCode(
      Ticket,
      workbook.tickets.map((ticket) => ({
        code: ticket.code,
        date: ticket.date,
        supplierId: supplierIds.get(ticket.supplierCode),
        landId: landIds.get(ticket.landCode),
      })),
      ['date', 'supplierId', 'landId'],
      transaction,
    );

    const importedTicketIds = [...ticketIds.values()];

    await TicketDetail.destroy({ where: { ticketId: importedTicketIds }, transaction });

    await TicketDetail.bulkCreate(
      workbook.tickets.flatMap((ticket) =>
        ticket.lines.map((line, index) => ({
          ticketId: ticketIds.get(ticket.code),
          lineNumber: index + 1,
          productId: productIds.get(line.productCode),
          quantity: line.quantity,
          price: formatMillis(line.priceMillis),
        })),
      ),
      { transaction },
    );

    const [stored] = await sequelize.query(
      `SELECT COUNT(*)::int AS lines, ROUND(COALESCE(SUM(total), 0), 3)::text AS total
       FROM ticket_details
       WHERE ticket_id IN (:ticketIds)`,
      { replacements: { ticketIds: importedTicketIds }, type: QueryTypes.SELECT, transaction },
    );

    if (importedTicketIds.length !== workbook.tickets.length || stored.lines !== expectedLines || stored.total !== expectedTotal) {
      throw new Error(
        `La verificación posterior no coincide con el archivo: ${importedTicketIds.length} tickets, ` +
          `${stored.lines} líneas y total ${stored.total} en la base; se esperaban ${workbook.tickets.length}, ` +
          `${expectedLines} y ${expectedTotal}`,
      );
    }

    return {
      rows: workbook.rowCount,
      suppliers: workbook.suppliers.length,
      lands: workbook.lands.length,
      products: workbook.products.length,
      tickets: {
        total: workbook.tickets.length,
        created: workbook.tickets.length - existingTickets,
        updated: existingTickets,
      },
      details: stored.lines,
      total: stored.total,
    };
  });
}

module.exports = { importTickets };
