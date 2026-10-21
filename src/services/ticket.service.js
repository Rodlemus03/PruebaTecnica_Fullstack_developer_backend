const { Op } = require('sequelize');
const { sequelize, Ticket, TicketDetail, Supplier, Land, Product } = require('../models');
const HttpError = require('../utils/httpError');

const catalogAttributes = ['id', 'code', 'name'];

const totalAttribute = [
  sequelize.literal(
    '(SELECT ROUND(COALESCE(SUM(d.total), 0), 3) FROM ticket_details d WHERE d.ticket_id = "Ticket"."id")',
  ),
  'total',
];

const lineCountAttribute = [
  sequelize.literal('(SELECT COUNT(*)::int FROM ticket_details d WHERE d.ticket_id = "Ticket"."id")'),
  'lineCount',
];

const headerIncludes = [
  { model: Supplier, as: 'supplier', attributes: catalogAttributes },
  { model: Land, as: 'land', attributes: catalogAttributes },
];

const sortColumns = {
  date: 'date',
  code: 'code',
  total: sequelize.literal('"total"'),
};

function buildOrder(sort) {
  const direction = sort.startsWith('-') ? 'DESC' : 'ASC';
  const column = sortColumns[sort.replace('-', '')];

  return [
    [column, direction],
    ['id', 'ASC'],
  ];
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

function buildWhere({ search, supplierId, landId, productId, dateFrom, dateTo }) {
  const where = {};

  if (supplierId) where.supplierId = supplierId;
  if (landId) where.landId = landId;

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date[Op.gte] = dateFrom;
    if (dateTo) where.date[Op.lte] = dateTo;
  }

  if (productId) {
    where.id = {
      [Op.in]: sequelize.literal(
        `(SELECT ticket_id FROM ticket_details WHERE product_id = ${sequelize.escape(productId)})`,
      ),
    };
  }

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where[Op.or] = [
      { code: { [Op.iLike]: pattern } },
      { '$supplier.code$': { [Op.iLike]: pattern } },
      { '$supplier.name$': { [Op.iLike]: pattern } },
    ];
  }

  return where;
}

async function findTickets(filters) {
  const { page, limit, sort } = filters;

  const { rows, count } = await Ticket.findAndCountAll({
    attributes: ['id', 'code', 'date', totalAttribute, lineCountAttribute],
    include: headerIncludes,
    where: buildWhere(filters),
    order: buildOrder(sort),
    limit,
    offset: (page - 1) * limit,
  });

  return {
    items: rows,
    meta: {
      page,
      limit,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
    },
  };
}

async function findTicketById(id) {
  const ticket = await Ticket.findByPk(id, {
    attributes: ['id', 'code', 'date', totalAttribute, lineCountAttribute, 'createdAt', 'updatedAt'],
    include: [
      ...headerIncludes,
      {
        model: TicketDetail,
        as: 'details',
        attributes: ['id', 'lineNumber', 'quantity', 'price', 'total'],
        include: [{ model: Product, as: 'product', attributes: catalogAttributes }],
      },
    ],
    order: [[{ model: TicketDetail, as: 'details' }, 'lineNumber', 'ASC']],
  });

  if (!ticket) {
    throw new HttpError(404, `No existe un ticket con id ${id}`);
  }

  return ticket;
}

async function assertReferencesExist({ supplierId, landId, details }, transaction) {
  const errors = [];

  if (!(await Supplier.findByPk(supplierId, { attributes: ['id'], transaction }))) {
    errors.push({ field: 'supplierId', message: `no existe un proveedor con id ${supplierId}` });
  }

  if (!(await Land.findByPk(landId, { attributes: ['id'], transaction }))) {
    errors.push({ field: 'landId', message: `no existe un land con id ${landId}` });
  }

  const productIds = [...new Set(details.map((line) => line.productId))];
  const products = await Product.findAll({ attributes: ['id'], where: { id: productIds }, transaction });
  const existingIds = new Set(products.map((product) => product.id));

  details.forEach((line, index) => {
    if (!existingIds.has(line.productId)) {
      errors.push({ field: `details[${index}].productId`, message: `no existe un producto con id ${line.productId}` });
    }
  });

  if (errors.length > 0) {
    throw new HttpError(400, 'Datos del ticket inválidos', errors);
  }
}

function toDetailRows(ticketId, details) {
  return details.map((line, index) => ({
    ticketId,
    lineNumber: index + 1,
    productId: line.productId,
    quantity: line.quantity,
    price: line.price,
  }));
}

async function createTicket(data) {
  const ticketId = await sequelize.transaction(async (transaction) => {
    await assertReferencesExist(data, transaction);

    const ticket = await Ticket.create(
      { code: data.code, date: data.date, supplierId: data.supplierId, landId: data.landId },
      { transaction },
    );

    await TicketDetail.bulkCreate(toDetailRows(ticket.id, data.details), { transaction });

    return ticket.id;
  });

  return findTicketById(ticketId);
}

async function updateTicket(id, data) {
  await sequelize.transaction(async (transaction) => {
    const ticket = await Ticket.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

    if (!ticket) {
      throw new HttpError(404, `No existe un ticket con id ${id}`);
    }

    await assertReferencesExist(data, transaction);

    ticket.set({ code: data.code, date: data.date, supplierId: data.supplierId, landId: data.landId });
    ticket.changed('updatedAt', true);
    await ticket.save({ transaction });

    await TicketDetail.destroy({ where: { ticketId: id }, transaction });
    await TicketDetail.bulkCreate(toDetailRows(id, data.details), { transaction });
  });

  return findTicketById(id);
}

async function deleteTicket(id) {
  const deleted = await Ticket.destroy({ where: { id } });

  if (deleted === 0) {
    throw new HttpError(404, `No existe un ticket con id ${id}`);
  }
}

module.exports = {
  findTickets,
  findTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
};
