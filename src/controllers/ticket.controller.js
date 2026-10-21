const ticketService = require('../services/ticket.service');
const { validateTicketQuery, validateTicketPayload } = require('../validators/ticket.validator');
const { parseIdParam } = require('../validators/common');

async function listTickets(req, res) {
  const filters = validateTicketQuery(req.query);
  const { items, meta } = await ticketService.findTickets(filters);

  res.json({ data: items, meta });
}

async function getTicket(req, res) {
  const ticket = await ticketService.findTicketById(parseIdParam(req.params.id));

  res.json({ data: ticket });
}

async function createTicket(req, res) {
  const data = validateTicketPayload(req.body);
  const ticket = await ticketService.createTicket(data);

  res.status(201).json({ data: ticket });
}

async function updateTicket(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateTicketPayload(req.body);
  const ticket = await ticketService.updateTicket(id, data);

  res.json({ data: ticket });
}

async function deleteTicket(req, res) {
  await ticketService.deleteTicket(parseIdParam(req.params.id));

  res.status(204).end();
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
};
