const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Land extends Model {
    static associate(models) {
      Land.hasMany(models.Ticket, { foreignKey: 'landId', as: 'tickets' });
    }
  }

  Land.init(
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
      modelName: 'Land',
      tableName: 'lands',
    },
  );

  return Land;
};
