'use strict';

const { Pool, types } = require('pg');
const config = require('./config');

// numeric (OID 1700) volta como string por padrao no driver pg — para os valores
// de dinheiro deste sistema (ate 14 digitos) o Number e seguro e simplifica o JSON.
types.setTypeParser(1700, function (valor) {
  return valor === null ? null : parseFloat(valor);
});
// date (OID 1082) sem conversao para Date, evitando deslocamento de fuso.
types.setTypeParser(1082, function (valor) {
  return valor;
});

const precisaSsl = config.pgSsl || /sslmode=require/.test(config.databaseUrl);

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: precisaSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', function (erro) {
  console.error('[db] erro no pool de conexoes:', erro.message);
});

async function query(sql, params) {
  return pool.query(sql, params);
}

// Retorna as linhas do SELECT.
async function todos(sql, params) {
  const resultado = await pool.query(sql, params);
  return resultado.rows;
}

// Retorna a primeira linha ou null.
async function um(sql, params) {
  const resultado = await pool.query(sql, params);
  return resultado.rows[0] || null;
}

// Executa fn dentro de uma transacao, com rollback automatico em caso de erro.
async function transacao(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const retorno = await fn(cliente);
    await cliente.query('COMMIT');
    return retorno;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, query, todos, um, transacao };
