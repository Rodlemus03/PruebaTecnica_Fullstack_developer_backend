const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.hasMany(models.Ticket, { foreignKey: 'supplierId', as: 'tickets' });
    }
  }

  Supplier.init(
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
      modelName: 'Supplier',
      tableName: 'suppliers',
    },
  );

  return Supplier;
};
