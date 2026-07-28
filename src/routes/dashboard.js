'use strict';

// Resumo do dashboard v0.1.
// Os recortes por cliente/segmento/orgao entram na Fase 4 (/api/dashboard/recortes).

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);

// Periodo padrao: ultimos 90 dias.
function periodo(req) {
  const hoje = new Date();
  const noventaDias = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
  const iso = function (d) { return d.toISOString().slice(0, 10); };
  const de = /^\d{4}-\d{2}-\d{2}$/.test(req.query.de || '') ? req.query.de : iso(noventaDias);
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate || '') ? req.query.ate : iso(hoje);
  return { de, ate };
}

router.get('/resumo', async function (req, res, proximo) {
  try {
    const p = periodo(req);
    const intervalo = [p.de, p.ate];

    const [disputas, comissoes, recebidoPeriodo, certidoes, funil, prazos] = await Promise.all([
      // Taxa de vitoria: denominador e a participacao que chegou a disputar.
      db.um(
        `SELECT count(*) FILTER (WHERE disputou)                    AS disputadas,
                count(*) FILTER (WHERE venceu)                      AS ganhas,
                count(*) FILTER (WHERE fase = 'perdido')            AS perdidas,
                count(*) FILTER (WHERE decisao = 'recusado')        AS recusadas,
                count(*)                                            AS total,
                COALESCE(sum(valor_ganho) FILTER (WHERE venceu), 0) AS faturamento_gerado
           FROM vw_participacao
          WHERE data_sessao::date BETWEEN $1 AND $2`,
        intervalo
      ),

      // Carteira de comissoes (nao depende do periodo: e posicao atual).
      db.um(
        `SELECT COALESCE(sum(valor_aberto) FILTER (WHERE status IN ('a_receber','em_cobranca')), 0) AS a_receber,
                COALESCE(sum(valor_aberto) FILTER (WHERE atrasada), 0)                              AS atrasada,
                COALESCE(sum(valor)        FILTER (WHERE status = 'projetada'), 0)                  AS projetada,
                count(*) FILTER (WHERE status IN ('a_receber','em_cobranca'))                       AS qtd_a_receber,
                count(*) FILTER (WHERE atrasada)                                                    AS qtd_atrasada
           FROM vw_comissao`
      ),

      db.um(
        `SELECT COALESCE(sum(valor), 0) AS recebida
           FROM comissao_recebimento
          WHERE data BETWEEN $1 AND $2`,
        intervalo
      ),

      // Escopo vem de vw_certidao_alerta — mesma fonte da tela de certidoes,
      // para que os numeros batam entre painel e tela. Faixas cumulativas.
      db.um(
        `SELECT count(*) FILTER (WHERE situacao = 'vencido')                             AS vencidas,
                count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer <= 7)  AS ate_7,
                count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer <= 15) AS ate_15,
                count(*) FILTER (WHERE situacao = 'a_vencer' AND dias_para_vencer <= 30) AS ate_30,
                count(*) FILTER (WHERE situacao = 'vigente')                             AS vigentes
           FROM vw_certidao_alerta`
      ),

      db.todos(
        `SELECT fase, count(*)::int AS qtd
           FROM participacao
          GROUP BY fase`
      ),

      db.todos(
        `SELECT pz.id, pz.tipo, pz.titulo, pz.data_hora, pz.status,
                u.nome AS responsavel,
                cl.nome_fantasia, cl.razao_social,
                l.numero_edital, o.nome AS orgao_nome
           FROM prazo pz
           LEFT JOIN usuario u        ON u.id = pz.responsavel_id
           LEFT JOIN participacao pa  ON pa.id = pz.participacao_id
           LEFT JOIN cliente cl       ON cl.id = pa.cliente_id
           LEFT JOIN licitacao l      ON l.id = COALESCE(pz.licitacao_id, pa.licitacao_id)
           LEFT JOIN orgao o          ON o.id = l.orgao_id
          WHERE pz.status = 'aberto' AND pz.data_hora >= now() - interval '3 days'
          ORDER BY pz.data_hora
          LIMIT 12`
      )
    ]);

    const disputadas = Number(disputas.disputadas) || 0;
    const ganhas = Number(disputas.ganhas) || 0;

    return res.json({
      periodo: p,
      disputas: {
        total: Number(disputas.total) || 0,
        disputadas: disputadas,
        ganhas: ganhas,
        perdidas: Number(disputas.perdidas) || 0,
        recusadas: Number(disputas.recusadas) || 0,
        taxa_vitoria: disputadas ? ganhas / disputadas : null,
        faturamento_gerado: disputas.faturamento_gerado
      },
      comissoes: {
        a_receber: comissoes.a_receber,
        atrasada: comissoes.atrasada,
        projetada: comissoes.projetada,
        recebida_periodo: recebidoPeriodo.recebida,
        qtd_a_receber: Number(comissoes.qtd_a_receber) || 0,
        qtd_atrasada: Number(comissoes.qtd_atrasada) || 0
      },
      certidoes: {
        vencidas: Number(certidoes.vencidas) || 0,
        ate_7: Number(certidoes.ate_7) || 0,
        ate_15: Number(certidoes.ate_15) || 0,
        ate_30: Number(certidoes.ate_30) || 0,
        vigentes: Number(certidoes.vigentes) || 0
      },
      funil: funil,
      prazos: prazos
    });
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
