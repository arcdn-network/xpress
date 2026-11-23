const express = require("express");
const cors = require("cors");
const compression = require("compression");

const docsRoutes = require("../utils/docs");
const { VOUCHER_KEYS } = require("./catalog");
const { hourLimiter, dayLimiter } = require("../middleware/rateLimit");
const { validateToken } = require("../middleware/validateToken");
const { createVoucherRoute } = require("./access/http/routes");

function startApi() {
  const app = express();
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));

  app.use((req, res, next) => {
    if (req.method === "POST" && !req.is("application/json")) {
      return res.status(400).json({
        status: false,
        message: "INVALID_CONTENT_TYPE",
      });
    }
    next();
  });

  app.use(hourLimiter);
  app.use(dayLimiter);
  app.use(validateToken);

  VOUCHER_KEYS.forEach((comando) => {
    app.post(`/api/${comando}`, createVoucherRoute(comando));
  });

  app.use("/", docsRoutes);
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`API iniciada en http://localhost:${PORT}`);
  });
}

module.exports = { startApi };
