const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const DOCS_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/_docs.html'), 'utf-8');

router.get('/{*path}', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(DOCS_HTML);
});

module.exports = router;
