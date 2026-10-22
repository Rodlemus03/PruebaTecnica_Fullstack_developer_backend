# Backend · Gestión de tickets de compra

API REST para gestionar los tickets de compra del archivo `tickets-prueba.xlsx` y calcular los pagos semanales a proveedores. Construida con Node.js, Express, PostgreSQL y Sequelize.

## Ejecución rápida

Hay dos formas de levantar todo el sistema (base de datos, API y frontend) desde este repositorio. En las dos, la aplicación queda en `http://localhost:5173` y la API en `http://localhost:3000/api`, con el Excel ya importado.

### Con Docker

```bash
git clone https://github.com/Rodlemus03/PruebaTecnica_Fullstack_developer_backend.git
cd PruebaTecnica_Fullstack_developer_backend
docker-compose up
```

La primera vez construye las imágenes, crea las tablas e importa el Excel. El frontend se construye desde su repositorio de GitHub. PostgreSQL corre dentro de Docker y no usa el puerto 5432 de tu equipo, así que no choca con una instalación local.

- `docker-compose down` detiene todo y conserva los datos.
- `docker-compose down -v` borra también la base de datos; al volver a levantar se importa el Excel otra vez.
- Para construir el frontend desde una copia local, agrega `FRONTEND_CONTEXT=../PruebaTecnica_Fullstack_developer_frontend` al archivo `.env` y usa `docker-compose up --build`.

### Sin Docker

Se necesita Node.js 22.22 o superior y PostgreSQL encendido.

- **Windows:** doble clic en `iniciar.bat`.
- **Linux o macOS:** `./iniciar.sh`.

El script pide la contraseña del usuario `postgres` la primera vez y la guarda en `.env`. Luego instala las dependencias, crea la base de datos, aplica las migraciones, importa el Excel si la base está vacía y levanta la API y el frontend. Si el frontend no está clonado junto a este repositorio, lo descarga con git en `../PruebaTecnica_Fullstack_developer_frontend`. `Ctrl+C` detiene todo.

Los pasos manuales están en las secciones siguientes.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 12 o superior (probado con PostgreSQL 16)

## Instalación

```bash
git clone https://github.com/Rodlemus03/PruebaTecnica_Fullstack_developer_backend.git
cd PruebaTecnica_Fullstack_developer_backend
npm install
```

## Variables de entorno

Copia el archivo de ejemplo y completa la contraseña de PostgreSQL. En Windows:

```bash
copy .env.example .env
```

En Linux o macOS usa `cp .env.example .env`.

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma | `http://localhost:5173` |
| `DB_HOST` / `DB_PORT` | Servidor de PostgreSQL | `localhost` / `5432` |
| `DB_USER` / `DB_PASSWORD` | Credenciales de PostgreSQL | `postgres` / — |
| `DB_NAME` | Base de datos de la aplicación | `cfg_tickets` |
| `DB_NAME_TEST` | Base de datos de las pruebas | `cfg_tickets_test` |

## Base de datos

```bash
npm run db:create
npm run db:migrate
npm run db:import
```

- `db:create` crea la base de datos, `db:migrate` crea las tablas con las migraciones de Sequelize y `db:import` carga `data/tickets-prueba.xlsx`.
- Para importar otro archivo: `npm run db:import -- ruta/al/archivo.xlsx`.
- `npm run db:import -- --if-empty` importa solo si la base no tiene tickets. Así lo usan Docker y los scripts de inicio para no deshacer cambios hechos desde la aplicación.
- La importación valida todo el archivo antes de escribir y se ejecuta en una sola transacción: si hay un error, muestra la fila y la columna y no guarda nada.
- Se puede ejecutar varias veces sin duplicar información. Los catálogos y tickets se actualizan por código y las líneas de cada ticket del Excel se reemplazan. Los tickets creados desde la API no se modifican.
- `npm run db:migrate:undo` revierte todas las migraciones.

## Ejecución

```bash
npm run dev
```

