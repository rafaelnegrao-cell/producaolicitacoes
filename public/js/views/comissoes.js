/* Comissoes — carteira com destaque para o atraso, filtros por situacao,
   detalhe com historico de valores e baixa de recebimento (parcial ou total). */
(function (global) {
  'use strict';

  const e = UI.e;

  const ROTULO_STATUS = {
    projetada: 'Projetada',
    a_receber: 'A receber',
    em_cobranca: 'Em cobrança',
    recebida: 'Recebida',
    cancelada: 'Cancelada'
  };

  function etiquetaStatus(c) {
    if (c.atrasada) return e('span', { className: 'etiqueta perigo' }, 'em atraso');
    const tons = { recebida: 'ok', em_cobranca: 'alerta', a_receber: '', projetada: '', cancelada: '' };
    return e('span', { className: 'etiqueta ' + (tons[c.status] || '') },
      (ROTULO_STATUS[c.status] || c.status).toLowerCase());
  }

  function FormularioRecebimento(props) {
    const c = props.comissao;
    const hoje = new Date().toISOString().slice(0, 10);
    const valor = React.useState(String(c.valor_aberto));
    const data = React.useState(hoje);
    const forma = React.useState('PIX');
    const obs = React.useState('');
    const erro = React.useState('');
    const salvando = React.useState(false);

    async function salvar(ev) {
      ev.preventDefault();
      erro[1]('');
      salvando[1](true);
      try {
        await API.post('/api/comissoes/' + c.id + '/recebimentos', {
          valor: Number(valor[0]),
          data: data[0],
          forma: forma[0],
          obs: obs[0].trim() || null
        });
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
        salvando[1](false);
      }
    }

    const parcial = Number(valor[0]) > 0 && Number(valor[0]) < Number(c.valor_aberto) - 0.009;

    return e('form', { onSubmit: salvar },
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Valor recebido'),
          e('input', {
            type: 'number', step: '0.01', min: '0.01', max: c.valor_aberto,
            required: true, value: valor[0],
            onChange: function (ev) { valor[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'Data'),
          e('input', {
            type: 'date', required: true, value: data[0],
            onChange: function (ev) { data[1](ev.target.value); }
          }))
      ),
      e('div', { className: 'campo' },
        e('label', null, 'Forma'),
        e('select', { value: forma[0], onChange: function (ev) { forma[1](ev.target.value); } },
          ['PIX', 'TED', 'Boleto', 'Outro'].map(function (f) {
            return e('option', { key: f, value: f }, f);
          }))),
      e('div', { className: 'campo' },
        e('label', null, 'Observação (opcional)'),
        e('input', {
          type: 'text', value: obs[0], placeholder: parcial ? 'Ex.: primeira parcela' : '',
          onChange: function (ev) { obs[1](ev.target.value); }
        })),

      parcial
        ? e('div', { style: { fontSize: '13px', color: 'var(--alerta)', marginBottom: '12px' } },
            'Baixa parcial — restarão ' + UI.moeda(Number(c.valor_aberto) - Number(valor[0])) + ' em aberto.')
        : null,

      e('div', { className: 'form-acoes' },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoVoltar }, 'Voltar'),
        e('button', { className: 'botao', type: 'submit', disabled: salvando[0] },
          salvando[0] ? 'Lançando...' : 'Lançar recebimento')
      )
    );
  }

  function DetalheComissao(props) {
    const c = props.comissao;
    const recebendo = React.useState(false);
    const erro = React.useState('');
    const abertaParaBaixa = c.status !== 'recebida' && c.status !== 'cancelada';

    async function mudarStatus(status) {
      erro[1]('');
      try {
        await API.put('/api/comissoes/' + c.id + '/status', { status: status });
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
      }
    }

    if (recebendo[0]) {
      return e(FormularioRecebimento, {
        comissao: c,
        aoVoltar: function () { recebendo[1](false); },
        aoSalvar: props.aoSalvar
      });
    }

    return e('div', null,
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e('div', { style: { marginBottom: '14px' } },
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Cliente'),
          e('span', { className: 'v' }, UI.nomeCliente(c))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Contrato'),
          e('span', { className: 'v' },
            c.contrato_numero + (c.contrato_tipo === 'ata_registro_preco' ? ' (ata)' : ''))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Órgão'),
          e('span', { className: 'v' }, c.orgao_nome)),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Base (' + (c.tipo_base === 'empenho' ? 'empenho' : 'contrato') + ')'),
          e('span', { className: 'v' }, UI.moeda(c.base) + ' × ' + String(c.pct).replace('.', ',') + '%')),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Valor da comissão'),
          e('span', { className: 'v' }, UI.moeda(c.valor))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Já recebido'),
          e('span', { className: 'v' }, UI.moeda(c.valor_recebido))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Em aberto'),
          e('span', { className: 'v', style: c.atrasada ? { color: 'var(--perigo)' } : null },
            UI.moeda(c.valor_aberto))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Prevista para'),
          e('span', { className: 'v' }, UI.dataBR(c.data_prevista) +
            (c.atrasada ? ' — atrasada' : ''))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Situação'),
          e('span', { className: 'v' }, ROTULO_STATUS[c.status] || c.status))
      ),

      abertaParaBaixa
        ? e('div', { className: 'form-acoes' },
            c.status !== 'em_cobranca' && c.status !== 'projetada'
              ? e('button', {
                  className: 'botao secundario', type: 'button',
                  onClick: function () { mudarStatus('em_cobranca'); }
                }, 'Marcar cobrança')
              : null,
            c.status === 'projetada'
              ? e('button', {
                  className: 'botao secundario', type: 'button',
                  onClick: function () { mudarStatus('a_receber'); }
                }, 'Tornar a receber')
              : null,
            e('button', {
              className: 'botao', type: 'button',
              onClick: function () { recebendo[1](true); }
            }, 'Lançar recebimento')
          )
        : null
    );
  }

  function Comissoes() {
    const resumo = React.useState(null);
    const lista = React.useState(null);
    const situacao = React.useState('abertas');
    const busca = React.useState('');
    const selecionada = React.useState(null);
    const erro = React.useState('');
    const recarga = React.useState(0);

    React.useEffect(function () {
      let vivo = true;
      API.get('/api/comissoes/resumo')
        .then(function (r) { if (vivo) resumo[1](r); })
        .catch(function (f) { if (vivo) erro[1](f.message); });
      return function () { vivo = false; };
    }, [recarga[0]]);

    React.useEffect(function () {
      let vivo = true;
      const tempo = setTimeout(function () {
        API.get('/api/comissoes', { situacao: situacao[0], busca: busca[0] })
          .then(function (r) { if (vivo) lista[1](r.comissoes); })
          .catch(function (f) { if (vivo) erro[1](f.message); });
      }, busca[0] ? 250 : 0);
      return function () { vivo = false; clearTimeout(tempo); };
    }, [situacao[0], busca[0], recarga[0]]);

    function recarregar() {
      selecionada[1](null);
      recarga[1](recarga[0] + 1);
    }

    const r = resumo[0];
    const chips = [
      { id: 'abertas', rotulo: 'Abertas', qtd: r ? Number(r.qtd_a_receber) : undefined },
      { id: 'atraso', rotulo: 'Em atraso', qtd: r ? Number(r.qtd_atrasada) : undefined, tom: 'perigo' },
      { id: 'em_cobranca', rotulo: 'Em cobrança', qtd: r ? Number(r.qtd_em_cobranca) : undefined, tom: 'alerta' },
      { id: 'projetadas', rotulo: 'Projetadas', qtd: r ? Number(r.qtd_projetada) : undefined },
      { id: 'recebidas', rotulo: 'Recebidas', qtd: r ? Number(r.qtd_recebida) : undefined },
      { id: 'todas', rotulo: 'Todas', qtd: r ? Number(r.total) : undefined }
    ];

    return e('div', null,
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      r
        ? e('div', { className: 'grade', style: { marginBottom: '14px' } },
            e(UI.Indicador, {
              tom: 'ouro', rotulo: 'A receber',
              valor: UI.moedaCurta(r.a_receber),
              nota: UI.numero(r.qtd_a_receber) + ' lançamentos'
            }),
            e(UI.Indicador, {
              tom: Number(r.atrasada) ? 'risco' : '',
              rotulo: 'Em atraso',
              valor: UI.moedaCurta(r.atrasada),
              nota: UI.numero(r.qtd_atrasada) + ' lançamentos'
            }),
            e(UI.Indicador, {
              tom: 'destaque', rotulo: 'Recebida (90 dias)',
              valor: UI.moedaCurta(r.recebida_90d),
              nota: UI.numero(r.qtd_recebida) + ' quitadas no total'
            }),
            e(UI.Indicador, {
              rotulo: 'Projetada',
              valor: UI.moedaCurta(r.projetada),
              nota: 'empenhos ainda não faturados'
            })
          )
        : null,

      e(UI.Chips, { itens: chips, ativo: situacao[0], aoEscolher: function (id) { situacao[1](id); } }),

      e('div', { className: 'busca' },
        e('input', {
          type: 'search', placeholder: 'Buscar por cliente, contrato ou órgão...',
          value: busca[0],
          onChange: function (ev) { busca[1](ev.target.value); }
        })),

      e(UI.Cartao, null,
        lista[0] === null
          ? e(UI.Vazio, { glifo: '◌', texto: 'Carregando...' })
          : (!lista[0].length
            ? e(UI.Vazio, { glifo: '✓', texto: 'Nenhuma comissão nesta situação.' })
            : e('ul', { className: 'lista' }, lista[0].map(function (c) {
                return e('li', {
                  key: c.id,
                  style: { cursor: 'pointer' },
                  onClick: function () { selecionada[1](c); }
                },
                  e('div', { className: 'principal' },
                    e('div', { className: 'linha1' }, UI.nomeCliente(c)),
                    e('div', { className: 'linha2' },
                      c.contrato_numero + ' · ' + c.orgao_nome)
                  ),
                  e('div', { className: 'direita' },
                    e('div', { style: { fontWeight: 600, fontSize: '14px' } },
                      UI.moeda(c.status === 'recebida' ? c.valor : c.valor_aberto)),
                    e('div', { style: { marginTop: '3px' } },
                      etiquetaStatus(c),
                      ' ',
                      e('span', { style: { color: 'var(--texto-suave)' } }, UI.dataBR(c.data_prevista)))
                  )
                );
              })))
      ),

      selecionada[0]
        ? e(UI.Modal, {
            titulo: 'Comissão',
            aoFechar: function () { selecionada[1](null); }
          },
            e(DetalheComissao, {
              comissao: selecionada[0],
              aoSalvar: recarregar
            }))
        : null
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Comissoes = Comissoes;
})(window);
