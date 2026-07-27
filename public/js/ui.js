/* Utilitarios de interface: atalho para React.createElement, formatadores
   pt-BR e rotulos de dominio. Sem JSX — tudo via e(). */
(function (global) {
  'use strict';

  const e = React.createElement;

  const moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 2
  });

  function moeda(valor) {
    const n = Number(valor || 0);
    return moedaFmt.format(n);
  }

  // Versao compacta para os cartoes de indicador: R$ 1,2 mi / R$ 340 mil
  function moedaCurta(valor) {
    const n = Number(valor || 0);
    if (Math.abs(n) >= 1000000) {
      return 'R$ ' + (n / 1000000).toFixed(1).replace('.', ',') + ' mi';
    }
    if (Math.abs(n) >= 1000) {
      return 'R$ ' + Math.round(n / 1000) + ' mil';
    }
    return moeda(n);
  }

  function percentual(fracao, casas) {
    if (fracao === null || fracao === undefined) return '—';
    return (Number(fracao) * 100).toFixed(casas === undefined ? 1 : casas).replace('.', ',') + '%';
  }

  function numero(valor) {
    return new Intl.NumberFormat('pt-BR').format(Number(valor || 0));
  }

  function dataBR(valor) {
    if (!valor) return '—';
    const texto = String(valor).slice(0, 10);
    const partes = texto.split('-');
    if (partes.length !== 3) return texto;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function dataHoraBR(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (isNaN(d.getTime())) return dataBR(valor);
    return d.toLocaleDateString('pt-BR') + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // "hoje", "amanha", "em 3 dias", "ha 2 dias"
  function relativo(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (isNaN(d.getTime())) return '—';
    const hoje = new Date();
    const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dias = Math.round((a - b) / 86400000);
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    if (dias === -1) return 'ontem';
    if (dias > 1) return 'em ' + dias + ' dias';
    return 'há ' + Math.abs(dias) + ' dias';
  }

  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/);
    if (!partes[0]) return '?';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  const ROTULO_FASE = {
    em_analise: 'Em análise',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    disputado: 'Disputado',
    ganho: 'Ganho',
    perdido: 'Perdido',
    contratado: 'Contratado',
    em_execucao: 'Em execução',
    entregue: 'Entregue',
    encerrado: 'Encerrado'
  };

  const ORDEM_FASE = ['em_analise', 'aprovado', 'disputado', 'ganho', 'contratado',
    'em_execucao', 'entregue', 'encerrado', 'perdido', 'recusado'];

  const ROTULO_PRAZO = {
    impugnacao: 'Impugnação',
    esclarecimento: 'Esclarecimento',
    recurso: 'Recurso',
    contrarrazao: 'Contrarrazão',
    envio_docs: 'Envio de documentos',
    convocacao: 'Convocação',
    sessao: 'Sessão',
    entrega: 'Entrega',
    renovacao_certidao: 'Renovação de certidão',
    outro: 'Outro'
  };

  const ROTULO_PAPEL = {
    admin: 'Administrador',
    operador: 'Operacional',
    comercial: 'Comercial',
    financeiro: 'Financeiro'
  };

  // ------------------------------------------------------------- componentes
  function Indicador(props) {
    return e('div', { className: 'indicador ' + (props.tom || '') },
      e('div', { className: 'rotulo' }, props.rotulo),
      e('div', { className: 'valor' }, props.valor),
      props.nota ? e('div', { className: 'nota' }, props.nota) : null
    );
  }

  function Cartao(props) {
    return e('section', { className: 'cartao' },
      props.titulo
        ? e('div', { className: 'cartao-cabecalho' },
            e('h2', null, props.titulo),
            props.acao || null)
        : null,
      props.children
    );
  }

  function Vazio(props) {
    return e('div', { className: 'vazio' },
      e('div', { className: 'glifo' }, props.glifo || '○'),
      e('p', null, props.texto || 'Nada por aqui ainda.')
    );
  }

  global.UI = {
    e: e,
    moeda: moeda,
    moedaCurta: moedaCurta,
    percentual: percentual,
    numero: numero,
    dataBR: dataBR,
    dataHoraBR: dataHoraBR,
    relativo: relativo,
    iniciais: iniciais,
    ROTULO_FASE: ROTULO_FASE,
    ORDEM_FASE: ORDEM_FASE,
    ROTULO_PRAZO: ROTULO_PRAZO,
    ROTULO_PAPEL: ROTULO_PAPEL,
    Indicador: Indicador,
    Cartao: Cartao,
    Vazio: Vazio
  };
})(window);
