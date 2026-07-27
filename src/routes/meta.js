'use strict';

// Catalogos usados pelo shell da SPA (filtros, selects, rotulos).

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);

router.get('/', async function (req, res, proximo) {
  try {
    const [segmentos, tiposDocumento, usuarios, orgaos] = await Promise.all([
      db.todos('SELECT id, nome, slug FROM segmento WHERE ativo ORDER BY nome'),
      db.todos(
        `SELECT id, nome, slug, escopo, obrigatorio, alerta_dias
           FROM tipo_documento WHERE ativo ORDER BY ordem, nome`
      ),
      db.todos('SELECT id, nome, papel FROM usuario WHERE ativo ORDER BY nome'),
      db.todos('SELECT id, nome, esfera, uf FROM orgao ORDER BY nome')
    ]);

    return res.json({ segmentos, tiposDocumento, usuarios, orgaos });
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
