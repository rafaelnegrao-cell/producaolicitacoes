'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const db = require('./db');

const app = express();
const PUBLICO = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway roda atras de proxy
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// -----------------------------------------------------------------------------
// index.html e servido por template para injetar APP_VERSION (bust de cache).
// -----------------------------------------------------------------------------
const modeloIndex = fs.readFileSync(path.join(PUBLICO, 'index.html'), 'utf8');

function enviarIndex(req, res) {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(modeloIndex.split('__APP_VERSION__').join(config.appVersion));
}

app.get('/', enviarIndex);

// Assets versionados pela query ?v= — cache longo e seguro.
app.use(
  express.static(PUBLICO, {
    index: false,
    maxAge: config.producao ? '30d' : 0,
    setHeaders: function (res, arquivo) {
      if (/(index\.html|sw\.js|manifest\.json)$/.test(arquivo)) {
        res.set('Cache-Control', 'no-cache');
      }
    }
  })
);

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------
app.get('/api/saude', async function (req, res) {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, versao: config.appVersion, banco: 'ok' });
  } catch (erro) {
    res.status(503).json({ ok: false, versao: config.appVersion, banco: 'indisponivel' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/comissoes', require('./routes/comissoes'));
app.use('/api/pipeline', require('./routes/pipeline'));

app.use('/api', function (req, res) {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
});

// Qualquer outra rota devolve a SPA.
app.get('*', enviarIndex);

// -----------------------------------------------------------------------------
// Tratamento de erro — nunca vaza stack para o cliente.
// -----------------------------------------------------------------------------
app.use(function (erro, req, res, next) {
  console.error('[erro]', req.method, req.originalUrl, '-', erro.message);
  if (res.headersSent) {
    return next(erro);
  }
  res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
});

const servidor = app.listen(config.porta, function () {
  console.log(
    '[servidor] Producao Licitacoes v' + config.appVersion +
    ' ouvindo na porta ' + config.porta + ' (' + config.ambiente + ')'
  );
});

function encerrar() {
  console.log('[servidor] encerrando...');
  servidor.close(function () {
    db.pool.end().finally(function () {
      process.exit(0);
    });
  });
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);

module.exports = app;
