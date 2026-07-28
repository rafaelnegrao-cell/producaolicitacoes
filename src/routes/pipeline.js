'use strict';

// Pipeline de licitacoes: listagem, registro rapido de participacao e
// movimentacao de fase. O registro rapido e o coracao operacional — cria
// orgao (se novo), licitacao (se nova) e participacao numa transacao so,
// e ja agenda o prazo da sessao para aparecer no dashboard.

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);

const FASES = ['em_analise', 'aprovado', 'recusado', 'disputado', 'ganho', 'perdido',
  'contratado', 'em_execucao', 'entregue', 'encerrado'];

router.get('/resumo', async function (req, res, proximo) {
  try {
    const fases = await db.todos(
      'SELECT fase, count(*)::int AS qtd FROM participacao GROUP BY fase'
    );
    return res.json({ fases: fases });
  } catch (erro) {
    return proximo(erro);
  }
});

router.get('/', async function (req, res, proximo) {
  try {
    const condicoes = ['true'];
    const params = [];

    if (req.query.fase && FASES.indexOf(req.query.fase) !== -1) {
      params.push(req.query.fase);
      condicoes.push('p.fase = $' + params.length);
    }
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      condicoes.push('p.cliente_id = $' + params.length);
    }
    if (req.query.busca) {
      params.push('%' + req.query.busca + '%');
      condicoes.push('(p.razao_social ILIKE $' + params.length +
        ' OR p.nome_fantasia ILIKE $' + params.length +
        ' OR p.numero_edital ILIKE $' + params.length +
        ' OR p.orgao_nome ILIKE $' + params.length +
        ' OR p.objeto ILIKE $' + params.length + ')');
    }

    const linhas = await db.todos(
      `SELECT p.*, u.nome AS responsavel_nome
         FROM vw_participacao p
         LEFT JOIN participacao pa ON pa.id = p.id
         LEFT JOIN usuario u ON u.id = pa.responsavel_id
        WHERE ` + condicoes.join(' AND ') + `
        ORDER BY COALESCE(p.proximo_prazo, p.data_sessao) DESC NULLS LAST, p.id DESC
        LIMIT 400`,
      params
    );
    return res.json({ participacoes: linhas });
  } catch (erro) {
    return proximo(erro);
  }
});

