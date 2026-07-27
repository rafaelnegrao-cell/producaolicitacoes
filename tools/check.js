'use strict';

// Roda `node --check` em todos os .js do projeto (menos node_modules).
// Convencao RN: nada e entregue sem passar aqui.
//
//   npm run check

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const IGNORAR = ['node_modules', '.git', 'tmp'];

function varrer(diretorio, encontrados) {
  fs.readdirSync(diretorio, { withFileTypes: true }).forEach(function (item) {
    if (IGNORAR.indexOf(item.name) !== -1) return;
    const completo = path.join(diretorio, item.name);
    if (item.isDirectory()) {
      varrer(completo, encontrados);
    } else if (item.name.endsWith('.js')) {
      encontrados.push(completo);
    }
  });
  return encontrados;
}

const arquivos = varrer(RAIZ, []);
let falhas = 0;

arquivos.forEach(function (arquivo) {
  const relativo = path.relative(RAIZ, arquivo);
  try {
    execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' });
    console.log('  ok   ' + relativo);
  } catch (erro) {
    falhas += 1;
    console.error('  FALHA ' + relativo);
    console.error(String(erro.stderr || erro.message).trim());
  }
});

console.log('\n' + arquivos.length + ' arquivo(s) verificado(s), ' + falhas + ' com erro de sintaxe.');
process.exit(falhas ? 1 : 0);
