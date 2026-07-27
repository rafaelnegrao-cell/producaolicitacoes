/* Painel — esqueleto da v0.1: taxa de vitoria, comissoes, certidoes,
   funil e proximos prazos. Os recortes por cliente/segmento/orgao entram na Fase 4. */
(function (global) {
  'use strict';

  const e = UI.e;

  function Funil(props) {
    const mapa = {};
    (props.dados || []).forEach(function (item) { mapa[item.fase] = item.qtd; });
    const maior = Math.max.apply(null, [1].concat((props.dados || []).map(function (i) { return i.qtd; })));

    const fases = UI.ORDEM_FASE.filter(function (f) { return mapa[f]; });
    if (!fases.length) return e(UI.Vazio, { texto: 'Nenhuma participação registrada.' });

    return e('div', null, fases.map(function (fase) {
      const qtd = mapa[fase];
      const classe = fase === 'ganho' ? 'ganho' : (fase === 'perdido' || fase === 'recusado' ? 'perdido' : '');
      return e('div', { className: 'funil-linha', key: fase },
        e('div', { className: 'funil-topo' },
          e('span', { className: 'fase' }, UI.ROTULO_FASE[fase] || fase),
          e('span', { className: 'qtd' }, UI.numero(qtd))
        ),
        e('div', { className: 'funil-trilho' },
          e('div', { className: 'funil-barra ' + classe, style: { width: (qtd / maior * 100) + '%' } })
        )
      );
    }));
  }

  function Prazos(props) {
    if (!props.itens || !props.itens.length) {
      return e(UI.Vazio, { glifo: '✓', texto: 'Nenhum prazo aberto nos próximos dias.' });
    }
    return e('ul', { className: 'lista' }, props.itens.map(function (p) {
      const data = new Date(p.data_hora);
      const atrasado = data < new Date();
      const cliente = p.nome_fantasia || p.razao_social || p.orgao_nome || '—';
      return e('li', { key: p.id },
        e('div', { className: 'principal' },
          e('div', { className: 'linha1' }, p.titulo || UI.ROTULO_PRAZO[p.tipo] || p.tipo),
          e('div', { className: 'linha2' },
            cliente + (p.numero_edital ? ' · ' + p.numero_edital : ''))
        ),
        e('div', { className: 'direita' },
          e('span', { className: 'etiqueta ' + (atrasado ? 'perigo' : '') }, UI.relativo(p.data_hora)),
          e('div', { style: { marginTop: '3px', color: 'var(--texto-suave)' } }, UI.dataHoraBR(p.data_hora))
        )
      );
    }));
  }

  function Certidoes(props) {
    const c = props.dados;
    const faixas = [
      { rotulo: 'Vencidas', valor: c.vencidas, classe: 'perigo' },
      { rotulo: 'Vencem em até 7 dias', valor: c.ate_7, classe: 'perigo' },
      { rotulo: 'Vencem em até 15 dias', valor: c.ate_15, classe: 'alerta' },
      { rotulo: 'Vencem em até 30 dias', valor: c.ate_30, classe: 'alerta' },
      { rotulo: 'Vigentes', valor: c.vigentes, classe: 'ok' }
    ];
    return e('ul', { className: 'lista' }, faixas.map(function (f) {
      return e('li', { key: f.rotulo },
        e('div', { className: 'principal' },
          e('div', { className: 'linha1' }, f.rotulo)),
        e('div', { className: 'direita' },
          e('span', { className: 'etiqueta ' + (f.valor ? f.classe : '') }, UI.numero(f.valor)))
      );
    }));
  }

  function Dashboard() {
    const dados = React.useState(null);
    const erro = React.useState('');

    React.useEffect(function () {
      let vivo = true;
      API.get('/api/dashboard/resumo')
        .then(function (r) { if (vivo) dados[1](r); })
        .catch(function (f) { if (vivo) erro[1](f.message); });
      return function () { vivo = false; };
    }, []);

    if (erro[0]) return e('div', { className: 'aviso-erro' }, erro[0]);
    if (!dados[0]) return e(UI.Vazio, { glifo: '◌', texto: 'Carregando indicadores...' });

    const d = dados[0];
    const aVencer = d.certidoes.vencidas + d.certidoes.ate_30;

    return e('div', null,
      e('div', { className: 'grade' },
        e(UI.Indicador, {
          tom: 'destaque',
          rotulo: 'Taxa de vitória',
          valor: UI.percentual(d.disputas.taxa_vitoria),
          nota: UI.numero(d.disputas.ganhas) + ' de ' + UI.numero(d.disputas.disputadas) + ' disputas'
        }),
        e(UI.Indicador, {
          rotulo: 'Participações no período',
          valor: UI.numero(d.disputas.total),
          nota: UI.numero(d.disputas.recusadas) + ' recusadas na triagem'
        }),
        e(UI.Indicador, {
          tom: 'ouro',
          rotulo: 'Comissão a receber',
          valor: UI.moedaCurta(d.comissoes.a_receber),
          nota: UI.numero(d.comissoes.qtd_a_receber) + ' lançamentos em aberto'
        }),
        e(UI.Indicador, {
          tom: aVencer ? 'risco' : '',
          rotulo: 'Certidões em risco',
          valor: UI.numero(aVencer),
          nota: UI.numero(d.certidoes.vencidas) + ' já vencidas'
        })
      ),

      e('div', { className: 'grade duas uma', style: { marginTop: '14px' } },
        e(UI.Cartao, { titulo: 'Comissões' },
          e('ul', { className: 'lista' },
            e('li', null,
              e('div', { className: 'principal' },
                e('div', { className: 'linha1' }, 'A receber'),
                e('div', { className: 'linha2' }, UI.numero(d.comissoes.qtd_a_receber) + ' lançamentos')),
              e('div', { className: 'direita' }, UI.moeda(d.comissoes.a_receber))),
            e('li', null,
              e('div', { className: 'principal' },
                e('div', { className: 'linha1' }, 'Em atraso'),
                e('div', { className: 'linha2' }, UI.numero(d.comissoes.qtd_atrasada) + ' lançamentos')),
              e('div', { className: 'direita' },
                e('span', { className: 'etiqueta ' + (d.comissoes.atrasada ? 'perigo' : '') },
                  UI.moeda(d.comissoes.atrasada)))),
            e('li', null,
              e('div', { className: 'principal' },
                e('div', { className: 'linha1' }, 'Recebida no período'),
                e('div', { className: 'linha2' }, UI.dataBR(d.periodo.de) + ' a ' + UI.dataBR(d.periodo.ate))),
              e('div', { className: 'direita' },
                e('span', { className: 'etiqueta ok' }, UI.moeda(d.comissoes.recebida_periodo)))),
            e('li', null,
              e('div', { className: 'principal' },
                e('div', { className: 'linha1' }, 'Projetada'),
                e('div', { className: 'linha2' }, 'Empenhos ainda não faturados')),
              e('div', { className: 'direita' }, UI.moeda(d.comissoes.projetada)))
          )
        ),

        e(UI.Cartao, { titulo: 'Certidões' }, e(Certidoes, { dados: d.certidoes }))
      ),

      e('div', { className: 'grade duas uma', style: { marginTop: '14px' } },
        e(UI.Cartao, { titulo: 'Funil de processos' }, e(Funil, { dados: d.funil })),
        e(UI.Cartao, { titulo: 'Próximos prazos' }, e(Prazos, { itens: d.prazos }))
      ),

      e(UI.Cartao, { titulo: 'Faturamento gerado para os clientes' },
        e('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
          e('div', { className: 'fonte-titulo', style: { fontSize: '30px', color: 'var(--verde-profundo)' } },
            UI.moeda(d.disputas.faturamento_gerado)),
          e('div', { style: { color: 'var(--texto-suave)', fontSize: '13px' } },
            'em licitações vencidas entre ' + UI.dataBR(d.periodo.de) + ' e ' + UI.dataBR(d.periodo.ate))
        )
      )
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Dashboard = Dashboard;
})(window);
