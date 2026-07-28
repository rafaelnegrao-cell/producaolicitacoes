'use strict';

// Cadastro-base de clientes: dados, segmentos, contatos, % de comissao e
// o retrato de certidoes/participacoes de cada um.

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

router.use(auth.autenticar);

const STATUS = ['ativo', 'sazonal', 'inativo'];

// Aceita "a, b, c" ou array; devolve array limpo para text[].
function comoLista(valor) {
  if (Array.isArray(valor)) {
    return valor.map(function (v) { return String(v).trim(); }).filter(Boolean);
  }
  if (typeof valor === 'string') {
    return valor.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
  }
  return [];
}

router.get('/', async function (req, res, proximo) {
  try {
    const condicoes = ['true'];
    const params = [];

    if (req.query.status && STATUS.indexOf(req.query.status) !== -1) {
      params.push(req.query.status);
      condicoes.push('c.status = $' + params.length);
    }
    if (req.query.segmento_id) {
      params.push(req.query.segmento_id);
      condicoes.push('EXISTS (SELECT 1 FROM cliente_segmento cs WHERE cs.cliente_id = c.id AND cs.segmento_id = $' + params.length + ')');
    }
    if (req.query.busca) {
      params.push('%' + req.query.busca + '%');
      condicoes.push('(c.razao_social ILIKE $' + params.length +
        ' OR c.nome_fantasia ILIKE $' + params.length +
        ' OR c.cnpj ILIKE $' + params.length +
        ' OR c.cidade ILIKE $' + params.length + ')');
    }

    const linhas = await db.todos(
      `SELECT c.*,
              u.nome AS responsavel_nome,
              COALESCE(s.segmentos, '{}') AS segmentos,
              COALESCE(d.em_risco, 0)     AS certidoes_em_risco,
              COALESCE(p.participacoes, 0) AS participacoes
         FROM cliente c
         LEFT JOIN usuario u ON u.id = c.responsavel_id
         LEFT JOIN (
              SELECT cs.cliente_id, array_agg(sg.nome ORDER BY sg.nome) AS segmentos
                FROM cliente_segmento cs JOIN segmento sg ON sg.id = cs.segmento_id
               GROUP BY cs.cliente_id
         ) s ON s.cliente_id = c.id
         LEFT JOIN (
              SELECT cliente_id, count(*) AS em_risco
                FROM vw_documento_status
               WHERE situacao IN ('vencido','a_vencer')
               GROUP BY cliente_id
         ) d ON d.cliente_id = c.id
         LEFT JOIN (
              SELECT cliente_id, count(*) AS participacoes
                FROM participacao GROUP BY cliente_id
         ) p ON p.cliente_id = c.id
        WHERE ` + condicoes.join(' AND ') + `
        ORDER BY COALESCE(c.nome_fantasia, c.razao_social)`,
      params
    );
    return res.json({ clientes: linhas });
  } catch (erro) {
    return proximo(erro);
  }
});

// Ficha completa: dados + segmentos + contatos + certidoes + desempenho.
router.get('/:id', async function (req, res, proximo) {
  try {
    const id = Number(req.params.id);

    const cliente = await db.um(
      `SELECT c.*, u.nome AS responsavel_nome
         FROM cliente c LEFT JOIN usuario u ON u.id = c.responsavel_id
        WHERE c.id = $1`,
      [id]
    );
    if (!cliente) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }

    const [segmentos, contatos, certidoes, desempenho] = await Promise.all([
      db.todos(
        `SELECT sg.id, sg.nome FROM cliente_segmento cs
           JOIN segmento sg ON sg.id = cs.segmento_id
          WHERE cs.cliente_id = $1 ORDER BY sg.nome`, [id]
      ),
      db.todos(
        'SELECT * FROM contato WHERE cliente_id = $1 ORDER BY principal DESC, nome', [id]
      ),
      db.todos(
        `SELECT tipo_nome, numero, validade, situacao, dias_para_vencer, arquivo_url
           FROM vw_documento_status WHERE cliente_id = $1
          ORDER BY CASE situacao WHEN 'vencido' THEN 0 WHEN 'a_vencer' THEN 1 ELSE 2 END,
                   validade NULLS LAST`, [id]
      ),
      db.um(
        `SELECT count(*) FILTER (WHERE disputou)                    AS disputadas,
                count(*) FILTER (WHERE venceu)                      AS ganhas,
                count(*)                                            AS total,
                COALESCE(sum(valor_ganho) FILTER (WHERE venceu), 0) AS faturamento
           FROM vw_participacao WHERE cliente_id = $1`, [id]
      )
    ]);

    const disputadas = Number(desempenho.disputadas) || 0;
    return res.json({
      cliente: cliente,
      segmentos: segmentos,
      contatos: contatos,
      certidoes: certidoes,
      desempenho: {
        total: Number(desempenho.total) || 0,
        disputadas: disputadas,
        ganhas: Number(desempenho.ganhas) || 0,
        taxa_vitoria: disputadas ? Number(desempenho.ganhas) / disputadas : null,
        faturamento: desempenho.faturamento
      }
    });
  } catch (erro) {
    return proximo(erro);
  }
});

