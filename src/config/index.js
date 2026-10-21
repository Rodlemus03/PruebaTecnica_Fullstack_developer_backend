require('dotenv').config({ quiet: true });

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigins: corsOrigin.split(',').map((origin) => origin.trim()),
};
