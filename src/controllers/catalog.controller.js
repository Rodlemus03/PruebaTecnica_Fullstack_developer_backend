const { Supplier, Land, Product } = require('../models');

function listCatalog(Model) {
  return async (req, res) => {
    const items = await Model.findAll({
      attributes: ['id', 'code', 'name'],
      order: [['code', 'ASC']],
    });

    res.json({ data: items });
  };
}

module.exports = {
  listSuppliers: listCatalog(Supplier),
  listLands: listCatalog(Land),
  listProducts: listCatalog(Product),
};
