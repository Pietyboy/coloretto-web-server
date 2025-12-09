import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Отсутствует заголовок Authorization' });
  }

  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Неверный формат Authorization' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.type && payload.type !== 'access') {
      return res.status(401).json({ error: 'Неверный тип токена' });
    }
    req.userId = payload.userId;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Неверный или просроченный токен' });
  }
};

export default authMiddleware;