// Registro rapido de participacao.
router.post('/', async function (req, res, proximo) {
  try {
    const b = req.body || {};
    if (!b.cliente_id) {
      return res.status(400).json({ erro: 'Informe o cliente.' });
    }
    if (!b.numero_edital || !String(b.numero_edital).trim()) {
      return res.status(400).json({ erro: 'Informe o número do edital.' });
    }
    if (!b.orgao_id && !(b.orgao_novo && b.orgao_novo.nome)) {
      return res.status(400).json({ erro: 'Informe o órgão (ou cadastre um novo).' });
    }

    const numeroEdital = String(b.numero_edital).trim();

    const resultado = await db.transacao(async function (c) {
      let orgaoId = b.orgao_id;
      if (!orgaoId) {
        const novo = b.orgao_novo;
        const orgao = (await c.query(
          `INSERT INTO orgao (nome, esfera, uf, municipio)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [String(novo.nome).trim(),
           ['federal', 'estadual', 'municipal'].indexOf(novo.esfera) !== -1 ? novo.esfera : 'municipal',
           (novo.uf || 'PR').toUpperCase().slice(0, 2),
           novo.municipio || null]
        )).rows[0];
        orgaoId = orgao.id;
      }

      // Mesmo edital ja captado? Reaproveita — e o caso de lotes para
      // clientes diferentes no mesmo pregao.
      let licitacao = (await c.query(
        'SELECT id, data_sessao FROM licitacao WHERE orgao_id = $1 AND numero_edital = $2',
        [orgaoId, numeroEdital]
      )).rows[0];

      if (!licitacao) {
        licitacao = (await c.query(
          `INSERT INTO licitacao (orgao_id, numero_edital, modalidade, plataforma, objeto,
                                  data_sessao, valor_estimado, status_captacao, captado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'triado', $8)
           RETURNING id, data_sessao`,
          [orgaoId, numeroEdital, b.modalidade || 'pregao_eletronico', b.plataforma || null,
           b.objeto || null, b.data_sessao || null, b.valor_estimado || null, req.usuario.id]
        )).rows[0];
      }

      const jaExiste = (await c.query(
        'SELECT id FROM participacao WHERE licitacao_id = $1 AND cliente_id = $2',
        [licitacao.id, b.cliente_id]
      )).rows[0];
      if (jaExiste) {
        return { erro: 'Este cliente já está registrado neste edital.', codigo: 409 };
      }

      const decisao = ['pendente', 'aprovado', 'recusado'].indexOf(b.decisao) !== -1
        ? b.decisao : 'pendente';
      const fase = decisao === 'aprovado' ? 'aprovado'
        : (decisao === 'recusado' ? 'recusado' : 'em_analise');

      const participacao = (await c.query(
        `INSERT INTO participacao (licitacao_id, cliente_id, decisao, decidido_por, fase,
                                   proximo_prazo, responsavel_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [licitacao.id, b.cliente_id, decisao,
         decisao === 'pendente' ? null : req.usuario.id, fase,
         licitacao.data_sessao || null, req.usuario.id]
      )).rows[0];

      // Sessao futura vira prazo na agenda (aparece no dashboard).
      if (licitacao.data_sessao && new Date(licitacao.data_sessao) > new Date() && decisao !== 'recusado') {
        await c.query(
          `INSERT INTO prazo (tipo, titulo, participacao_id, licitacao_id, data_hora, responsavel_id)
           VALUES ('sessao', 'Sessão de disputa', $1, $2, $3, $4)`,
          [participacao.id, licitacao.id, licitacao.data_sessao, req.usuario.id]
        );
      }

      await c.query(
        "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao, dados) VALUES ($1, 'participacao', $2, 'criar', $3)",
        [req.usuario.id, participacao.id,
         JSON.stringify({ cliente_id: b.cliente_id, edital: numeroEdital, decisao: decisao })]
      );

      return { id: participacao.id };
    });

    if (resultado.erro) {
      return res.status(resultado.codigo).json({ erro: resultado.erro });
    }
    return res.status(201).json(resultado);
  } catch (erro) {
    return proximo(erro);
  }
});

// Atualizacao: mover de fase, registrar resultado, ajustar prazo/responsavel.
router.put('/:id', async function (req, res, proximo) {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};

    if (b.fase !== undefined && FASES.indexOf(b.fase) === -1) {
      return res.status(400).json({ erro: 'Fase inválida.' });
    }
    if (b.decisao !== undefined && ['pendente', 'aprovado', 'recusado'].indexOf(b.decisao) === -1) {
      return res.status(400).json({ erro: 'Decisão inválida.' });
    }

    const CAMPOS = ['decisao', 'motivo_decisao', 'fase', 'preco_final', 'valor_ganho',
      'concorrente_vencedor', 'proximo_prazo', 'responsavel_id', 'obs'];
    const sets = [];
    const params = [id];
    CAMPOS.forEach(function (campo) {
      if (b[campo] !== undefined) {
        params.push(b[campo] === '' ? null : b[campo]);
        sets.push(campo + ' = $' + params.length);
      }
    });
    if (!sets.length) {
      return res.status(400).json({ erro: 'Nada para atualizar.' });
    }
    if (b.decisao === 'aprovado' || b.decisao === 'recusado') {
      params.push(req.usuario.id);
      sets.push('decidido_por = $' + params.length);
    }

    const linha = await db.um(
      'UPDATE participacao SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING id, fase',
      params
    );
    if (!linha) {
      return res.status(404).json({ erro: 'Participação não encontrada.' });
    }

    await db.query(
      "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao, dados) VALUES ($1, 'participacao', $2, 'atualizar', $3)",
      [req.usuario.id, id, JSON.stringify(b)]
    );
    return res.json(linha);
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
