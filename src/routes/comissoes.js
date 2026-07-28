'use strict';

// Comissoes — o nucleo financeiro. Leitura via vw_comissao (que ja traz o
// quanto foi recebido); baixa de recebimento (inclusive parcial) em transacao.

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);
router.use(auth.exigirPapel('financeiro', 'comercial'));

router.get('/resumo', async function (req, res, proximo) {
  try {
    const [carteira, recebido90] = await Promise.all([
      db.um(
        `SELECT COALESCE(sum(valor_aberto) FILTER (WHERE status IN ('a_receber','em_cobranca')), 0) AS a_receber,
                count(*) FILTER (WHERE status IN ('a_receber','em_cobranca'))                        AS qtd_a_receber,
                COALESCE(sum(valor_aberto) FILTER (WHERE atrasada), 0)                               AS atrasada,
                count(*) FILTER (WHERE atrasada)                                                     AS qtd_atrasada,
                count(*) FILTER (WHERE status = 'em_cobranca')                                       AS qtd_em_cobranca,
                COALESCE(sum(valor) FILTER (WHERE status = 'projetada'), 0)                          AS projetada,
                count(*) FILTER (WHERE status = 'projetada')                                         AS qtd_projetada,
                count(*) FILTER (WHERE status = 'recebida')                                          AS qtd_recebida,
                count(*)                                                                             AS total
           FROM vw_comissao`
      ),
      db.um(
        `SELECT COALESCE(sum(valor), 0) AS valor
           FROM comissao_recebimento
          WHERE data >= CURRENT_DATE - 90`
      )
    ]);
    carteira.recebida_90d = recebido90.valor;
    return res.json(carteira);
  } catch (erro) {
    return proximo(erro);
  }
});

// Lista com filtros: situacao (atraso|abertas|em_cobranca|recebidas|projetadas|todas), busca.
router.get('/', async function (req, res, proximo) {
  try {
    const condicoes = ['true'];
    const params = [];

    const situacao = req.query.situacao || 'abertas';
    if (situacao === 'atraso') condicoes.push('atrasada');
    else if (situacao === 'abertas') condicoes.push("status IN ('a_receber','em_cobranca')");
    else if (situacao === 'em_cobranca') condicoes.push("status = 'em_cobranca'");
    else if (situacao === 'recebidas') condicoes.push("status = 'recebida'");
    else if (situacao === 'projetadas') condicoes.push("status = 'projetada'");
    // 'todas': sem filtro

    if (req.query.busca) {
      params.push('%' + req.query.busca + '%');
      condicoes.push('(razao_social ILIKE $' + params.length +
        ' OR nome_fantasia ILIKE $' + params.length +
        ' OR contrato_numero ILIKE $' + params.length +
        ' OR orgao_nome ILIKE $' + params.length + ')');
    }

    const linhas = await db.todos(
      `SELECT * FROM vw_comissao
        WHERE ` + condicoes.join(' AND ') + `
        ORDER BY atrasada DESC, data_prevista ASC NULLS LAST, id
        LIMIT 500`,
      params
    );
    return res.json({ comissoes: linhas });
  } catch (erro) {
    return proximo(erro);
  }
});

// Baixa de recebimento — parcial ou total. Total: status vira 'recebida'.
router.post('/:id/recebimentos', async function (req, res, proximo) {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const valor = Math.round(Number(b.valor) * 100) / 100;
    const data = b.data;

    if (!valor || valor <= 0) {
      return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
    }
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return res.status(400).json({ erro: 'Informe a data do recebimento.' });
    }

    const resultado = await db.transacao(async function (c) {
      const comissao = (await c.query(
        'SELECT id, valor, status FROM comissao WHERE id = $1 FOR UPDATE', [id]
      )).rows[0];
      if (!comissao) {
        return { erro: 'Comissão não encontrada.', codigo: 404 };
      }
      if (comissao.status === 'cancelada') {
        return { erro: 'Comissão cancelada não recebe baixa.', codigo: 400 };
      }

      const recebido = (await c.query(
        'SELECT COALESCE(sum(valor), 0) AS total FROM comissao_recebimento WHERE comissao_id = $1',
        [id]
      )).rows[0].total;

      const aberto = Math.round((comissao.valor - recebido) * 100) / 100;
      if (valor > aberto + 0.01) {
        return { erro: 'Valor maior que o saldo em aberto (' + aberto.toFixed(2) + ').', codigo: 400 };
      }

      await c.query(
        `INSERT INTO comissao_recebimento (comissao_id, data, valor, forma, obs)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, data, valor, b.forma || null, b.obs || null]
      );

      const quitada = valor >= aberto - 0.01;
      if (quitada) {
        await c.query("UPDATE comissao SET status = 'recebida' WHERE id = $1", [id]);
      } else if (comissao.status === 'projetada') {
        // baixa parcial em comissao projetada: passa a ser cobravel
        await c.query("UPDATE comissao SET status = 'a_receber' WHERE id = $1", [id]);
      }

      await c.query(
        "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao, dados) VALUES ($1, 'comissao', $2, 'recebimento', $3)",
        [req.usuario.id, id, JSON.stringify({ valor: valor, data: data, quitada: quitada })]
      );

      return { quitada: quitada };
    });

    if (resultado.erro) {
      return res.status(resultado.codigo).json({ erro: resultado.erro });
    }
    return res.status(201).json(resultado);
  } catch (erro) {
    return proximo(erro);
  }
});

// Mudanca manual de status (marcar cobranca, reabrir, cancelar, ativar projetada).
router.put('/:id/status', async function (req, res, proximo) {
  try {
    const id = Number(req.params.id);
    const status = (req.body || {}).status;
    const PERMITIDOS = ['a_receber', 'em_cobranca', 'cancelada', 'projetada'];
    if (PERMITIDOS.indexOf(status) === -1) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const linha = await db.um(
      `UPDATE comissao SET status = $2
        WHERE id = $1 AND status <> 'recebida'
        RETURNING id, status`,
      [id, status]
    );
    if (!linha) {
      return res.status(404).json({ erro: 'Comissão não encontrada ou já recebida.' });
    }

    await db.query(
      "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao, dados) VALUES ($1, 'comissao', $2, 'status', $3)",
      [req.usuario.id, id, JSON.stringify({ status: status })]
    );
    return res.json(linha);
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
