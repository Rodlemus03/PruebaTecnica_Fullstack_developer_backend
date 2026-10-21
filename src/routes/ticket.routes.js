const { Router } = require('express');
const ticketController = require('../controllers/ticket.controller');

const router = Router();

router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);
router.post('/', ticketController.createTicket);
router.put('/:id', ticketController.updateTicket);
router.delete('/:id', ticketController.deleteTicket);

module.exports = router;
