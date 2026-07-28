/* Certidoes — painel de alertas por faixa de vencimento, lista filtravel,
   renovacao (toque no item) e cadastro de documento novo (FAB). */
(function (global) {
  'use strict';

  const e = UI.e;

  function etiquetaSituacao(doc) {
    if (doc.situacao === 'vencido') {
      return e('span', { className: 'etiqueta perigo' },
        'vencida há ' + Math.abs(doc.dias_para_vencer) + ' d');
    }
    if (doc.situacao === 'a_vencer') {
      const tom = doc.dias_para_vencer <= 7 ? 'perigo' : 'alerta';
      return e('span', { className: 'etiqueta ' + tom },
        doc.dias_para_vencer === 0 ? 'vence hoje' : 'vence em ' + doc.dias_para_vencer + ' d');
    }
    if (doc.situacao === 'sem_validade') {
      return e('span', { className: 'etiqueta' }, 'sem validade');
    }
    return e('span', { className: 'etiqueta ok' }, 'vigente');
  }

  // Formulario usado tanto para renovar (doc preso) quanto para documento novo.
  function FormularioDocumento(props) {
    const meta = props.meta;
    const doc = props.documento; // null = novo
    const hoje = new Date().toISOString().slice(0, 10);

    const clienteId = React.useState(doc ? String(doc.cliente_id) : '');
    const tipoId = React.useState(doc ? String(doc.tipo_documento_id) : '');
    const numero = React.useState('');
    const emissao = React.useState(hoje);
    const validade = React.useState('');
    const url = React.useState('');
    const erro = React.useState('');
    const salvando = React.useState(false);

    async function salvar(ev) {
      ev.preventDefault();
      erro[1]('');
      salvando[1](true);
      try {
        await API.post('/api/documentos', {
          cliente_id: Number(clienteId[0]),
          tipo_documento_id: Number(tipoId[0]),
          numero: numero[0].trim() || null,
          emissao: emissao[0] || null,
          validade: validade[0] || null,
          arquivo_url: url[0].trim() || null
        });
        props.aoSalvar();
      } catch (falha) {
        erro[1](falha.message);
        salvando[1](false);
      }
    }

    return e('form', { onSubmit: salvar },
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      doc
        ? e('div', { style: { marginBottom: '14px' } },
            e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Cliente'),
              e('span', { className: 'v' }, doc.nome_fantasia || doc.razao_social)),
            e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Documento'),
              e('span', { className: 'v' }, doc.tipo_nome)),
            e('div', { className: 'par' },
              e('span', { className: 'k' }, 'Validade atual'),
              e('span', { className: 'v' }, UI.dataBR(doc.validade)))
          )
        : e(React.Fragment, null,
            e('div', { className: 'campo' },
              e('label', null, 'Cliente'),
              e('select', {
                required: true, value: clienteId[0],
                onChange: function (ev) { clienteId[1](ev.target.value); }
              },
                e('option', { value: '' }, 'Selecione...'),
                (meta ? meta.clientes : []).map(function (c) {
                  return e('option', { key: c.id, value: c.id }, UI.nomeCliente(c));
                }))
            ),
            e('div', { className: 'campo' },
              e('label', null, 'Tipo de documento'),
              e('select', {
                required: true, value: tipoId[0],
                onChange: function (ev) { tipoId[1](ev.target.value); }
              },
                e('option', { value: '' }, 'Selecione...'),
                (meta ? meta.tiposDocumento : []).map(function (t) {
                  return e('option', { key: t.id, value: t.id }, t.nome);
                }))
            )
          ),

      e('div', { className: 'form-linha' },
        e('div', { className: 'campo' },
          e('label', null, 'Emissão'),
          e('input', {
            type: 'date', value: emissao[0],
            onChange: function (ev) { emissao[1](ev.target.value); }
          })),
        e('div', { className: 'campo' },
          e('label', null, 'Nova validade'),
          e('input', {
            type: 'date', required: true, value: validade[0],
            onChange: function (ev) { validade[1](ev.target.value); }
          }))
      ),
      e('div', { className: 'campo' },
        e('label', null, 'Número (opcional)'),
        e('input', {
          type: 'text', value: numero[0], placeholder: 'Nº da certidão',
          onChange: function (ev) { numero[1](ev.target.value); }
        })),
      e('div', { className: 'campo' },
        e('label', null, 'Link do arquivo (opcional)'),
        e('input', {
          type: 'url', value: url[0], placeholder: 'https://...',
          onChange: function (ev) { url[1](ev.target.value); }
        })),

      e('div', { className: 'form-acoes' },
        e('button', { className: 'botao secundario', type: 'button', onClick: props.aoFechar }, 'Cancelar'),
        e('button', { className: 'botao', type: 'submit', disabled: salvando[0] },
          salvando[0] ? 'Salvando...' : (doc ? 'Registrar renovação' : 'Salvar documento'))
      )
    );
  }

  function Certidoes() {
    const meta = UI.useMeta();
    const resumo = React.useState(null);
    const lista = React.useState(null);
    const faixa = React.useState('risco');
    const busca = React.useState('');
    const modal = React.useState(null); // {modo:'renovar', doc} | {modo:'novo'}
    const erro = React.useState('');
    const recarga = React.useState(0);

    React.useEffect(function () {
      let vivo = true;
      API.get('/api/documentos/resumo')
        .then(function (r) { if (vivo) resumo[1](r); })
        .catch(function (f) { if (vivo) erro[1](f.message); });
      return function () { vivo = false; };
    }, [recarga[0]]);

    React.useEffect(function () {
      let vivo = true;
      const tempo = setTimeout(function () {
        API.get('/api/documentos', { faixa: faixa[0], busca: busca[0] })
          .then(function (r) { if (vivo) lista[1](r.documentos); })
          .catch(function (f) { if (vivo) erro[1](f.message); });
      }, busca[0] ? 250 : 0);
      return function () { vivo = false; clearTimeout(tempo); };
    }, [faixa[0], busca[0], recarga[0]]);

    function recarregar() {
      modal[1](null);
      recarga[1](recarga[0] + 1);
    }

    const r = resumo[0];
    const chips = [
      { id: 'risco', rotulo: 'Em risco', qtd: r ? Number(r.vencidas) + Number(r.a_vencer) : undefined },
      { id: 'vencido', rotulo: 'Vencidas', qtd: r ? Number(r.vencidas) : undefined, tom: 'perigo' },
      { id: 'a7', rotulo: '≤ 7 dias', qtd: r ? Number(r.ate_7) : undefined, tom: 'perigo' },
      { id: 'a15', rotulo: '≤ 15 dias', qtd: r ? Number(r.ate_7) + Number(r.de_8_a_15) : undefined, tom: 'alerta' },
      { id: 'a30', rotulo: '≤ 30 dias', qtd: r ? Number(r.ate_7) + Number(r.de_8_a_15) + Number(r.de_16_a_30) : undefined, tom: 'alerta' },
      { id: 'vigente', rotulo: 'Vigentes', qtd: r ? Number(r.vigentes) : undefined },
      { id: 'todas', rotulo: 'Todas', qtd: r ? Number(r.total) : undefined }
    ];

    return e('div', null,
      erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

      e(UI.Chips, { itens: chips, ativo: faixa[0], aoEscolher: function (id) { faixa[1](id); } }),

      e('div', { className: 'busca' },
        e('input', {
          type: 'search', placeholder: 'Buscar por cliente ou documento...',
          value: busca[0],
          onChange: function (ev) { busca[1](ev.target.value); }
        })),

      e(UI.Cartao, null,
        lista[0] === null
          ? e(UI.Vazio, { glifo: '◌', texto: 'Carregando...' })
          : (!lista[0].length
            ? e(UI.Vazio, { glifo: '✓', texto: 'Nenhum documento nesta faixa.' })
            : e('ul', { className: 'lista' }, lista[0].map(function (doc) {
                return e('li', {
                  key: doc.id,
                  style: { cursor: 'pointer' },
                  onClick: function () { modal[1]({ modo: 'renovar', doc: doc }); }
                },
                  e('div', { className: 'principal' },
                    e('div', { className: 'linha1' }, doc.tipo_nome),
                    e('div', { className: 'linha2' },
                      (doc.nome_fantasia || doc.razao_social) +
                      (doc.numero ? ' · nº ' + doc.numero : ''))
                  ),
                  e('div', { className: 'direita' },
                    etiquetaSituacao(doc),
                    e('div', { style: { marginTop: '3px', color: 'var(--texto-suave)' } },
                      UI.dataBR(doc.validade))
                  )
                );
              })))
      ),

      e(UI.Fab, { titulo: 'Novo documento', aoClicar: function () { modal[1]({ modo: 'novo' }); } }),

      modal[0]
        ? e(UI.Modal, {
            titulo: modal[0].modo === 'novo' ? 'Novo documento' : 'Renovar certidão',
            aoFechar: function () { modal[1](null); }
          },
            e(FormularioDocumento, {
              meta: meta,
              documento: modal[0].modo === 'renovar' ? modal[0].doc : null,
              aoFechar: function () { modal[1](null); },
              aoSalvar: recarregar
            }))
        : null
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Certidoes = Certidoes;
})(window);
