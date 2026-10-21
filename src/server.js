const app = require('./app');
const { port } = require('./config');
const { sequelize } = require('./models');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a PostgreSQL establecida');
  } catch (error) {
    console.error(`No se pudo conectar a PostgreSQL: ${error.message}`);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`API disponible en http://localhost:${port}/api`);
  });
}

start();
