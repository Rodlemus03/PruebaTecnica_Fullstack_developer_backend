require('dotenv').config({ quiet: true });

const connection = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: { ...connection, database: process.env.DB_NAME },
  test: { ...connection, database: process.env.DB_NAME_TEST },
  production: { ...connection, database: process.env.DB_NAME },
};
