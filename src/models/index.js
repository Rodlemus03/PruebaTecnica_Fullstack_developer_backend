const { Sequelize } = require('sequelize');
const { env } = require('../config');
const databaseConfig = require('../config/database')[env];

const sequelize = new Sequelize({
  ...databaseConfig,
  define: {
    underscored: true,
  },
});

module.exports = {
  sequelize,
  Sequelize,
};
