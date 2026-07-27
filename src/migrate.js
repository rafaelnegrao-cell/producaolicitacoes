'use strict';

// Aplica db/schema.sql no banco apontado por DATABASE_URL.
// O schema e idempotente: rodar de novo nao quebra nada.
//
//   node src/migrate.js            aplica o schema
//   node src/migrate.js --limpar   derruba tudo e reaplica (bloqueado em producao)

const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');

async function principal() {
  const limpar = process.argv.includes('--limpar');

  if (limpar && config.producao && !process.env.PERMITIR_LIMPAR) {
    throw new Error('--limpar bloqueado em producao. Use PERMITIR_LIMPAR=1 se for mesmo isso.');
  }

  if (limpar) {
    console.log('[migrate] derrubando o schema public...');
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');
  }

  const arquivo = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(arquivo, 'utf8');

  console.log('[migrate] aplicando db/schema.sql...');
  await db.query(sql);
  console.log('[migrate] schema aplicado com sucesso.');
}

principal()
  .then(function () {
    return db.pool.end();
  })
  .catch(function (erro) {
    console.error('[migrate] falhou:', erro.message);
    db.pool.end().finally(function () {
      process.exit(1);
    });
  });
