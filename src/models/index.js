const { Sequelize, DataTypes } = require('sequelize');
const { env } = require('../config');
const databaseConfig = require('../config/database')[env];

const sequelize = new Sequelize({
  ...databaseConfig,
  define: {
    underscored: true,
  },
});

const models = {
  Supplier: require('./supplier')(sequelize, DataTypes),
  Land: require('./land')(sequelize, DataTypes),
  Product: require('./product')(sequelize, DataTypes),
  Ticket: require('./ticket')(sequelize, DataTypes),
  TicketDetail: require('./ticketDetail')(sequelize, DataTypes),
};

Object.values(models).forEach((model) => model.associate(models));

module.exports = {
  ...models,
  sequelize,
  Sequelize,
};
