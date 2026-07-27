/* Roteador por hash — sem dependencia externa e sem configuracao de servidor.
   Cada rota declara os papeis que podem ve-la (vazio = todos os autenticados). */
(function (global) {
  'use strict';

  const ROTAS = [
    { id: 'dashboard', caminho: '#/', titulo: 'Painel',
      subtitulo: 'Visão geral da operação', glifo: '◐', papeis: [] },
    { id: 'pipeline', caminho: '#/pipeline', titulo: 'Licitações',
      subtitulo: 'Todas as participações', glifo: '▤', papeis: [] },
    { id: 'clientes', caminho: '#/clientes', titulo: 'Clientes',
      subtitulo: 'Carteira e perfil de atuação', glifo: '◉', papeis: [] },
    { id: 'certidoes', caminho: '#/certidoes', titulo: 'Certidões',
      subtitulo: 'Documentos e vencimentos', glifo: '❋', papeis: [] },
    { id: 'comissoes', caminho: '#/comissoes', titulo: 'Comissões',
      subtitulo: 'A receber e recebidas', glifo: '$', papeis: ['financeiro', 'comercial'] }
  ];

  function normalizar(hash) {
    const limpo = (hash || '').replace(/^#/, '').replace(/\?.*$/, '');
    if (!limpo || limpo === '/' ) return 'dashboard';
    const alvo = '#' + (limpo.charAt(0) === '/' ? limpo : '/' + limpo);
    const rota = ROTAS.filter(function (r) { return r.caminho === alvo; })[0];
    return rota ? rota.id : 'dashboard';
  }

  function porId(id) {
    return ROTAS.filter(function (r) { return r.id === id; })[0] || ROTAS[0];
  }

  function permitidas(papel) {
    return ROTAS.filter(function (r) {
      return !r.papeis.length || papel === 'admin' || r.papeis.indexOf(papel) !== -1;
    });
  }

  function ir(id) {
    global.location.hash = porId(id).caminho;
  }

  // Hook: devolve o id da rota atual e reage ao botao voltar do navegador.
  function useRota() {
    const estado = React.useState(function () { return normalizar(global.location.hash); });
    const atual = estado[0];
    const definir = estado[1];

    React.useEffect(function () {
      function aoMudar() { definir(normalizar(global.location.hash)); }
      global.addEventListener('hashchange', aoMudar);
      return function () { global.removeEventListener('hashchange', aoMudar); };
    }, []);

    return atual;
  }

  global.Rotas = { ROTAS: ROTAS, porId: porId, permitidas: permitidas, ir: ir, useRota: useRota };
})(window);
