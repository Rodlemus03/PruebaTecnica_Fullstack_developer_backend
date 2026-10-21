const path = require('path');
const { sequelize } = require('../src/models');
const { importTickets } = require('../src/import/importTickets');

const defaultFile = path.join(__dirname, '..', 'data', 'tickets-prueba.xlsx');
const maxErrorsShown = 25;

function printErrors(details) {
  details.slice(0, maxErrorsShown).forEach((detail) => {
    const location = detail.row ? `Fila ${detail.row}` : 'Archivo';
    const column = detail.column ? ` [${detail.column}]` : '';
    console.error(`  - ${location}${column}: ${detail.message}`);
  });

  if (details.length > maxErrorsShown) {
    console.error(`  ... y ${details.length - maxErrorsShown} error(es) más`);
  }
}

async function main() {
  const filePath = path.resolve(process.argv[2] || defaultFile);
  console.log(`Importando ${filePath}`);

  try {
    const summary = await importTickets(filePath);

    console.log('Importación completada');
    console.log(`  Filas leídas:      ${summary.rows}`);
    console.log(`  Proveedores:       ${summary.suppliers}`);
    console.log(`  Lands:             ${summary.lands}`);
    console.log(`  Productos:         ${summary.products}`);
    console.log(`  Tickets:           ${summary.tickets.total} (nuevos: ${summary.tickets.created}, actualizados: ${summary.tickets.updated})`);
    console.log(`  Líneas de detalle: ${summary.details}`);
    console.log(`  Total importado:   ${summary.total}`);
  } catch (error) {
    console.error(`La importación se canceló, no se guardó ningún cambio. ${error.message}`);

    if (error.details) {
      printErrors(error.details);
    }

    process.exitCode = 1;
  }
}

main().finally(() => sequelize.close());
