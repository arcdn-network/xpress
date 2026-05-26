const express = require('express');
const cors = require('cors');
const compression = require('compression');

const docsRoutes = require('../utils/docs');
const { hourLimiter, dayLimiter } = require('./middleware/rateLimit');
const { validateToken } = require('./middleware/validateToken');
const { createVoucherRoute } = require('./services/services');

function startApi() {
  const app = express();
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    if (req.method === 'POST' && !req.is('application/json')) {
      return res.status(400).json({
        status: false,
        message: 'INVALID_CONTENT_TYPE',
      });
    }

    next();
  });

  app.use(hourLimiter);
  app.use(dayLimiter);
  app.use(validateToken);

  app.post('/api/yape', createVoucherRoute('yape'));
  app.post('/api/plin', createVoucherRoute('plin'));
  app.post('/api/agora', createVoucherRoute('agora'));
  app.post('/api/lemon', createVoucherRoute('lemon'));
  app.post('/api/bim', createVoucherRoute('bim'));
  app.post('/api/bcp', createVoucherRoute('bcp'));
  app.post('/api/ibk', createVoucherRoute('ibk'));
  app.post('/api/bbva', createVoucherRoute('bbva'));
  app.post('/api/scotiabank', createVoucherRoute('scotiabank'));

  app.use('/', docsRoutes);
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`API iniciada en puerto ${PORT}`);
  });
}

module.exports = {
  startApi,
};