async function gravarSegmentos(c, clienteId, segmentoIds) {
  await c.query('DELETE FROM cliente_segmento WHERE cliente_id = $1', [clienteId]);
  const ids = (segmentoIds || []).map(Number).filter(function (n) { return n > 0; });
  if (ids.length) {
    await c.query(
      `INSERT INTO cliente_segmento (cliente_id, segmento_id)
       SELECT $1, unnest($2::bigint[])`,
      [clienteId, ids]
    );
  }
}

router.post('/', auth.exigirPapel('comercial', 'operador'), async function (req, res, proximo) {
  try {
    const b = req.body || {};
    if (!b.razao_social || !String(b.razao_social).trim()) {
      return res.status(400).json({ erro: 'Informe a razão social.' });
    }
    if (b.status && STATUS.indexOf(b.status) === -1) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const id = await db.transacao(async function (c) {
      const linha = (await c.query(
        `INSERT INTO cliente (razao_social, nome_fantasia, cnpj, cidade, uf, palavras_chave,
                              locais_entrega, comissao_pct_padrao, status, responsavel_id, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [String(b.razao_social).trim(), b.nome_fantasia || null, b.cnpj || null,
         b.cidade || null, (b.uf || 'PR').toUpperCase().slice(0, 2),
         comoLista(b.palavras_chave), b.locais_entrega || null,
         Number(b.comissao_pct_padrao) || 0, b.status || 'ativo',
         b.responsavel_id || null, b.obs || null]
      )).rows[0];

      await gravarSegmentos(c, linha.id, b.segmentos);

      if (b.contato_nome && String(b.contato_nome).trim()) {
        await c.query(
          `INSERT INTO contato (cliente_id, nome, cargo, email, telefone, principal)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [linha.id, String(b.contato_nome).trim(), b.contato_cargo || null,
           b.contato_email || null, b.contato_telefone || null]
        );
      }

      await c.query(
        "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao) VALUES ($1, 'cliente', $2, 'criar')",
        [req.usuario.id, linha.id]
      );
      return linha.id;
    });

    return res.status(201).json({ id: id });
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cliente com este CNPJ.' });
    }
    return proximo(erro);
  }
});

router.put('/:id', auth.exigirPapel('comercial', 'operador'), async function (req, res, proximo) {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    if (b.status && STATUS.indexOf(b.status) === -1) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const atualizado = await db.transacao(async function (c) {
      const CAMPOS = ['razao_social', 'nome_fantasia', 'cnpj', 'cidade', 'uf',
        'locais_entrega', 'comissao_pct_padrao', 'status', 'responsavel_id', 'obs'];
      const sets = [];
      const params = [id];
      CAMPOS.forEach(function (campo) {
        if (b[campo] !== undefined) {
          params.push(b[campo] === '' ? null : b[campo]);
          sets.push(campo + ' = $' + params.length);
        }
      });
      if (b.palavras_chave !== undefined) {
        params.push(comoLista(b.palavras_chave));
        sets.push('palavras_chave = $' + params.length);
      }

      let linha = null;
      if (sets.length) {
        linha = (await c.query(
          'UPDATE cliente SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING id', params
        )).rows[0];
        if (!linha) return null;
      }

      if (b.segmentos !== undefined) {
        await gravarSegmentos(c, id, b.segmentos);
      }

      await c.query(
        "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao) VALUES ($1, 'cliente', $2, 'atualizar')",
        [req.usuario.id, id]
      );
      return { id: id };
    });

    if (!atualizado) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    return res.json(atualizado);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um cliente com este CNPJ.' });
    }
    return proximo(erro);
  }
});

router.post('/:id/contatos', auth.exigirPapel('comercial', 'operador'), async function (req, res, proximo) {
  try {
    const b = req.body || {};
    if (!b.nome || !String(b.nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome do contato.' });
    }
    const linha = await db.um(
      `INSERT INTO contato (cliente_id, nome, cargo, email, telefone, principal)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [Number(req.params.id), String(b.nome).trim(), b.cargo || null,
       b.email || null, b.telefone || null, !!b.principal]
    );
    return res.status(201).json(linha);
  } catch (erro) {
    return proximo(erro);
  }
});

module.exports = router;
