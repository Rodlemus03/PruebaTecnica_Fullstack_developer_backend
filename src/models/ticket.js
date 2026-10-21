const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Ticket extends Model {
    static associate(models) {
      Ticket.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      Ticket.belongsTo(models.Land, { foreignKey: 'landId', as: 'land' });
      Ticket.hasMany(models.TicketDetail, {
        foreignKey: 'ticketId',
        as: 'details',
        onDelete: 'CASCADE',
      });
    }

    static totalsAttributes() {
      return [
        [
          sequelize.literal(
            '(SELECT ROUND(COALESCE(SUM(d.total), 0), 3) FROM ticket_details d WHERE d.ticket_id = "Ticket"."id")',
          ),
          'total',
        ],
        [
          sequelize.literal('(SELECT COUNT(*)::int FROM ticket_details d WHERE d.ticket_id = "Ticket"."id")'),
          'lineCount',
        ],
      ];
    }
  }

  Ticket.init(
    {
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: { isDate: true },
      },
      supplierId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      landId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Ticket',
      tableName: 'tickets',
    },
  );

  return Ticket;
};
