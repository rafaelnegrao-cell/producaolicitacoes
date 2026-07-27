/* Tela de login. */
(function (global) {
  'use strict';

  const e = UI.e;

  function Login(props) {
    const email = React.useState('');
    const senha = React.useState('');
    const erro = React.useState('');
    const enviando = React.useState(false);

    async function enviar(evento) {
      evento.preventDefault();
      erro[1]('');
      enviando[1](true);
      try {
        const resposta = await API.login(email[0].trim(), senha[0]);
        props.aoEntrar(resposta.usuario);
      } catch (falha) {
        erro[1](falha.message);
        enviando[1](false);
      }
    }

    return e('div', { className: 'tela-login' },
      e('form', { className: 'caixa-login', onSubmit: enviar },
        e('div', { className: 'login-marca' },
          e('div', { className: 'nome' }, 'Produção'),
          e('div', { className: 'traco' }),
          e('div', { className: 'sub' }, 'Assessoria em Licitações')
        ),

        erro[0] ? e('div', { className: 'aviso-erro' }, erro[0]) : null,

        e('div', { className: 'campo' },
          e('label', { htmlFor: 'email' }, 'E-mail'),
          e('input', {
            id: 'email', type: 'email', autoComplete: 'username',
            autoFocus: true, required: true, value: email[0],
            onChange: function (ev) { email[1](ev.target.value); }
          })
        ),

        e('div', { className: 'campo' },
          e('label', { htmlFor: 'senha' }, 'Senha'),
          e('input', {
            id: 'senha', type: 'password', autoComplete: 'current-password',
            required: true, value: senha[0],
            onChange: function (ev) { senha[1](ev.target.value); }
          })
        ),

        e('button', { className: 'botao', type: 'submit', disabled: enviando[0] },
          enviando[0] ? 'Entrando...' : 'Entrar'),

        e('div', { className: 'dica-login' },
          'Sistema interno · acesso restrito à equipe')
      )
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.Login = Login;
})(window);
