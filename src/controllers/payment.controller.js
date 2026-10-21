const paymentService = require('../services/payment.service');
const { validateWeeklyPaymentQuery } = require('../validators/payment.validator');

async function getWeeklyPayments(req, res) {
  const { year, week } = validateWeeklyPaymentQuery(req.query);
  const payments = await paymentService.getWeeklyPayments(year, week);

  res.json({ data: payments });
}

async function listPaymentWeeks(req, res) {
  const weeks = await paymentService.getWeeksWithTickets();

  res.json({ data: weeks });
}

module.exports = {
  getWeeklyPayments,
  listPaymentWeeks,
};
