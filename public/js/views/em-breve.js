/* Placeholder das telas que entram na Fase 3 (clientes, certidoes, pipeline,
   comissoes). Mantem a navegacao inteira desde o shell. */
(function (global) {
  'use strict';

  const e = UI.e;

  function EmBreve(props) {
    return e('div', { className: 'em-breve' },
      e('h2', null, props.rota.titulo),
      e('p', null, 'Módulo em construção.'),
      e('span', { className: 'fase-tag' }, 'Em breve')
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.EmBreve = EmBreve;
})(window);
