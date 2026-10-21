const { Router } = require('express');
const catalogController = require('../controllers/catalog.controller');

const router = Router();

router.get('/suppliers', catalogController.listSuppliers);
router.get('/lands', catalogController.listLands);
router.get('/products', catalogController.listProducts);

module.exports = router;
