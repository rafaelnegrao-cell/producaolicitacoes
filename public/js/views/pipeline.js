/* Pipeline — todas as participacoes, em lista ou kanban por fase.
   A estrela da tela e o registro rapido: cliente + orgao + edital e salvar;
   todo o resto tem default. Poucos toques, pensado para o celular. */
(function (global) {
  'use strict';

  const e = UI.e;

  const TOM_FASE = {
    ganho: 'ok', contratado: 'ok', em_execucao: 'ok', entregue: 'ok',
    perdido: 'perigo', recusado: 'perigo',
    disputado: 'alerta',
    em_analise: '', aprovado: '', encerrado: ''
  };

  function etiquetaFase(fase) {
    return e('span', { className: 'etiqueta ' + (TOM_FASE[fase] || '') },
      (UI.ROTULO_FASE[fase] || fase).toLowerCase());
  }

  // ------------------------------------------------------------ registro rapido
  function RegistroRapido(props) {
    const meta = props.meta;
    const clienteId = React.useState('');
    const orgaoId = React.useState('');
    const orgaoNome = React.useState('');
    const orgaoMunicipio = React.useState('');
    const orgaoEsfera = React.useState('municipal');
    const numeroEdital = React.useState('');
    const dataSessao = React.useState('');
    const modalidade = React.useState('pregao_eletronico');
    const valorEstimado = React.useState('');
    const objeto = React.useState('');
    const decisao = React.useState('pendente');
    const erro = React.useState('');
    const salvando = React.useState(false);

    const orgaoNovo = orgaoId[0] === '__novo__';

    async function salvar(ev) {
      ev.preventDefault();
      erro[1]('');
      salvando[1](true);
      try {
        await API.post('/api/pipeline', {
          cliente_id: Number(clienteId[0]),
          orgao_id: orgaoNovo ? null : Number(orgaoId[0]) || null,
          orgao_novo: orgaoNovo
            ? { nome: orgaoNome[0], municipio: orgaoMunicipio[0], esfera: orgaoEsfera[0], uf: 'PR' }
            : null,
          numero_edital: numeroEdital[0],
          data_sessao: dataSessao[0] || null,
          modalidade: modalidade[0],
          valor_estimado: valorEstimado[0] ? Number(valorEstimado[0]) : null,
          objeto: objeto[0].trim() || null,
          decisao: decisao[0]
        });
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
        salvando[1](false);
      }
    }

    return e('form', { onSubmit: salvar },
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e('div', { className: 'campo' },
        e('label', null, 'Cliente'),
        e('select', {
          required: true, autoFocus: true, value: clienteId[0],
          onChange: function (ev) { clienteId[1](ev.target.value); }
        },
          e('option', { value: '' }, 'Selecione...'),
          (meta ? meta.clientes : []).map(function (c) {
            return e('option', { key: c.id, value: c.id }, UI.nomeCliente(c));
          }))),

      e('div', { className: 'campo' },
        e('label', null, 'Órgão'),
        e('select', {
          required: true, value: orgaoId[0],
          onChange: function (ev) { orgaoId[1](ev.target.value); }
        },
          e('option', { value: '' }, 'Selecione...'),
          (meta ? meta.orgaos : []).map(function (o) {
            return e('option', { key: o.id, value: o.id }, o.nome);
          }),
          e('option', { value: '__novo__' }, '+ Novo órgão...'))),

      orgaoNovo
        ? e(React.Fragment, null,
            e('div', { className: 'campo' },
              e('label', null, 'Nome do órgão'),
              e('input', {
                type: 'text', required: true, value: orgaoNome[0],
                placeholder: 'Ex.: Prefeitura Municipal de...',
                onChange: function (ev) { orgaoNome[1](ev.target.value); }
              })),
            e('div', { className: 'form-linha' },
              e('div', { className: 'campo' },
                e('label', null, 'Município'),
                e('input', {
                  type: 'text', value: orgaoMunicipio[0],
                  onChange: function (ev) { orgaoMunicipio[1](ev.target.value); }
                })),
              e('div', { className: 'campo' },
                e('label', null, 'Esfera'),
                e('select', {
                  value: orgaoEsfera[0],
                  onChange: function (ev) { orgaoEsfera[1](ev.target.value); }
                },
                  e('option', { value: 'municipal' }, 'Municipal'),
                  e('option', { value: 'estadual' }, 'Estadual'),
                  e('option', { value: 'federal' }, 'Federal')))))
        : null,

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Nº do edital'),
          e('input', {
            type: 'text', required: true, value: numeroEdital[0],
            placeholder: 'Ex.: 123/2026',
            onChange: function (ev) { numeroEdital[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'Sessão (opcional)'),
          e('input', {
            type: 'datetime-local', value: dataSessao[0],
            onChange: function (ev) { dataSessao[1](ev.target.value); }
          }))
      ),

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Modalidade'),
          e('select', {
            value: modalidade[0],
            onChange: function (ev) { modalidade[1](ev.target.value); }
          },
            e('option', { value: 'pregao_eletronico' }, 'Pregão eletrônico'),
            e('option', { value: 'pregao_presencial' }, 'Pregão presencial'),
            e('option', { value: 'concorrencia' }, 'Concorrência'),
            e('option', { value: 'dispensa' }, 'Dispensa'),
            e('option', { value: 'inexigibilidade' }, 'Inexigibilidade'),
            e('option', { value: 'credenciamento' }, 'Credenciamento'),
            e('option', { value: 'chamada_publica' }, 'Chamada pública'),
            e('option', { value: 'outro' }, 'Outra'))),
        e('div', { className: 'campo' },
          e('label', null, 'Valor estimado (opcional)'),
          e('input', {
            type: 'number', step: '0.01', min: '0', value: valorEstimado[0],
            placeholder: 'R$',
            onChange: function (ev) { valorEstimado[1](ev.target.value); }
          }))
      ),

      e('div', { className: 'campo' },
        e('label', null, 'Objeto (opcional)'),
        e('textarea', {
          rows: 2, value: objeto[0],
          placeholder: 'Ex.: aquisição de gêneros alimentícios...',
          onChange: function (ev) { objeto[1](ev.target.value); }
        })),

      e('div', { className: 'campo' },
        e('label', null, 'Decisão de participar'),
        e('div', { className: 'grupo-radio' },
          [['pendente', 'Aguardando crivo'], ['aprovado', 'Aprovada'], ['recusado', 'Recusada']]
            .map(function (par) {
              return e('button', {
                key: par[0], type: 'button',
                className: decisao[0] === par[0] ? 'ativo' : '',
                onClick: function () { decisao[1](par[0]); }
              }, par[1]);
            }))),

      e('div', { className: 'form-acoes' },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoFechar }, 'Cancelar'),
        e('button', { className: 'botao', type: 'submit', disabled: salvando[0] },
          salvando[0] ? 'Registrando...' : 'Registrar participação'))
    );
  }

  // -------------------------------------------------------------------- detalhe
  function DetalheParticipacao(props) {
    const p = props.participacao;
    const fase = React.useState(p.fase);
    const precoFinal = React.useState(p.preco_final !== null && p.preco_final !== undefined ? String(p.preco_final) : '');
    const valorGanho = React.useState(p.valor_ganho !== null && p.valor_ganho !== undefined ? String(p.valor_ganho) : '');
    const concorrente = React.useState(p.concorrente_vencedor || '');
    const proximoPrazo = React.useState(p.proximo_prazo ? String(p.proximo_prazo).slice(0, 16) : '');
    const erro = React.useState('');
    const salvando = React.useState(false);

    const FASES_GANHAS = ['ganho', 'contratado', 'em_execucao', 'entregue', 'encerrado'];
    const mostraResultado = FASES_GANHAS.indexOf(fase[0]) !== -1 || fase[0] === 'perdido' || fase[0] === 'disputado';
    const ganhou = FASES_GANHAS.indexOf(fase[0]) !== -1;

    async function salvar(ev) {
      ev.preventDefault();
      erro[1]('');
      salvando[1](true);
      try {
        const corpo = { fase: fase[0], proximo_prazo: proximoPrazo[0] || '' };
        if (mostraResultado) corpo.preco_final = precoFinal[0] || '';
        if (ganhou) corpo.valor_ganho = valorGanho[0] || precoFinal[0] || '';
        if (fase[0] === 'perdido') corpo.concorrente_vencedor = concorrente[0] || '';
        await API.put('/api/pipeline/' + p.id, corpo);
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
        salvando[1](false);
      }
    }

    return e('form', { onSubmit: salvar },
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e('div', { style: { marginBottom: '14px' } },
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Cliente'),
          e('span', { className: 'v' }, UI.nomeCliente(p))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Edital'),
          e('span', { className: 'v' }, p.numero_edital)),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Órgão'),
          e('span', { className: 'v' }, p.orgao_nome)),
        p.objeto
          ? e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Objeto'),
              e('span', { className: 'v', style: { fontWeight: 400, textAlign: 'right' } },
                p.objeto.length > 90 ? p.objeto.slice(0, 90) + '…' : p.objeto))
          : null,
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Sessão'),
          e('span', { className: 'v' }, UI.dataHoraBR(p.data_sessao))),
        p.valor_estimado
          ? e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Valor estimado'),
              e('span', { className: 'v' }, UI.moeda(p.valor_estimado)))
          : null,
        p.responsavel_nome
          ? e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Responsável'),
              e('span', { className: 'v' }, p.responsavel_nome))
          : null
      ),

      e('div', { className: 'campo' },
        e('label', null, 'Fase'),
        e('select', { value: fase[0], onChange: function (ev) { fase[1](ev.target.value); } },
          UI.ORDEM_FASE.map(function (f) {
            return e('option', { key: f, value: f }, UI.ROTULO_FASE_CONTAGEM[f]);
          }))),

      mostraResultado
        ? e('div', { className: 'form-linha' },
            e('div', { className: 'campo' },
              e('label', null, 'Preço final (disputa)'),
              e('input', {
                type: 'number', step: '0.01', min: '0', value: precoFinal[0],
                onChange: function (ev) { precoFinal[1](ev.target.value); }
              })),
            ganhou
              ? e('div', { className: 'campo' },
                  e('label', null, 'Valor ganho'),
                  e('input', {
                    type: 'number', step: '0.01', min: '0', value: valorGanho[0],
                    placeholder: precoFinal[0] ? 'padrão: preço final' : '',
                    onChange: function (ev) { valorGanho[1](ev.target.value); }
                  }))
              : e('div', { className: 'campo' },
                  e('label', null, fase[0] === 'perdido' ? 'Concorrente vencedor' : ' '),
                  fase[0] === 'perdido'
                    ? e('input', {
                        type: 'text', value: concorrente[0],
                        onChange: function (ev) { concorrente[1](ev.target.value); }
                      })
                    : e('span', null)))
        : null,

      e('div', { className: 'campo' },
        e('label', null, 'Próximo prazo (opcional)'),
        e('input', {
          type: 'datetime-local', value: proximoPrazo[0],
          onChange: function (ev) { proximoPrazo[1](ev.target.value); }
        })),

      e('div', { className: 'form-acoes' },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoFechar }, 'Cancelar'),
        e('button', { className: 'botao', type: 'submit', disabled: salvando[0] },
          salvando[0] ? 'Salvando...' : 'Salvar'))
    );
  }

  // --------------------------------------------------------------------- kanban
  function Kanban(props) {
    const grupos = {};
    (props.itens || []).forEach(function (p) {
      (grupos[p.fase] = grupos[p.fase] || []).push(p);
    });

    return e('div', { className: 'kanban' },
      UI.ORDEM_FASE.map(function (fase) {
        const cartoes = grupos[fase] || [];
        if (!cartoes.length) return null;
        return e('div', { className: 'kanban-coluna', key: fase },
          e('div', { className: 'kanban-titulo' },
            e('span', null, UI.ROTULO_FASE_CONTAGEM[fase]),
            e('span', { className: 'qtd' }, cartoes.length)),
          cartoes.slice(0, 30).map(function (p) {
            return e('div', {
              className: 'kanban-cartao', key: p.id,
              onClick: function () { props.aoAbrir(p); }
            },
              e('div', { className: 'kc-cliente' }, UI.nomeCliente(p)),
              e('div', { className: 'kc-info' }, p.numero_edital + ' · ' + p.orgao_nome),
              e('div', { className: 'kc-rodape' },
                p.valor_estimado ? UI.moedaCurta(p.valor_estimado) : '—',
                p.proximo_prazo
                  ? e('span', { className: 'kc-prazo' }, UI.relativo(p.proximo_prazo))
                  : null)
            );
          }),
          cartoes.length > 30
            ? e('div', { className: 'kanban-mais' }, '+ ' + (cartoes.length - 30) + ' mais')
            : null
        );
      })
    );
  }

  // ----------------------------------------------------------------------- tela
  function Pipeline() {
    const meta = UI.useMeta();
    const resumo = React.useState(null);
    const lista = React.useState(null);
    const fase = React.useState('');
    const busca = React.useState('');
    const modo = React.useState('lista'); // lista | kanban
    const modal = React.useState(null);   // {tipo:'novo'} | {tipo:'detalhe', p}
    const erro = React.useState('');
    const recarga = React.useState(0);

    React.useEffect(function () {
      let vivo = true;
      API.get('/api/pipeline/resumo')
        .then(function (r) { if (vivo) resumo[1](r); })
        .catch(function (f) { if (vivo) erro[1](f.message); });
      return function () { vivo = false; };
    }, [recarga[0]]);

    React.useEffect(function () {
      let vivo = true;
      const tempo = setTimeout(function () {
        API.get('/api/pipeline', { fase: fase[0], busca: busca[0] })
          .then(function (r) { if (vivo) lista[1](r.participacoes); })
          .catch(function (f) { if (vivo) erro[1](f.message); });
      }, busca[0] ? 250 : 0);
      return function () { vivo = false; clearTimeout(tempo); };
    }, [fase[0], busca[0], recarga[0]]);

    function recarregar() {
      modal[1](null);
      recarga[1](recarga[0] + 1);
    }

    const mapa = {};
    ((resumo[0] && resumo[0].fases) || []).forEach(function (f) { mapa[f.fase] = f.qtd; });
    const total = Object.keys(mapa).reduce(function (s, k) { return s + mapa[k]; }, 0);

    const chips = [{ id: '', rotulo: 'Todas', qtd: resumo[0] ? total : undefined }]
      .concat(UI.ORDEM_FASE.filter(function (f) { return mapa[f]; }).map(function (f) {
        return { id: f, rotulo: UI.ROTULO_FASE_CONTAGEM[f], qtd: mapa[f] };
      }));

    const vitorias = UI.FASES_VITORIA.reduce(function (s, f) { return s + (mapa[f] || 0); }, 0);

    return e('div', null,
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e(UI.Chips, { itens: chips, ativo: fase[0], aoEscolher: function (id) { fase[1](id); } }),

      resumo[0] && vitorias
        ? e('p', { className: 'legenda' },
            e('strong', null, UI.numero(vitorias) + ' vitórias'),
            ' no total. “Ganho” é fase de passagem — dura só até a assinatura, ' +
            'então as vitórias consolidadas aparecem em Contratado, Em execução, ' +
            'Entregue e Encerrado.')
        : null,

      e('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        e('div', { className: 'busca', style: { flex: 1 } },
          e('input', {
            type: 'search', placeholder: 'Buscar por cliente, edital, órgão ou objeto...',
            value: busca[0],
            onChange: function (ev) { busca[1](ev.target.value); }
          })),
        e('button', {
          className: 'chip', style: { marginBottom: '10px' },
          onClick: function () { modo[1](modo[0] === 'lista' ? 'kanban' : 'lista'); }
        }, modo[0] === 'lista' ? '▤ Kanban' : '☰ Lista')),

      lista[0] === null
        ? e(UI.Cartao, null, e(UI.Vazio, { glifo: '◌', texto: 'Carregando...' }))
        : (!lista[0].length
          ? e(UI.Cartao, null, e(UI.Vazio, { texto: 'Nenhuma participação com este filtro.' }))
          : (modo[0] === 'kanban'
            ? e(Kanban, { itens: lista[0], aoAbrir: function (p) { modal[1]({ tipo: 'detalhe', p: p }); } })
            : e(UI.Cartao, null,
                e('ul', { className: 'lista' }, lista[0].map(function (p) {
                  return e('li', {
                    key: p.id,
                    style: { cursor: 'pointer' },
                    onClick: function () { modal[1]({ tipo: 'detalhe', p: p }); }
                  },
                    e('div', { className: 'principal' },
                      e('div', { className: 'linha1' }, UI.nomeCliente(p)),
                      e('div', { className: 'linha2' },
                        p.numero_edital + ' · ' + p.orgao_nome)),
                    e('div', { className: 'direita' },
                      etiquetaFase(p.fase),
                      e('div', { style: { marginTop: '3px', color: 'var(--texto-suave)' } },
                        p.proximo_prazo
                          ? 'prazo ' + UI.relativo(p.proximo_prazo)
                          : UI.dataBR(p.data_sessao)))
                  );
                })))
          )),

      e(UI.Fab, { titulo: 'Registrar participação', aoClicar: function () { modal[1]({ tipo: 'novo' }); } }),

      modal[0]
        ? e(UI.Modal, {
            titulo: modal[0].tipo === 'novo' ? 'Registrar participação' : 'Participação',
            aoFechar: function () { modal[1](null); }
          },
            modal[0].tipo === 'novo'
              ? e(RegistroRapido, { meta: meta, aoFechar: function () { modal[1](null); }, aoSalvar: recarregar })
              : e(DetalheParticipacao, { participacao: modal[0].p, aoFechar: function () { modal[1](null); }, aoSalvar: recarregar }))
        : null
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Pipeline = Pipeline;
})(window);
