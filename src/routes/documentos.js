'use strict';

// Certidoes e documentos com validade. A situacao (vigente/a_vencer/vencido)
// vem sempre de vw_documento_status — nunca e gravada.

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);

// Resumo por faixa de vencimento — alimenta o painel de alertas.
router.get('/resumo', async function (req, res, proximo) {
  try {
    const linha = await db.um(
      `SELECT count(*) FILTER (WHERE situacao = 'vencido')                             AS vencidas,
              count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer <= 7)  AS ate_7,
              count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer BETWEEN 8 AND 15)  AS de_8_a_15,
              count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer BETWEEN 16 AND 30) AS de_16_a_30,
              count(*) FILTER (WHERE situacao = 'a_vencer')                            AS a_vencer,
              count(*) FILTER (WHERE situacao = 'vigente')                             AS vigentes,
              count(*) FILTER (WHERE situacao = 'sem_validade')                        AS sem_validade,
              count(*)                                                                 AS total
         FROM vw_certidao_alerta`
    );
    return res.json(linha);
  } catch (erro) {
    return proximo(erro);
  }
});

// Lista com filtros: faixa (vencido|a7|a15|a30|risco|vigente|todas), busca, cliente_id.
router.get('/', async function (req, res, proximo) {
  try {
    const condicoes = ['true'];
    const params = [];

    const faixa = req.query.faixa || 'risco';
    if (faixa === 'vencido') condicoes.push("situacao = 'vencido'");
    else if (faixa === 'a7') condicoes.push("situacao = 'a_vencer' AND dias_para_vencer <= 7");
    else if (faixa === 'a15') condicoes.push("situacao = 'a_vencer' AND dias_para_vencer <= 15");
    else if (faixa === 'a30') condicoes.push("situacao = 'a_vencer' AND dias_para_vencer <= 30");
    else if (faixa === 'risco') condicoes.push("situacao IN ('vencido','a_vencer')");
    else if (faixa === 'vigente') condicoes.push("situacao = 'vigente'");
    // 'todas': sem filtro extra

    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condicoes.push('cliente_id = $' + params.length);
    }
    if (req.query.busca) {
      params.push('%' + req.query.busca + '%');
      condicoes.push('(razao_social ILIKE $' + params.length +
        ' OR nome_fantasia ILIKE $' + params.length +
        ' OR tipo_nome ILIKE $' + params.length + ')');
    }

    const linhas = await db.todos(
      `SELECT * FROM vw_certidao_alerta
        WHERE ` + condicoes.join(' AND ') + `
        ORDER BY CASE situacao WHEN 'vencido' THEN 0 WHEN 'a_vencer' THEN 1
                               WHEN 'sem_validade' THEN 2 ELSE 3 END,
                 validade ASC NULLS LAST, razao_social
        LIMIT 500`,
      params
    );
    return res.json({ documentos: linhas });
  } catch (erro) {
    return proximo(erro);
  }
});

// Novo documento / renovacao: insere uma linha nova; a view passa a enxergar
// a validade mais recente e o historico fica preservado.
router.post('/', async function (req, res, proximo) {
  try {
    const b = req.body || {};
    if (!b.cliente_id || !b.tipo_documento_id) {
      return res.status(400).json({ erro: 'Informe o cliente e o tipo de documento.' });
    }
    if (b.validade && b.emissao && b.validade < b.emissao) {
      return res.status(400).json({ erro: 'A validade nao pode ser anterior a emissao.' });
    }

    const linha = await db.um(
      `INSERT INTO documento (cliente_id, tipo_documento_id, numero, emissao, validade,
                              arquivo_url, obs, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [b.cliente_id, b.tipo_documento_id, b.numero || null, b.emissao || null,
       b.validade || null, b.arquivo_url || null, b.obs || null, req.usuario.id]
    );

    await db.query(
      "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao, dados) VALUES ($1, 'documento', $2, 'criar', $3)",
      [req.usuario.id, linha.id, JSON.stringify({ cliente_id: b.cliente_id, tipo: b.tipo_documento_id, validade: b.validade })]
    );

    return res.status(201).json({ id: linha.id });
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
