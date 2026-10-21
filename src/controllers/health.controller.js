const { sequelize } = require('../models');

async function getHealth(req, res) {
  let database = 'up';

  try {
    await sequelize.authenticate();
  } catch {
    database = 'down';
  }

  const status = database === 'up' ? 'ok' : 'degraded';

  res.status(database === 'up' ? 200 : 503).json({
    data: {
      status,
      database,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { getHealth };
