/* Placeholder das telas que entram na Fase 3 (clientes, certidoes, pipeline,
   comissoes). Mantem a navegacao inteira desde o shell. */
(function (global) {
  'use strict';

  const e = UI.e;

  const DESCRICOES = {
    pipeline: 'Registro de todas as participações — captação, triagem, disputa e pós-disputa — ' +
      'com fase, responsável e próximo prazo.',
    clientes: 'Carteira com perfil de atuação: segmentos, palavras-chave, locais de entrega ' +
      'e percentual de comissão.',
    certidoes: 'Documentos com validade por cliente, situação derivada e alertas de vencimento ' +
      'em 30, 15 e 7 dias.',
    comissoes: 'Comissão por empenho, posição de a receber × recebida e baixa de recebimentos.'
  };

  function EmBreve(props) {
    return e('div', { className: 'em-breve' },
      e('h2', null, props.rota.titulo),
      e('p', null, DESCRICOES[props.rota.id] || 'Módulo em construção.'),
      e('span', { className: 'fase-tag' }, 'Fase 3')
    );
  }

  global.Telas = global.Telas || {};
  global.Telas.EmBreve = EmBreve;
})(window);
