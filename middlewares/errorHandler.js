const errorHandler = (err, _req, res, _next) => {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  res.status(status).json({ error: message });
};

export default errorHandler;
