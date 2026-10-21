const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TicketDetail extends Model {
    static associate(models) {
      TicketDetail.belongsTo(models.Ticket, { foreignKey: 'ticketId', as: 'ticket' });
      TicketDetail.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    }
  }

  TicketDetail.init(
    {
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 },
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 0 },
      },
      price: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0.001 },
      },
      total: {
        type: DataTypes.DECIMAL(14, 3),
      },
    },
    {
      sequelize,
      modelName: 'TicketDetail',
      tableName: 'ticket_details',
    },
  );

  return TicketDetail;
};
