function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { message: 'El cuerpo de la petición no es un JSON válido' },
    });
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
  }

  const error = {
    message: status >= 500 ? 'Error interno del servidor' : err.message,
  };

  if (err.details) {
    error.details = err.details;
  }

  res.status(status).json({ error });
}

module.exports = errorHandler;
