'use strict';

require('dotenv').config();

const pkg = require('../package.json');

const producao = (process.env.NODE_ENV || 'development') === 'production';

const config = {
  porta: parseInt(process.env.PORT || '3000', 10),
  ambiente: process.env.NODE_ENV || 'development',
  producao: producao,
  appVersion: process.env.APP_VERSION || pkg.version,
  databaseUrl: process.env.DATABASE_URL || '',
  pgSsl: process.env.PGSSL === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiraEm: process.env.JWT_EXPIRA_EM || '12h',
  seedSenhaPadrao: process.env.SEED_SENHA_PADRAO || 'producao123'
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL nao configurada. Copie .env.example para .env.');
}

if (!config.jwtSecret) {
  if (producao) {
    throw new Error('JWT_SECRET obrigatorio em producao.');
  }
  config.jwtSecret = 'segredo-de-desenvolvimento-nao-use-em-producao';
  console.warn('[config] JWT_SECRET ausente — usando segredo de desenvolvimento.');
}

module.exports = config;
