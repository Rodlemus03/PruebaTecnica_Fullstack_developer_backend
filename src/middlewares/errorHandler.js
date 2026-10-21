const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require('sequelize');

const uniqueMessages = {
  tickets_code_key: (fields) => `Ya existe un ticket con el código "${fields.code}"`,
};

function sendError(res, status, message, details) {
  const error = { message };

  if (details) {
    error.details = details;
  }

  return res.status(status).json({ error });
}

function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'El cuerpo de la petición no es un JSON válido');
  }

  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'El cuerpo de la petición es demasiado grande');
  }

  if (err instanceof UniqueConstraintError) {
    const buildMessage = uniqueMessages[err.parent?.constraint];
    return sendError(res, 409, buildMessage ? buildMessage(err.fields || {}) : 'Ya existe un registro con esos datos');
  }

  if (err instanceof ForeignKeyConstraintError) {
    return sendError(res, 409, 'La operación no es posible porque el registro está relacionado con otros datos');
  }

  if (err instanceof ValidationError) {
    return sendError(
      res,
      400,
      'Datos inválidos',
      err.errors.map((item) => ({ field: item.path, message: item.message })),
    );
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
    return sendError(res, 500, 'Error interno del servidor');
  }

  return sendError(res, status, err.message, err.details);
}

module.exports = errorHandler;
