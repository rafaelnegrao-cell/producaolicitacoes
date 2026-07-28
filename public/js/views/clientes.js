/* Clientes — carteira com perfil de atuacao. A ficha reune os dados
   cadastrais, o desempenho em disputas e as certidoes do cliente, para
   evitar o vaivem entre telas durante a demo. */
(function (global) {
  'use strict';

  const e = UI.e;

  const ROTULO_STATUS = { ativo: 'Ativo', sazonal: 'Sazonal', inativo: 'Inativo' };

  function FormularioCliente(props) {
    const meta = props.meta;
    const c = props.cliente || {};
    const novo = !props.cliente;

    const razaoSocial = React.useState(c.razao_social || '');
    const nomeFantasia = React.useState(c.nome_fantasia || '');
    const cnpj = React.useState(c.cnpj || '');
    const cidade = React.useState(c.cidade || '');
    const uf = React.useState(c.uf || 'PR');
    const comissao = React.useState(c.comissao_pct_padrao !== undefined ? String(c.comissao_pct_padrao) : '');
    const status = React.useState(c.status || 'ativo');
    const responsavel = React.useState(c.responsavel_id ? String(c.responsavel_id) : '');
    const palavras = React.useState(
      Array.isArray(c.palavras_chave) ? c.palavras_chave.join(', ') : ''
    );
    const locais = React.useState(c.locais_entrega || '');
    const segmentos = React.useState((props.segmentos || []).map(function (s) { return String(s.id); }));
    const contatoNome = React.useState('');
    const contatoTelefone = React.useState('');
    const erro = React.useState('');
    const salvando = React.useState(false);

    function alternarSegmento(id) {
      const atual = segmentos[0];
      segmentos[1](atual.indexOf(id) === -1
        ? atual.concat([id])
        : atual.filter(function (x) { return x !== id; }));
    }

    async function salvar(ev) {
      ev.preventDefault();
      erro[1]('');
      salvando[1](true);
      try {
        const corpo = {
          razao_social: razaoSocial[0].trim(),
          nome_fantasia: nomeFantasia[0].trim() || null,
          cnpj: cnpj[0].trim() || null,
          cidade: cidade[0].trim() || null,
          uf: uf[0].trim().toUpperCase() || 'PR',
          comissao_pct_padrao: Number(comissao[0]) || 0,
          status: status[0],
          responsavel_id: responsavel[0] ? Number(responsavel[0]) : null,
          palavras_chave: palavras[0],
          locais_entrega: locais[0].trim() || null,
          segmentos: segmentos[0].map(Number)
        };
        if (novo) {
          corpo.contato_nome = contatoNome[0].trim() || null;
          corpo.contato_telefone = contatoTelefone[0].trim() || null;
          await API.post('/api/clientes', corpo);
        } else {
          await API.put('/api/clientes/' + c.id, corpo);
        }
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
        salvando[1](false);
      }
    }

    return e('form', { onSubmit: salvar },
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e('div', { className: 'campo' },
        e('label', null, 'Razão social'),
        e('input', {
          type: 'text', required: true, autoFocus: novo, value: razaoSocial[0],
          onChange: function (ev) { razaoSocial[1](ev.target.value); }
        })),

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Nome fantasia'),
          e('input', {
            type: 'text', value: nomeFantasia[0],
            onChange: function (ev) { nomeFantasia[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'CNPJ'),
          e('input', {
            type: 'text', value: cnpj[0], placeholder: '00.000.000/0001-00',
            onChange: function (ev) { cnpj[1](ev.target.value); }
          }))
      ),

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Cidade'),
          e('input', {
            type: 'text', value: cidade[0],
            onChange: function (ev) { cidade[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'UF'),
          e('input', {
            type: 'text', maxLength: 2, value: uf[0],
            onChange: function (ev) { uf[1](ev.target.value); }
          }))
      ),

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, '% de comissão'),
          e('input', {
            type: 'number', step: '0.001', min: '0', value: comissao[0],
            placeholder: 'Ex.: 4', onChange: function (ev) { comissao[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'Situação'),
          e('select', { value: status[0], onChange: function (ev) { status[1](ev.target.value); } },
            e('option', { value: 'ativo' }, 'Ativo'),
            e('option', { value: 'sazonal' }, 'Sazonal'),
            e('option', { value: 'inativo' }, 'Inativo')))
      ),

      e('div', { className: 'campo' },
        e('label', null, 'Segmentos'),
        e('div', { className: 'grupo-radio' },
          (meta ? meta.segmentos : []).map(function (s) {
            const id = String(s.id);
            return e('button', {
              key: s.id, type: 'button',
              className: segmentos[0].indexOf(id) !== -1 ? 'ativo' : '',
              onClick: function () { alternarSegmento(id); }
            }, s.nome);
          }))),

      e('div', { className: 'campo' },
        e('label', null, 'Palavras-chave (separadas por vírgula)'),
        e('input', {
          type: 'text', value: palavras[0],
          placeholder: 'merenda escolar, hortifruti, carnes',
          onChange: function (ev) { palavras[1](ev.target.value); }
        })),

      e('div', { className: 'campo' },
        e('label', null, 'Locais de entrega'),
        e('textarea', {
          rows: 2, value: locais[0],
          placeholder: 'Ex.: Londrina e região, raio de 150 km',
          onChange: function (ev) { locais[1](ev.target.value); }
        })),

      e('div', { className: 'campo' },
        e('label', null, 'Responsável na Produção'),
        e('select', {
          value: responsavel[0],
          onChange: function (ev) { responsavel[1](ev.target.value); }
        },
          e('option', { value: '' }, 'Sem responsável'),
          (meta ? meta.usuarios : []).map(function (u) {
            return e('option', { key: u.id, value: u.id }, u.nome);
          }))),

      novo
        ? e('div', { className: 'form-linha' },
            e('div', { className: 'campo' },
              e('label', null, 'Contato principal (opcional)'),
              e('input', {
                type: 'text', value: contatoNome[0],
                onChange: function (ev) { contatoNome[1](ev.target.value); }
              })),
            e('div', { className: 'campo' },
              e('label', null, 'Telefone'),
              e('input', {
                type: 'text', value: contatoTelefone[0],
                onChange: function (ev) { contatoTelefone[1](ev.target.value); }
              })))
        : null,

      e('div', { className: 'form-acoes' },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoFechar }, 'Cancelar'),
        e('button', { className: 'botao', type: 'submit', disabled: salvando[0] },
          salvando[0] ? 'Salvando...' : (novo ? 'Cadastrar cliente' : 'Salvar alterações')))
    );
  }

  function Ficha(props) {
    const dados = React.useState(null);
    const editando = React.useState(false);
    const erro = React.useState('');

    React.useEffect(function () {
      let vivo = true;
      API.get('/api/clientes/' + props.clienteId)
        .then(function (r) { if (vivo) dados[1](r); })
        .catch(function (f) { if (vivo) erro[1](f.message); });
      return function () { vivo = false; };
    }, [props.clienteId]);

    if (erro[0]) return e('div', { className: 'aviso-erro' }, erro[0]);
    if (!dados[0]) return e(UI.Vazio, { glifo: '◌', texto: 'Carregando...' });

    const d = dados[0];
    const c = d.cliente;

    if (editando[0]) {
      return e(FormularioCliente, {
        meta: props.meta, cliente: c, segmentos: d.segmentos,
        aoFechar: function () { editando[1](false); },
        aoSalvar: props.aoSalvar
      });
    }

    const emRisco = d.certidoes.filter(function (x) {
      return x.situacao === 'vencido' || x.situacao === 'a_vencer';
    });

    return e('div', null,
      e('div', { style: { marginBottom: '14px' } },
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Razão social'),
          e('span', { className: 'v' }, c.razao_social)),
        c.cnpj ? e('div', { className: 'par' },
          e('span', { className: 'k' }, 'CNPJ'),
          e('span', { className: 'v' }, c.cnpj)) : null,
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Cidade'),
          e('span', { className: 'v' }, (c.cidade || '—') + (c.uf ? '/' + c.uf : ''))),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Segmentos'),
          e('span', { className: 'v' },
            d.segmentos.length ? d.segmentos.map(function (s) { return s.nome; }).join(', ') : '—')),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, '% de comissão'),
          e('span', { className: 'v' }, String(c.comissao_pct_padrao).replace('.', ',') + '%')),
        e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Situação'),
          e('span', { className: 'v' }, ROTULO_STATUS[c.status] || c.status)),
        c.responsavel_nome ? e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Responsável'),
          e('span', { className: 'v' }, c.responsavel_nome)) : null,
        c.palavras_chave && c.palavras_chave.length ? e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Palavras-chave'),
          e('span', { className: 'v', style: { fontWeight: 400 } }, c.palavras_chave.join(', '))) : null,
        c.locais_entrega ? e('div', { className: 'par' },
          e('span', { className: 'k' }, 'Locais de entrega'),
          e('span', { className: 'v', style: { fontWeight: 400 } }, c.locais_entrega)) : null
      ),

      e('div', { className: 'grade duas', style: { marginBottom: '14px' } },
        e(UI.Indicador, {
          tom: 'destaque', rotulo: 'Taxa de vitória',
          valor: UI.percentual(d.desempenho.taxa_vitoria),
          nota: UI.numero(d.desempenho.ganhas) + ' de ' + UI.numero(d.desempenho.disputadas) + ' disputas'
        }),
        e(UI.Indicador, {
          tom: 'ouro', rotulo: 'Faturamento gerado',
          valor: UI.moedaCurta(d.desempenho.faturamento),
          nota: UI.numero(d.desempenho.total) + ' participações'
        })
      ),

      e('h3', { style: { fontSize: '15px', margin: '16px 0 6px' } },
        'Certidões' + (emRisco.length ? ' — ' + emRisco.length + ' em risco' : '')),
      d.certidoes.length
        ? e('ul', { className: 'lista' }, d.certidoes.map(function (x, i) {
            const tom = x.situacao === 'vencido' ? 'perigo'
              : (x.situacao === 'a_vencer' ? (x.dias_para_vencer <= 7 ? 'perigo' : 'alerta') : 'ok');
            return e('li', { key: i },
              e('div', { className: 'principal' },
                e('div', { className: 'linha1' }, x.tipo_nome),
                e('div', { className: 'linha2' }, UI.dataBR(x.validade))),
              e('div', { className: 'direita' },
                e('span', { className: 'etiqueta ' + tom },
                  x.situacao === 'vencido' ? 'vencida'
                    : (x.situacao === 'a_vencer' ? x.dias_para_vencer + ' d' : 'vigente'))));
          }))
        : e(UI.Vazio, { texto: 'Nenhum documento cadastrado.' }),

      d.contatos.length
        ? e(React.Fragment, null,
            e('h3', { style: { fontSize: '15px', margin: '16px 0 6px' } }, 'Contatos'),
            e('ul', { className: 'lista' }, d.contatos.map(function (ct) {
              return e('li', { key: ct.id },
                e('div', { className: 'principal' },
                  e('div', { className: 'linha1' }, ct.nome + (ct.principal ? ' ·' : '')),
                  e('div', { className: 'linha2' },
                    [ct.cargo, ct.telefone, ct.email].filter(Boolean).join(' · '))));
            })))
        : null,

      e('div', { className: 'form-acoes', style: { marginTop: '18px' } },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoFechar }, 'Fechar'),
        e('button', {
          className: 'botao', type: 'button',
          onClick: function () { editando[1](true); }
        }, 'Editar'))
    );
  }

  function Clientes() {
    const meta = UI.useMeta();
    const lista = React.useState(null);
    const status = React.useState('');
    const busca = React.useState('');
    const modal = React.useState(null); // {tipo:'novo'} | {tipo:'ficha', id}
    const erro = React.useState('');
    const recarga = React.useState(0);

    React.useEffect(function () {
      let vivo = true;
      const tempo = setTimeout(function () {
        API.get('/api/clientes', { status: status[0], busca: busca[0] })
          .then(function (r) { if (vivo) lista[1](r.clientes); })
          .catch(function (f) { if (vivo) erro[1](f.message); });
      }, busca[0] ? 250 : 0);
      return function () { vivo = false; clearTimeout(tempo); };
    }, [status[0], busca[0], recarga[0]]);

    function recarregar() {
      modal[1](null);
      recarga[1](recarga[0] + 1);
    }

    const todos = lista[0] || [];
    const chips = [
      { id: '', rotulo: 'Todos', qtd: lista[0] ? todos.length : undefined },
      { id: 'ativo', rotulo: 'Ativos' },
      { id: 'sazonal', rotulo: 'Sazonais' },
      { id: 'inativo', rotulo: 'Inativos' }
    ];

    return e('div', null,
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e(UI.Chips, { itens: chips, ativo: status[0], aoEscolher: function (id) { status[1](id); } }),

      e('div', { className: 'busca' },
        e('input', {
          type: 'search', placeholder: 'Buscar por nome, CNPJ ou cidade...',
          value: busca[0],
          onChange: function (ev) { busca[1](ev.target.value); }
        })),

      e(UI.Cartao, null,
        lista[0] === null
          ? e(UI.Vazio, { glifo: '◌', texto: 'Carregando...' })
          : (!todos.length
            ? e(UI.Vazio, { texto: 'Nenhum cliente com este filtro.' })
            : e('ul', { className: 'lista' }, todos.map(function (c) {
                return e('li', {
                  key: c.id, style: { cursor: 'pointer' },
                  onClick: function () { modal[1]({ tipo: 'ficha', id: c.id }); }
                },
                  e('div', { className: 'principal' },
                    e('div', { className: 'linha1' }, UI.nomeCliente(c)),
                    e('div', { className: 'linha2' },
                      [(c.segmentos || []).join(', '), c.cidade].filter(Boolean).join(' · '))),
                  e('div', { className: 'direita' },
                    e('div', { style: { fontWeight: 600 } },
                      String(c.comissao_pct_padrao).replace('.', ',') + '%'),
                    e('div', { style: { marginTop: '3px' } },
                      Number(c.certidoes_em_risco)
                        ? e('span', { className: 'etiqueta alerta' },
                            c.certidoes_em_risco + ' certidões')
                        : e('span', { style: { color: 'var(--texto-suave)' } },
                            UI.numero(c.participacoes) + ' partic.')))
                );
              })))
      ),

      e(UI.Fab, { titulo: 'Novo cliente', aoClicar: function () { modal[1]({ tipo: 'novo' }); } }),

      modal[0]
        ? e(UI.Modal, {
            titulo: modal[0].tipo === 'novo' ? 'Novo cliente' : 'Ficha do cliente',
            aoFechar: function () { modal[1](null); }
          },
            modal[0].tipo === 'novo'
              ? e(FormularioCliente, {
                  meta: meta, cliente: null, segmentos: [],
                  aoFechar: function () { modal[1](null); }, aoSalvar: recarregar
                })
              : e(Ficha, {
                  clienteId: modal[0].id, meta: meta,
                  aoFechar: function () { modal[1](null); }, aoSalvar: recarregar
                }))
        : null
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Clientes = Clientes;
})(window);
