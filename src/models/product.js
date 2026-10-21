const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.hasMany(models.TicketDetail, { foreignKey: 'productId', as: 'ticketDetails' });
    }
  }

  Product.init(
    {
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: { notEmpty: true },
      },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',
    },
  );

  return Product;
};
