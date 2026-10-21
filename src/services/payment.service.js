const { Op, QueryTypes } = require('sequelize');
const { sequelize, Ticket, TicketDetail, Land, Product } = require('../models');
const { getIsoWeekRange } = require('../utils/isoWeek');

const catalogAttributes = ['id', 'code', 'name'];

function groupBySupplier(items) {
  const groups = new Map();

  items.forEach((item) => {
    if (!groups.has(item.supplierId)) {
      groups.set(item.supplierId, []);
    }
    groups.get(item.supplierId).push(item);
  });

  return groups;
}

async function getWeekSummary(range) {
  const [summary] = await sequelize.query(
    `SELECT COUNT(DISTINCT t.supplier_id)::int AS "supplierCount",
            COUNT(DISTINCT t.id)::int AS "ticketCount",
            COUNT(d.id)::int AS "lineCount",
            ROUND(COALESCE(SUM(d.total), 0), 3)::text AS total
     FROM tickets t
     LEFT JOIN ticket_details d ON d.ticket_id = t.id
     WHERE t.date BETWEEN :startDate AND :endDate`,
    { replacements: range, type: QueryTypes.SELECT },
  );

  return summary;
}

function getSupplierTotals(range) {
  return sequelize.query(
    `SELECT s.id, s.code, s.name,
            COUNT(DISTINCT t.id)::int AS "ticketCount",
            COUNT(d.id)::int AS "lineCount",
            ROUND(COALESCE(SUM(d.total), 0), 3)::text AS total
     FROM tickets t
     JOIN suppliers s ON s.id = t.supplier_id
     LEFT JOIN ticket_details d ON d.ticket_id = t.id
     WHERE t.date BETWEEN :startDate AND :endDate
     GROUP BY s.id
     ORDER BY s.code`,
    { replacements: range, type: QueryTypes.SELECT },
  );
}

function getProductTotals(range) {
  return sequelize.query(
    `SELECT t.supplier_id AS "supplierId", p.id, p.code, p.name,
            COUNT(d.id)::int AS "lineCount",
            SUM(d.quantity)::bigint AS quantity,
            ROUND(SUM(d.total), 3)::text AS total
     FROM tickets t
     JOIN ticket_details d ON d.ticket_id = t.id
     JOIN products p ON p.id = d.product_id
     WHERE t.date BETWEEN :startDate AND :endDate
     GROUP BY t.supplier_id, p.id
     ORDER BY p.code`,
    { replacements: range, type: QueryTypes.SELECT },
  );
}

function getWeekTickets({ startDate, endDate }) {
  return Ticket.findAll({
    attributes: ['id', 'code', 'date', 'supplierId', ...Ticket.totalsAttributes()],
    where: { date: { [Op.between]: [startDate, endDate] } },
    include: [
      { model: Land, as: 'land', attributes: catalogAttributes },
      {
        model: TicketDetail,
        as: 'details',
        attributes: ['id', 'lineNumber', 'quantity', 'price', 'total'],
        include: [{ model: Product, as: 'product', attributes: catalogAttributes }],
      },
    ],
    order: [
      ['date', 'ASC'],
      ['code', 'ASC'],
      [{ model: TicketDetail, as: 'details' }, 'lineNumber', 'ASC'],
    ],
  });
}

async function getWeeklyPayments(year, week) {
  const range = getIsoWeekRange(year, week);

  const summary = await getWeekSummary(range);
  const supplierTotals = await getSupplierTotals(range);
  const productsBySupplier = groupBySupplier(await getProductTotals(range));
  const ticketsBySupplier = groupBySupplier(await getWeekTickets(range));

  return {
    year,
    week,
    ...range,
    summary,
    suppliers: supplierTotals.map((row) => ({
      supplier: { id: row.id, code: row.code, name: row.name },
      ticketCount: row.ticketCount,
      lineCount: row.lineCount,
      total: row.total,
      products: (productsBySupplier.get(row.id) || []).map((product) => ({
        product: { id: product.id, code: product.code, name: product.name },
        lineCount: product.lineCount,
        quantity: Number(product.quantity),
        total: product.total,
      })),
      tickets: ticketsBySupplier.get(row.id) || [],
    })),
  };
}

async function getWeeksWithTickets() {
  const weeks = await sequelize.query(
    `SELECT EXTRACT(ISOYEAR FROM t.date)::int AS year,
            EXTRACT(WEEK FROM t.date)::int AS week,
            COUNT(DISTINCT t.supplier_id)::int AS "supplierCount",
            COUNT(DISTINCT t.id)::int AS "ticketCount",
            ROUND(COALESCE(SUM(d.total), 0), 3)::text AS total
     FROM tickets t
     LEFT JOIN ticket_details d ON d.ticket_id = t.id
     GROUP BY 1, 2
     ORDER BY 1 DESC, 2 DESC`,
    { type: QueryTypes.SELECT },
  );

  return weeks.map(({ year, week, ...totals }) => ({
    year,
    week,
    ...getIsoWeekRange(year, week),
    ...totals,
  }));
}

module.exports = {
  getWeeklyPayments,
  getWeeksWithTickets,
};
