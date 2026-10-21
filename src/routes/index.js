const { Router } = require('express');
const healthRoutes = require('./health.routes');
const ticketRoutes = require('./ticket.routes');
const catalogRoutes = require('./catalog.routes');
const paymentRoutes = require('./payment.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/tickets', ticketRoutes);
router.use('/payments', paymentRoutes);
router.use('/', catalogRoutes);

module.exports = router;
