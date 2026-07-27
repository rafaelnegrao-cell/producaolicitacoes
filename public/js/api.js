/* Cliente HTTP da SPA. Sessao vai por cookie httpOnly — nada de token no
   localStorage. Qualquer 401 dispara o evento 'sessao-expirada'. */
(function (global) {
  'use strict';

  async function requisicao(metodo, caminho, corpo) {
    const opcoes = {
      method: metodo,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    };
    if (corpo !== undefined) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }

    let resposta;
    try {
      resposta = await fetch(caminho, opcoes);
    } catch (erro) {
      throw new Error('Sem conexao com o servidor.');
    }

    let dados = null;
    const tipo = resposta.headers.get('content-type') || '';
    if (tipo.indexOf('application/json') !== -1) {
      dados = await resposta.json().catch(function () { return null; });
    }

    if (resposta.status === 401) {
      global.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    if (!resposta.ok) {
      const erro = new Error((dados && dados.erro) || 'Falha na requisicao.');
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  function comQuery(caminho, params) {
    if (!params) return caminho;
    const busca = new URLSearchParams();
    Object.keys(params).forEach(function (chave) {
      const valor = params[chave];
      if (valor !== undefined && valor !== null && valor !== '') {
        busca.append(chave, valor);
      }
    });
    const texto = busca.toString();
    return texto ? caminho + '?' + texto : caminho;
  }

  global.API = {
    get: function (caminho, params) { return requisicao('GET', comQuery(caminho, params)); },
    post: function (caminho, corpo) { return requisicao('POST', caminho, corpo); },
    put: function (caminho, corpo) { return requisicao('PUT', caminho, corpo); },
    del: function (caminho) { return requisicao('DELETE', caminho); },

    login: function (email, senha) { return requisicao('POST', '/api/auth/login', { email: email, senha: senha }); },
    logout: function () { return requisicao('POST', '/api/auth/logout'); },
    eu: function () { return requisicao('GET', '/api/auth/eu'); }
  };
})(window);
