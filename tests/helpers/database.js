const path = require('path');
const { sequelize } = require('../../src/models');
const { importTickets } = require('../../src/import/importTickets');

const excelPath = path.join(__dirname, '..', '..', 'data', 'tickets-prueba.xlsx');

async function resetDatabase() {
  if (process.env.NODE_ENV !== 'test' || sequelize.config.database === process.env.DB_NAME) {
    throw new Error('Las pruebas solo pueden ejecutarse contra la base de datos de pruebas (DB_NAME_TEST)');
  }

  await sequelize.query('TRUNCATE ticket_details, tickets, suppliers, lands, products RESTART IDENTITY CASCADE');
}

async function loadExcelData() {
  await resetDatabase();
  return importTickets(excelPath);
}

const toMillis = (value) => Math.round(Number(value) * 1000);

module.exports = {
  sequelize,
  excelPath,
  resetDatabase,
  loadExcelData,
  toMillis,
};
