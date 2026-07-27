/* Shell da SPA: sessao, layout, navegacao e despacho de rota. */
(function (global) {
  'use strict';

  const e = UI.e;

  function Navegacao(props) {
    const itens = Rotas.permitidas(props.papel);

    const lateral = e('nav', { className: 'nav-lateral' },
      e('div', { className: 'marca' }, 'Produção'),
      e('div', { className: 'marca-sub' }, 'Licitações'),
      itens.map(function (r) {
        return e('button', {
          key: r.id,
          className: r.id === props.atual ? 'ativo' : '',
          onClick: function () { Rotas.ir(r.id); }
        }, e('span', { className: 'glifo' }, r.glifo), r.titulo);
      }),
      e('div', { className: 'rodape' }, 'v' + (global.APP_VERSION || '—'))
    );

    const inferior = e('nav', { className: 'nav-inferior' },
      itens.map(function (r) {
        return e('button', {
          key: r.id,
          className: r.id === props.atual ? 'ativo' : '',
          onClick: function () { Rotas.ir(r.id); }
        }, e('span', { className: 'glifo' }, r.glifo), r.titulo);
      })
    );

    return e(React.Fragment, null, lateral, inferior);
  }

  function MenuUsuario(props) {
    return e('div', { className: 'menu-usuario' },
      e('div', { className: 'cabecalho' },
        e('div', { className: 'nome' }, props.usuario.nome),
        e('div', { className: 'papel' }, UI.ROTULO_PAPEL[props.usuario.papel] || props.usuario.papel)
      ),
      e('button', { onClick: props.aoSair }, 'Sair'),
      e('div', { className: 'rodape-versao' }, 'Versão ' + (global.APP_VERSION || '—'))
    );
  }

  function Aplicacao(props) {
    const usuario = props.usuario;
    const rotaId = Rotas.useRota();
    const menuAberto = React.useState(false);

    // Rota fora do alcance do papel volta para o painel.
    const permitidas = Rotas.permitidas(usuario.papel);
    const rota = permitidas.filter(function (r) { return r.id === rotaId; })[0] || permitidas[0];

    React.useEffect(function () {
      menuAberto[1](false);
    }, [rotaId]);

    let conteudo;
    if (rota.id === 'dashboard') {
      conteudo = e(Telas.Dashboard, null);
    } else {
      conteudo = e(Telas.EmBreve, { rota: rota });
    }

    return e('div', { className: 'app' },
      e(Navegacao, { atual: rota.id, papel: usuario.papel }),
      e('header', { className: 'topo', style: { position: 'sticky' } },
        e('div', null,
          e('div', { className: 'titulo-pagina' }, rota.titulo),
          e('div', { className: 'sub-pagina' }, rota.subtitulo)
        ),
        e('div', { style: { position: 'relative' } },
          e('button', {
            className: 'avatar',
            title: usuario.nome,
            onClick: function () { menuAberto[1](!menuAberto[0]); }
          }, UI.iniciais(usuario.nome)),
          menuAberto[0]
            ? e(MenuUsuario, { usuario: usuario, aoSair: props.aoSair })
            : null
        )
      ),
      e('main', { className: 'conteudo' }, conteudo)
    );
  }

  function Raiz() {
    const usuario = React.useState(null);
    const carregando = React.useState(true);

    React.useEffect(function () {
      let vivo = true;
      API.eu()
        .then(function (r) { if (vivo) usuario[1](r.usuario); })
        .catch(function () { /* sem sessao: cai na tela de login */ })
        .finally(function () { if (vivo) carregando[1](false); });

      function expirou() { usuario[1](null); }
      global.addEventListener('sessao-expirada', expirou);
      return function () {
        vivo = false;
        global.removeEventListener('sessao-expirada', expirou);
      };
    }, []);

    async function sair() {
      try { await API.logout(); } catch (erro) { /* segue e limpa o estado local */ }
      usuario[1](null);
      global.location.hash = '#/';
    }

    if (carregando[0]) {
      return e('div', { className: 'carregando-inicial' },
        e('div', { className: 'marca-carregando' }, 'Produção'),
        e('div', { className: 'barra-carregando' }, e('span', null))
      );
    }

    if (!usuario[0]) {
      return e(Telas.Login, { aoEntrar: function (u) { usuario[1](u); } });
    }

    return e(Aplicacao, { usuario: usuario[0], aoSair: sair });
  }

  ReactDOM.createRoot(document.getElementById('raiz')).render(e(Raiz));

  // ------------------------------------------------------------ service worker
  if ('serviceWorker' in navigator) {
    global.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/sw.js?v=' + (global.APP_VERSION || '0'))
        .catch(function () { /* PWA e opcional: falha nao quebra o app */ });
    });
  }
})(window);