`npm run dev` reinicia el servidor al guardar cambios; `npm start` lo ejecuta sin recarga. La API queda disponible en `http://localhost:3000/api`. `GET /api/health` indica el estado del servidor y de la conexión a PostgreSQL.

## Pruebas

```bash
npm run db:create -- --env test
npm test
```

El primer comando crea la base de pruebas y solo se necesita una vez. `npm test` aplica las migraciones en la base de pruebas, carga el Excel y ejecuta las pruebas de la importación, los endpoints y el cálculo de pagos. Las pruebas vacían esa base, por eso se niegan a ejecutarse contra `DB_NAME`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tickets` | Lista paginada. Parámetros: `page`, `limit` (máx. 100), `search` (código de ticket o proveedor), `supplierId`, `landId`, `productId`, `dateFrom`, `dateTo`, `sort` (`date`, `code`, `total`; con `-` para descendente) |
| GET | `/api/tickets/:id` | Ticket con proveedor, land, total y líneas |
| POST | `/api/tickets` | Crea un ticket con sus líneas |
| PUT | `/api/tickets/:id` | Actualiza la cabecera y reemplaza las líneas |
| DELETE | `/api/tickets/:id` | Elimina el ticket y sus líneas |
| GET | `/api/suppliers`, `/api/lands`, `/api/products` | Catálogos |
| GET | `/api/payments/weekly?year=2023&week=4` | Pagos de una semana ISO agrupados por proveedor, con desglose por producto, tickets y líneas |
| GET | `/api/payments/weeks` | Semanas ISO que tienen tickets, con sus totales |

Cuerpo para crear o editar un ticket:

```json
{
  "code": "1115651",
  "date": "2023-01-07",
  "supplierId": 1,
  "landId": 1,
  "details": [
    { "productId": 1, "quantity": 1475, "price": "0.700" },
    { "productId": 2, "quantity": 4650, "price": "1.250" }
  ]
}
```

Las respuestas exitosas tienen la forma `{ "data": ..., "meta": ... }` y los errores `{ "error": { "message": ..., "details": [{ "field", "message" }] } }`, con los códigos 400, 404, 409 y 500. Los importes se devuelven como texto con 3 decimales para no perder precisión.

## Modelo de datos

```
suppliers ─┐
           ├─< tickets ─< ticket_details >─ products
lands ─────┘
```

Decisiones tomadas a partir del análisis del Excel (751 filas, 367 tickets, 59 proveedores, 11 lands y 13 productos):

- Cada código de ticket tiene siempre la misma fecha, proveedor y land, por eso esos datos forman la cabecera `tickets`. El land pertenece al ticket y no al proveedor, porque 31 proveedores aparecen en más de un land.
- El precio se guarda en cada línea porque un mismo producto tiene precios distintos entre tickets.
- Un ticket puede repetir producto e incluso tener líneas idénticas, así que cada línea se identifica por `(ticket_id, line_number)` y no por ticket y producto. Se conservan todas las filas del archivo, incluidas las de cantidad 0.
- Los códigos de ticket son texto porque existen códigos alfanuméricos como `GPE01`.
- Los importes usan `NUMERIC`. El total de cada línea es una columna generada por PostgreSQL (`quantity * price`), y los totales de tickets, proveedores y semanas se suman en SQL.
- Las llaves foráneas impiden borrar proveedores, lands o productos en uso, y al borrar un ticket se borran sus líneas.

## Estructura

```
data/            Excel original
scripts/         importación del Excel y arranque local (runLocal.js)
src/
  config/        variables de entorno y conexión
  controllers/   manejo de peticiones HTTP
  import/        lectura, validación y carga del Excel
  middlewares/   rutas no encontradas y manejo de errores
  migrations/    migraciones de Sequelize
  models/        modelos y asociaciones
  routes/        definición de endpoints
  services/      consultas y reglas de negocio
  utils/         semanas ISO y errores HTTP
  validators/    validación de parámetros y cuerpos
tests/           pruebas con Jest y Supertest
Dockerfile, docker-compose.yml   ejecución con Docker
iniciar.bat, iniciar.sh          ejecución sin Docker
```
