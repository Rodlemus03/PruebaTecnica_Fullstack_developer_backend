const { Router } = require('express');
const paymentController = require('../controllers/payment.controller');

const router = Router();

router.get('/weekly', paymentController.getWeeklyPayments);
router.get('/weeks', paymentController.listPaymentWeeks);

module.exports = router;
