'use strict';

// -----------------------------------------------------------------------------
// Seed de demonstracao — dados ficticios, porem realistas, da Producao Assessoria.
// Deterministico: o mesmo comando gera sempre a mesma base (facilita ensaiar a demo).
//
//   npm run seed              popula (limpa as tabelas antes)
//
// ATENCAO: apaga o conteudo das tabelas. Bloqueado em producao sem PERMITIR_SEED=1.
// -----------------------------------------------------------------------------

const config = require('../src/config');
const db = require('../src/db');
const auth = require('../src/auth');

// ------------------------------- aleatorio deterministico --------------------
let semente = 20260727;
function rnd() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function inteiro(min, max) {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function escolher(lista) {
  return lista[Math.floor(rnd() * lista.length)];
}
function chance(pct) {
  return rnd() * 100 < pct;
}
function dinheiro(min, max) {
  return Math.round((min + rnd() * (max - min)) * 100) / 100;
}

// ------------------------------- datas ---------------------------------------
const HOJE = new Date();
function comOffset(dias) {
  const d = new Date(HOJE.getTime() + dias * 24 * 60 * 60 * 1000);
  return d;
}
function data(dias) {
  return comOffset(dias).toISOString().slice(0, 10);
}
function dataHora(dias, hora) {
  const d = comOffset(dias);
  d.setHours(hora === undefined ? inteiro(8, 17) : hora, escolher([0, 15, 30]), 0, 0);
  return d.toISOString();
}

// ------------------------------- insercao em lote ----------------------------
async function inserir(cliente, tabela, colunas, linhas) {
  if (!linhas.length) return [];
  const retorno = [];
  const LOTE = 400;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE);
    const valores = [];
    const grupos = fatia.map(function (linha) {
      const marcadores = linha.map(function (v) {
        valores.push(v);
        return '$' + valores.length;
      });
      return '(' + marcadores.join(',') + ')';
    });
    const texto =
      'INSERT INTO ' + tabela + ' (' + colunas.join(',') + ') VALUES ' +
      grupos.join(',') + ' RETURNING id';
    const res = await cliente.query(texto, valores);
    res.rows.forEach(function (r) { retorno.push(r.id); });
  }
  return retorno;
}

// ------------------------------- catalogos -----------------------------------
const USUARIOS = [
  ['Bruno Egger Camargo', 'bruno@producaolicitacoes.com.br', 'admin'],
  ['Carla Menegatti', 'carla@producaolicitacoes.com.br', 'comercial'],
  ['Diego Ferrarezi', 'diego@producaolicitacoes.com.br', 'operador'],
  ['Juliana Sakamoto', 'juliana@producaolicitacoes.com.br', 'operador'],
  ['Marcos Vinicius Prado', 'marcos@producaolicitacoes.com.br', 'operador'],
  ['Patricia Bonfim', 'patricia@producaolicitacoes.com.br', 'financeiro'],
  ['Renata Alkimin', 'renata@producaolicitacoes.com.br', 'financeiro']
];

const SEGMENTOS = [
  ['Generos alimenticios', 'generos-alimenticios'],
  ['Maquinario agricola', 'maquinario-agricola'],
  ['Maquinario rodoviario', 'maquinario-rodoviario'],
  ['Pecas e servicos', 'pecas-servicos']
];

const TIPOS_DOCUMENTO = [
  ['Cadastro SICAF', 'sicaf', true, 30, 10],
  ['Certidao Federal (RFB/PGFN)', 'federal', true, 30, 20],
  ['Certidao Estadual', 'estadual', true, 30, 30],
  ['Certidao Municipal', 'municipal', true, 30, 40],
  ['CRF / FGTS', 'fgts', true, 15, 50],
  ['CNDT (trabalhista)', 'trabalhista', true, 30, 60],
  ['Falencia e concordata', 'falencia', true, 30, 70],
  ['Balanco patrimonial', 'balanco', true, 60, 80],
  ['Alvara sanitario', 'sanitario', false, 30, 90],
  ['Registro no orgao de classe', 'classe', false, 60, 100]
];

const CLIENTES_ALIMENTOS = [
  ['Nutrimais Distribuidora de Alimentos Ltda', 'Nutrimais', 'Londrina'],
  ['Sabor do Norte Comercio de Generos Ltda', 'Sabor do Norte', 'Maringa'],
  ['Vale Verde Alimentos Ltda', 'Vale Verde', 'Cambe'],
  ['Casa do Produtor Distribuidora Ltda', 'Casa do Produtor', 'Arapongas'],
  ['Bandeirantes Comercio de Alimentos Ltda', 'Bandeirantes Alimentos', 'Bandeirantes'],
  ['Agropan Industria e Comercio Ltda', 'Agropan', 'Rolandia'],
  ['Delta Alimentos Ltda', 'Delta', 'Apucarana'],
  ['Primor Distribuidora de Hortifruti Ltda', 'Primor Hortifruti', 'Londrina'],
  ['Norte Grande Comercial de Generos Ltda', 'Norte Grande', 'Cornelio Procopio'],
  ['Sol Nascente Alimentos Ltda', 'Sol Nascente', 'Ibipora'],
  ['Tres Marias Comercio de Alimentos Ltda', 'Tres Marias', 'Jacarezinho'],
  ['Pontal Distribuidora de Secos e Molhados Ltda', 'Pontal', 'Santo Antonio da Platina'],
  ['Aurora Comercial de Panificados Ltda', 'Aurora Panificados', 'Londrina'],
  ['Boa Mesa Distribuidora Ltda', 'Boa Mesa', 'Astorga'],
  ['Terra Boa Alimentos Ltda', 'Terra Boa', 'Terra Boa'],
  ['Guaravera Comercio de Carnes Ltda', 'Guaravera Carnes', 'Londrina'],
  ['Frios Paiquere Distribuidora Ltda', 'Frios Paiquere', 'Londrina'],
  ['Laticinios Campo Bom Ltda', 'Campo Bom', 'Sertanopolis'],
  ['Cerealista Sao Jorge Ltda', 'Sao Jorge', 'Marialva'],
  ['Pescados Tibagi Comercio Ltda', 'Pescados Tibagi', 'Tibagi'],
  ['Distribuidora Bom Prato Ltda', 'Bom Prato', 'Cianorte'],
  ['Nutrikids Alimentacao Escolar Ltda', 'Nutrikids', 'Maringa'],
  ['Central de Alimentos Paranaense Ltda', 'Central Paranaense', 'Curitiba'],
  ['Horta Nova Hortifruti Ltda', 'Horta Nova', 'Rolandia'],
  ['Grao Fino Cerealista Ltda', 'Grao Fino', 'Londrina'],
  ['Mercomax Distribuidora de Alimentos Ltda', 'Mercomax', 'Umuarama']
];

const CLIENTES_MAQUINAS = [
  ['Maquinas Norte Pioneiro Concessionaria Ltda', 'Norte Pioneiro Maquinas', 'Londrina', 'agricola'],
  ['Tratorama Maquinas Agricolas Ltda', 'Tratorama', 'Maringa', 'agricola'],
  ['Agromaq Implementos Ltda', 'Agromaq', 'Cascavel', 'agricola'],
  ['Rodomaq Equipamentos Rodoviarios Ltda', 'Rodomaq', 'Londrina', 'rodoviario'],
  ['Terra Forte Concessionaria Agricola Ltda', 'Terra Forte', 'Campo Mourao', 'agricola'],
  ['Vale do Ivai Maquinas Ltda', 'Vale do Ivai', 'Ivaipora', 'agricola'],
  ['Pioneira Tratores Ltda', 'Pioneira Tratores', 'Cornelio Procopio', 'agricola'],
  ['Solo Firme Implementos Rodoviarios Ltda', 'Solo Firme', 'Ponta Grossa', 'rodoviario'],
  ['Centro Oeste Maquinas Ltda', 'Centro Oeste', 'Guarapuava', 'agricola'],
  ['Norte Maquinas e Pecas Ltda', 'Norte Maquinas', 'Arapongas', 'rodoviario'],
  ['Bandeirante Equipamentos Ltda', 'Bandeirante Equipamentos', 'Apucarana', 'rodoviario'],
  ['AgroTec Concessionaria Ltda', 'AgroTec', 'Toledo', 'agricola'],
  ['Via Norte Maquinas Rodoviarias Ltda', 'Via Norte', 'Londrina', 'rodoviario'],
  ['Campo Alto Maquinas Agricolas Ltda', 'Campo Alto', 'Palmas', 'agricola']
];

const ORGAOS = [
  ['Prefeitura Municipal de Londrina', 'municipal', 'Londrina', 'alto'],
  ['Prefeitura Municipal de Maringa', 'municipal', 'Maringa', 'alto'],
  ['Prefeitura Municipal de Cambe', 'municipal', 'Cambe', 'medio'],
  ['Prefeitura Municipal de Arapongas', 'municipal', 'Arapongas', 'medio'],
  ['Prefeitura Municipal de Apucarana', 'municipal', 'Apucarana', 'medio'],
  ['Prefeitura Municipal de Rolandia', 'municipal', 'Rolandia', 'baixo'],
  ['Prefeitura Municipal de Ibipora', 'municipal', 'Ibipora', 'baixo'],
  ['Prefeitura Municipal de Cornelio Procopio', 'municipal', 'Cornelio Procopio', 'medio'],
  ['Prefeitura Municipal de Jacarezinho', 'municipal', 'Jacarezinho', 'medio'],
  ['Prefeitura Municipal de Ponta Grossa', 'municipal', 'Ponta Grossa', 'alto'],
  ['Prefeitura Municipal de Cascavel', 'municipal', 'Cascavel', 'alto'],
  ['Prefeitura Municipal de Umuarama', 'municipal', 'Umuarama', 'medio'],
  ['Prefeitura Municipal de Campo Mourao', 'municipal', 'Campo Mourao', 'medio'],
  ['Secretaria de Estado da Educacao do Parana', 'estadual', 'Curitiba', 'alto'],
  ['Secretaria de Estado da Saude do Parana', 'estadual', 'Curitiba', 'alto'],
  ['Departamento de Estradas de Rodagem do Parana', 'estadual', 'Curitiba', 'alto'],
  ['Companhia de Saneamento do Parana', 'estadual', 'Curitiba', 'medio'],
  ['Universidade Estadual de Londrina', 'estadual', 'Londrina', 'alto'],
  ['Universidade Estadual de Maringa', 'estadual', 'Maringa', 'alto'],
  ['Instituto Federal do Parana', 'federal', 'Curitiba', 'alto'],
  ['Hospital Universitario de Londrina', 'estadual', 'Londrina', 'alto'],
  ['13o Batalhao de Infantaria Blindado', 'federal', 'Ponta Grossa', 'alto'],
  ['Fundo Nacional de Desenvolvimento da Educacao', 'federal', 'Brasilia', 'alto'],
  ['Consorcio Intermunicipal de Saude do Norte do Parana', 'municipal', 'Londrina', 'medio'],
  ['Autarquia Municipal de Saude de Apucarana', 'municipal', 'Apucarana', 'baixo']
];

const OBJETOS_ALIMENTOS = [
  'Registro de precos para aquisicao de generos alimenticios para a merenda escolar',
  'Aquisicao de hortifrutigranjeiros para as unidades de ensino municipais',
  'Registro de precos para fornecimento de carnes e derivados',
  'Aquisicao de paes e produtos de panificacao',
  'Registro de precos para aquisicao de leite e derivados',
  'Fornecimento parcelado de generos alimenticios secos',
  'Aquisicao de cestas basicas para programa de assistencia social',
  'Registro de precos para aquisicao de alimentacao hospitalar',
  'Aquisicao de pescados e ovos para a rede municipal de ensino',
  'Fornecimento de generos alimenticios para o restaurante universitario'
];

const OBJETOS_MAQUINAS = [
  'Aquisicao de trator agricola com implementos',
  'Registro de precos para aquisicao de patrulha mecanizada',
  'Aquisicao de retroescavadeira sobre pneus',
  'Aquisicao de motoniveladora para a secretaria de obras',
  'Registro de precos para aquisicao de implementos agricolas',
  'Aquisicao de caminhao basculante e equipamentos rodoviarios',
  'Aquisicao de rolo compactador vibratorio',
  'Registro de precos para pecas e servicos de manutencao de maquinas',
  'Aquisicao de pa carregadeira',
  'Aquisicao de conjunto de roçadeiras e grades aradoras'
];

const PLATAFORMAS = ['Compras.gov.br', 'BLL Compras', 'Portal de Compras Publicas',
  'Licitanet', 'BNC', 'ComprasBR', 'Bolsa de Licitacoes do Brasil'];

const MOTIVOS_RECUSA = [
  'Marca exigida em edital nao atendida pelo cliente',
  'Prazo de entrega incompativel com a logistica do cliente',
  'Local de entrega fora da area de atuacao',
  'Exigencia de atestado de capacidade tecnica nao atendida',
  'Cliente sem interesse no lote',
  'Certidao pendente na data da sessao',
  'Valor de referencia abaixo do custo do cliente'
];

const CONCORRENTES = [
  'Alimentar Distribuidora Ltda', 'Nutricional Comercio Ltda', 'Supri Sul Ltda',
  'Maxi Alimentos Ltda', 'Comercial Ativa Ltda', 'Rede Forte Distribuidora Ltda',
  'Maquinas Sul Brasil Ltda', 'Equipar Comercio de Maquinas Ltda'
];

function cnpj() {
  let s = '';
  for (let i = 0; i < 8; i++) s += inteiro(0, 9);
  return s.slice(0, 2) + '.' + s.slice(2, 5) + '.' + s.slice(5, 8) + '/0001-' + inteiro(10, 99);
}

const TABELAS = ['comissao_recebimento', 'comissao', 'custo', 'empenho', 'contrato', 'prazo',
  'participacao', 'licitacao', 'documento', 'tipo_documento', 'contato',
  'cliente_segmento', 'cliente', 'segmento', 'orgao', 'log_evento', 'usuario'];

// -----------------------------------------------------------------------------
async function principal() {
  if (config.producao && !process.env.PERMITIR_SEED) {
    throw new Error('Seed bloqueado em producao. Use PERMITIR_SEED=1 se for mesmo isso.');
  }

  const senhaHash = await auth.gerarHash(config.seedSenhaPadrao);

  await db.transacao(async function (c) {
    console.log('[seed] limpando tabelas...');
    await c.query('TRUNCATE ' + TABELAS.join(',') + ' RESTART IDENTITY CASCADE');

    // ---------------------------------------------------------------- usuarios
    const usuarioIds = await inserir(c, 'usuario', ['nome', 'email', 'senha_hash', 'papel'],
      USUARIOS.map(function (u) { return [u[0], u[1], senhaHash, u[2]]; }));
    const operadores = [usuarioIds[2], usuarioIds[3], usuarioIds[4]];
    const financeiro = [usuarioIds[5], usuarioIds[6]];
    console.log('[seed] usuarios: ' + usuarioIds.length);

    // --------------------------------------------------------------- segmentos
    const segmentoIds = await inserir(c, 'segmento', ['nome', 'slug'], SEGMENTOS);
    const SEG_ALIMENTOS = segmentoIds[0];
    const SEG_AGRICOLA = segmentoIds[1];
    const SEG_RODOVIARIO = segmentoIds[2];
    const SEG_PECAS = segmentoIds[3];

    // ------------------------------------------------------------------ orgaos
    const orgaoIds = await inserir(c, 'orgao',
      ['nome', 'esfera', 'uf', 'municipio', 'rigor', 'plataforma_padrao', 'cnpj'],
      ORGAOS.map(function (o) {
        return [o[0], o[1], o[2] === 'Brasilia' ? 'DF' : 'PR', o[2], o[3], escolher(PLATAFORMAS), cnpj()];
      }));
    console.log('[seed] orgaos: ' + orgaoIds.length);

    // ---------------------------------------------------------------- clientes
    const PALAVRAS_ALIMENTOS = ['generos alimenticios', 'merenda escolar', 'hortifruti',
      'carnes', 'panificacao', 'laticinios', 'cesta basica', 'alimentacao'];
    const PALAVRAS_MAQUINAS = ['trator', 'retroescavadeira', 'motoniveladora', 'implementos',
      'patrulha mecanizada', 'rolo compactador', 'pa carregadeira', 'caminhao'];

    const linhasCliente = [];
    const perfil = []; // paralelo a linhasCliente: { segmentos: [], alimentos: bool }

    CLIENTES_ALIMENTOS.forEach(function (cl, i) {
      const status = i % 13 === 12 ? 'inativo' : (i % 7 === 6 ? 'sazonal' : 'ativo');
      linhasCliente.push([
        cl[0], cl[1], cnpj(), cl[2], 'PR',
        [escolher(PALAVRAS_ALIMENTOS), escolher(PALAVRAS_ALIMENTOS), escolher(PALAVRAS_ALIMENTOS)],
        'Entrega em ' + cl[2] + ' e regiao (raio de ' + escolher([80, 120, 150, 200]) + ' km)',
        escolher([3, 3.5, 4, 4.5, 5]), status, escolher(usuarioIds.slice(1, 5)),
        null
      ]);
      perfil.push({ segmentos: [SEG_ALIMENTOS], alimentos: true });
    });

    CLIENTES_MAQUINAS.forEach(function (cl) {
      const seg = cl[3] === 'agricola' ? SEG_AGRICOLA : SEG_RODOVIARIO;
      const segs = chance(40) ? [seg, SEG_PECAS] : [seg];
      linhasCliente.push([
        cl[0], cl[1], cnpj(), cl[2], 'PR',
        [escolher(PALAVRAS_MAQUINAS), escolher(PALAVRAS_MAQUINAS), 'pecas'],
        'Entrega em todo o Parana; frete CIF',
        escolher([1.5, 2, 2.5, 3]), chance(85) ? 'ativo' : 'sazonal',
        escolher(usuarioIds.slice(1, 5)), null
      ]);
      perfil.push({ segmentos: segs, alimentos: false });
    });

    const clienteIds = await inserir(c, 'cliente',
      ['razao_social', 'nome_fantasia', 'cnpj', 'cidade', 'uf', 'palavras_chave',
        'locais_entrega', 'comissao_pct_padrao', 'status', 'responsavel_id', 'obs'],
      linhasCliente);
    console.log('[seed] clientes: ' + clienteIds.length);

    const vinculos = [];
    clienteIds.forEach(function (id, i) {
      perfil[i].segmentos.forEach(function (s) { vinculos.push([id, s]); });
    });
    await c.query(
      'INSERT INTO cliente_segmento (cliente_id, segmento_id) SELECT * FROM unnest($1::bigint[], $2::bigint[])',
      [vinculos.map(function (v) { return v[0]; }), vinculos.map(function (v) { return v[1]; })]
    );

    // ----------------------------------------------------------------- contatos
    const NOMES = ['Ana Paula Ribeiro', 'Carlos Eduardo Lima', 'Fernanda Iwata', 'Joao Pedro Alves',
      'Luciana Bertoldo', 'Rafael Mendes', 'Simone Tavares', 'Thiago Nogueira',
      'Vanessa Cordeiro', 'Wesley Damasceno'];
    const linhasContato = [];
    clienteIds.forEach(function (id, i) {
      linhasContato.push([id, escolher(NOMES), escolher(['Socio', 'Diretor comercial', 'Gerente de vendas']),
        'contato' + (i + 1) + '@exemplo.com.br', '(43) 9' + inteiro(1000, 9999) + '-' + inteiro(1000, 9999), true]);
      if (chance(45)) {
        linhasContato.push([id, escolher(NOMES), 'Financeiro',
          'financeiro' + (i + 1) + '@exemplo.com.br', '(43) 9' + inteiro(1000, 9999) + '-' + inteiro(1000, 9999), false]);
      }
    });
    await inserir(c, 'contato', ['cliente_id', 'nome', 'cargo', 'email', 'telefone', 'principal'], linhasContato);

    // ------------------------------------------------------- tipos de documento
    const tipoDocIds = await inserir(c, 'tipo_documento',
      ['nome', 'slug', 'obrigatorio', 'alerta_dias', 'ordem'], TIPOS_DOCUMENTO);

    // -------------------------------------------------------------- documentos
    // Distribuicao proposital: alguns vencidos e varios na faixa de alerta,
    // para que a tela de certidoes tenha o que mostrar na demo.
    function offsetValidade() {
      const r = rnd() * 100;
      if (r < 5) return inteiro(-45, -1);   // vencido
      if (r < 10) return inteiro(1, 7);     // vence em ate 7 dias
      if (r < 17) return inteiro(8, 15);
      if (r < 30) return inteiro(16, 30);
      if (r < 55) return inteiro(31, 90);
      return inteiro(91, 240);
    }
    const linhasDoc = [];
    clienteIds.forEach(function (idCliente, i) {
      tipoDocIds.forEach(function (idTipo, j) {
        const opcional = !TIPOS_DOCUMENTO[j][2];
        if (opcional && chance(55)) return;              // opcional nem sempre existe
        if (!opcional && chance(4)) return;              // obrigatorio faltando: pendencia real
        const dias = offsetValidade();
        linhasDoc.push([
          idCliente, idTipo,
          String(inteiro(100000, 999999)) + '/' + comOffset(dias).getFullYear(),
          data(dias - escolher([90, 120, 180])), data(dias),
          chance(70) ? 'https://drive.google.com/certidoes/cliente-' + (i + 1) + '/doc-' + (j + 1) : null,
          null, escolher(operadores)
        ]);
      });
    });
    await inserir(c, 'documento',
      ['cliente_id', 'tipo_documento_id', 'numero', 'emissao', 'validade', 'arquivo_url', 'obs', 'criado_por'],
      linhasDoc);
    console.log('[seed] documentos: ' + linhasDoc.length);

    // -------------------------------------------------------------- licitacoes
    const MODALIDADES = ['pregao_eletronico', 'pregao_eletronico', 'pregao_eletronico',
      'pregao_eletronico', 'dispensa', 'concorrencia', 'chamada_publica'];

    const linhasLic = [];
    const contexto = []; // paralelo: { alimentos, dias }
    const TOTAL_EDITAIS = 290;
    for (let i = 0; i < TOTAL_EDITAIS; i++) {
      // 88% no passado (ate 150 dias atras), 12% nas proximas 3 semanas
      const dias = chance(88) ? -inteiro(1, 150) : inteiro(0, 21);
      const alimentos = chance(65);
      const orgao = escolher(orgaoIds);
      const ano = comOffset(dias).getFullYear();
      linhasLic.push([
        orgao,
        String(inteiro(1, 320)).padStart(3, '0') + '/' + ano + '-' + i,
        escolher(MODALIDADES),
        escolher(PLATAFORMAS),
        alimentos ? escolher(OBJETOS_ALIMENTOS) : escolher(OBJETOS_MAQUINAS),
        data(dias - inteiro(12, 25)),
        dataHora(dias, escolher([9, 9, 10, 14])),
        escolher(['30 dias apos empenho', 'Entregas parceladas conforme cronograma',
          '15 dias apos ordem de fornecimento', 'Conforme demanda da secretaria']),
        alimentos ? dinheiro(45000, 1800000) : dinheiro(180000, 4200000),
        'triado', null, escolher(operadores), null
      ]);
      contexto.push({ alimentos: alimentos, dias: dias });
    }
    const licitacaoIds = await inserir(c, 'licitacao',
      ['orgao_id', 'numero_edital', 'modalidade', 'plataforma', 'objeto', 'data_publicacao',
        'data_sessao', 'prazo_entrega', 'valor_estimado', 'status_captacao', 'motivo_descarte',
        'captado_por', 'obs'],
      linhasLic);
    console.log('[seed] licitacoes: ' + licitacaoIds.length);

    // Alguns editais captados que ainda nao viraram participacao (funil de captacao).
    const linhasCaptados = [];
    for (let i = 0; i < 24; i++) {
      const dias = inteiro(1, 25);
      const alimentos = chance(60);
      linhasCaptados.push([
        escolher(orgaoIds),
        'CAP-' + String(inteiro(1, 900)).padStart(3, '0') + '/' + comOffset(dias).getFullYear() + '-' + i,
        escolher(MODALIDADES), escolher(PLATAFORMAS),
        alimentos ? escolher(OBJETOS_ALIMENTOS) : escolher(OBJETOS_MAQUINAS),
        data(dias - inteiro(10, 20)), dataHora(dias, 9),
        'Conforme edital',
        alimentos ? dinheiro(40000, 900000) : dinheiro(150000, 2500000),
        chance(70) ? 'captado' : 'descartado',
        chance(70) ? null : escolher(MOTIVOS_RECUSA),
        escolher(operadores), null
      ]);
    }
    await inserir(c, 'licitacao',
      ['orgao_id', 'numero_edital', 'modalidade', 'plataforma', 'objeto', 'data_publicacao',
        'data_sessao', 'prazo_entrega', 'valor_estimado', 'status_captacao', 'motivo_descarte',
        'captado_por', 'obs'],
      linhasCaptados);

    // Indice de clientes por perfil, para encaixar o edital no cliente certo.
    const clientesAlimentos = clienteIds.filter(function (id, i) { return perfil[i].alimentos; });
    const clientesMaquinas = clienteIds.filter(function (id, i) { return !perfil[i].alimentos; });

    // ------------------------------------------------------------ participacoes
    const linhasPart = [];
    const ctxPart = [];
    licitacaoIds.forEach(function (idLic, i) {
      const ctx = contexto[i];
      const elegiveis = ctx.alimentos ? clientesAlimentos : clientesMaquinas;
      const quantos = chance(15) ? 2 : 1;  // mesmo edital, lotes de clientes diferentes
      const usados = [];
      for (let k = 0; k < quantos; k++) {
        let idCliente = escolher(elegiveis);
        if (usados.indexOf(idCliente) !== -1) continue;
        usados.push(idCliente);

        const futuro = ctx.dias >= 0;
        const estimado = linhasLic[i][8];
        let decisao, fase, precoFinal, valorGanho, vencedor, proximoPrazo;

        if (futuro) {
          decisao = chance(65) ? 'aprovado' : 'pendente';
          fase = decisao === 'aprovado' ? 'aprovado' : 'em_analise';
          precoFinal = null; valorGanho = null; vencedor = null;
          proximoPrazo = linhasLic[i][6];
        } else if (chance(22)) {
          decisao = 'recusado';
          fase = 'recusado';
          precoFinal = null; valorGanho = null; vencedor = null; proximoPrazo = null;
        } else {
          decisao = 'aprovado';
          precoFinal = Math.round(estimado * (0.62 + rnd() * 0.3) * 100) / 100;
          if (chance(28)) {
            valorGanho = precoFinal;
            vencedor = null;
            // trajetoria pos-vitoria proporcional ao tempo decorrido
            const idade = -ctx.dias;
            if (idade > 110) fase = escolher(['encerrado', 'entregue', 'em_execucao']);
            else if (idade > 60) fase = escolher(['em_execucao', 'em_execucao', 'entregue']);
            else if (idade > 25) fase = escolher(['contratado', 'em_execucao']);
            else fase = escolher(['ganho', 'contratado']);
            proximoPrazo = ['em_execucao', 'contratado'].indexOf(fase) !== -1
              ? dataHora(inteiro(2, 40)) : null;
          } else {
            valorGanho = null;
            vencedor = escolher(CONCORRENTES);
            fase = 'perdido';
            proximoPrazo = null;
          }
        }

        linhasPart.push([
          idLic, idCliente, decisao,
          decisao === 'recusado' ? escolher(MOTIVOS_RECUSA) : null,
          usuarioIds[0], fase, precoFinal, valorGanho, vencedor, proximoPrazo,
          escolher(operadores), null
        ]);
        ctxPart.push({ dias: ctx.dias, licitacao: idLic, cliente: idCliente, fase: fase, valor: valorGanho });
      }
    });

    const participacaoIds = await inserir(c, 'participacao',
      ['licitacao_id', 'cliente_id', 'decisao', 'motivo_decisao', 'decidido_por', 'fase',
        'preco_final', 'valor_ganho', 'concorrente_vencedor', 'proximo_prazo', 'responsavel_id', 'obs'],
      linhasPart);
    console.log('[seed] participacoes: ' + participacaoIds.length);

    // ----------------------------------------------------------------- contratos
    const comissaoPorCliente = {};
    clienteIds.forEach(function (id, i) { comissaoPorCliente[id] = linhasCliente[i][7]; });

    const orgaoPorLicitacao = {};
    licitacaoIds.forEach(function (id, i) { orgaoPorLicitacao[id] = linhasLic[i][0]; });

    const FASES_CONTRATADAS = ['contratado', 'em_execucao', 'entregue', 'encerrado'];
    const linhasContrato = [];
    const ctxContrato = [];
    participacaoIds.forEach(function (idPart, i) {
      const ctx = ctxPart[i];
      if (FASES_CONTRATADAS.indexOf(ctx.fase) === -1) return;

      const ata = chance(60);
      const inicio = ctx.dias + inteiro(8, 25);
      const meses = ata ? 12 : escolher([6, 9, 12]);
      const total = Math.round(ctx.valor * (ata ? 1 : 1) * 100) / 100;
      linhasContrato.push([
        idPart, ctx.cliente, orgaoPorLicitacao[ctx.licitacao],
        ata ? 'ata_registro_preco' : 'contrato',
        (ata ? 'ARP ' : 'CT ') + String(inteiro(1, 400)).padStart(3, '0') + '/' + comOffset(inicio).getFullYear(),
        data(inicio), data(inicio + meses * 30), total, total,
        comissaoPorCliente[ctx.cliente],
        ctx.fase === 'encerrado' ? 'encerrado' : 'vigente', null
      ]);
      ctxContrato.push({ inicio: inicio, total: total, cliente: ctx.cliente,
        pct: comissaoPorCliente[ctx.cliente], fase: ctx.fase, ata: ata });
    });

    const contratoIds = await inserir(c, 'contrato',
      ['participacao_id', 'cliente_id', 'orgao_id', 'tipo', 'numero', 'vigencia_inicio',
        'vigencia_fim', 'valor_total', 'saldo', 'comissao_pct', 'status', 'obs'],
      linhasContrato);
    console.log('[seed] contratos/atas: ' + contratoIds.length);

    // ------------------------------------------------------------------ empenhos
    const linhasEmpenho = [];
    const ctxEmpenho = [];
    contratoIds.forEach(function (idContrato, i) {
      const ctx = ctxContrato[i];
      // Ata consome o saldo aos poucos; contrato costuma empenhar de uma vez.
      const quantos = ctx.ata ? inteiro(2, 6) : inteiro(1, 2);
      const fatiaMax = ctx.total / quantos;
      for (let k = 0; k < quantos; k++) {
        const diasEmpenho = ctx.inicio + k * inteiro(20, 45);
        if (diasEmpenho > 5) break;                       // ainda nao aconteceu
        const valor = Math.round(fatiaMax * (0.55 + rnd() * 0.45) * 100) / 100;
        const idade = -diasEmpenho;
        let status;
        if (idade > 75) status = 'faturado';
        else if (idade > 45) status = escolher(['faturado', 'entregue']);
        else if (idade > 20) status = escolher(['entregue', 'em_entrega']);
        else status = escolher(['recebido', 'agendado', 'em_entrega']);

        linhasEmpenho.push([
          idContrato, String(inteiro(2026001, 2026999)) + 'NE' + String(inteiro(1, 999)).padStart(3, '0'),
          data(diasEmpenho), valor, data(diasEmpenho + inteiro(15, 45)), status,
          status === 'faturado' ? String(inteiro(10000, 99999)) : null,
          status === 'faturado' ? data(diasEmpenho + inteiro(20, 50)) : null,
          null
        ]);
        ctxEmpenho.push({ contrato: idContrato, cliente: ctx.cliente, pct: ctx.pct,
          valor: valor, status: status, dias: diasEmpenho });
      }
    });

    const empenhoIds = await inserir(c, 'empenho',
      ['contrato_id', 'numero', 'data', 'valor', 'prazo_entrega', 'status', 'nota_fiscal',
        'data_faturamento', 'obs'],
      linhasEmpenho);
    console.log('[seed] empenhos: ' + empenhoIds.length);

    // ------------------------------------------------------------------ comissoes
    // Regra do negocio: a comissao nasce do empenho (venda efetiva), nao do contrato.
    const linhasComissao = [];
    const ctxComissao = [];
    empenhoIds.forEach(function (idEmpenho, i) {
      const ctx = ctxEmpenho[i];
      const valor = Math.round(ctx.valor * ctx.pct / 100 * 100) / 100;
      let status;
      if (ctx.status === 'faturado') status = chance(68) ? 'recebida' : (chance(60) ? 'a_receber' : 'em_cobranca');
      else if (ctx.status === 'entregue') status = 'a_receber';
      else status = 'projetada';

      const prevista = data(ctx.dias + inteiro(35, 75));
      linhasComissao.push([
        ctx.contrato, idEmpenho, ctx.cliente, 'empenho', ctx.valor, ctx.pct, valor, status, prevista, null
      ]);
      ctxComissao.push({ status: status, valor: valor, prevista: ctx.dias + inteiro(35, 75) });
    });

    const comissaoIds = await inserir(c, 'comissao',
      ['contrato_id', 'empenho_id', 'cliente_id', 'tipo_base', 'base', 'pct', 'valor',
        'status', 'data_prevista', 'obs'],
      linhasComissao);
    console.log('[seed] comissoes: ' + comissaoIds.length);

    // -------------------------------------------------------------- recebimentos
    const linhasReceb = [];
    comissaoIds.forEach(function (idComissao, i) {
      const ctx = ctxComissao[i];
      if (ctx.status !== 'recebida') return;
      const diaPagamento = Math.min(ctx.prevista + inteiro(-5, 12), -1);
      if (chance(20)) {
        const metade = Math.round(ctx.valor / 2 * 100) / 100;
        linhasReceb.push([idComissao, data(diaPagamento - 25), metade, 'PIX', 'Primeira parcela']);
        linhasReceb.push([idComissao, data(diaPagamento), Math.round((ctx.valor - metade) * 100) / 100,
          'PIX', 'Segunda parcela']);
      } else {
        linhasReceb.push([idComissao, data(diaPagamento), ctx.valor, escolher(['PIX', 'TED', 'Boleto']), null]);
      }
    });
    await inserir(c, 'comissao_recebimento', ['comissao_id', 'data', 'valor', 'forma', 'obs'], linhasReceb);
    console.log('[seed] recebimentos: ' + linhasReceb.length);

    // -------------------------------------------------------------------- prazos
    const linhasPrazo = [];
    participacaoIds.forEach(function (idPart, i) {
      const ctx = ctxPart[i];
      if (ctx.dias >= -3 && ctx.fase !== 'recusado') {
        linhasPrazo.push(['sessao', 'Sessao de disputa', idPart, ctx.licitacao, null, null,
          linhasPart[i][9] || dataHora(Math.max(ctx.dias, 1), 9), escolher(operadores), 'aberto', null]);
      }
      if (ctx.fase === 'ganho' || ctx.fase === 'contratado') {
        if (chance(60)) {
          linhasPrazo.push(['envio_docs', 'Envio de documentacao de habilitacao', idPart, null, null, null,
            dataHora(inteiro(1, 12), 17), escolher(operadores), 'aberto', null]);
        }
        if (chance(35)) {
          linhasPrazo.push(['convocacao', 'Convocacao para assinatura', idPart, null, null, null,
            dataHora(inteiro(2, 20), 14), escolher(operadores), 'aberto', null]);
        }
      }
      if (ctx.fase === 'perdido' && chance(12)) {
        linhasPrazo.push(['recurso', 'Prazo recursal', idPart, null, null, null,
          dataHora(inteiro(1, 5), 18), usuarioIds[0], 'aberto', null]);
      }
      if (ctx.fase === 'em_execucao' && chance(25)) {
        linhasPrazo.push(['entrega', 'Entrega de empenho', idPart, null, null, null,
          dataHora(inteiro(1, 30), 12), escolher(operadores), 'aberto', null]);
      }
    });

    // Prazos futuros para impugnacao dos editais ainda em analise.
    licitacaoIds.forEach(function (idLic, i) {
      if (contexto[i].dias > 3 && chance(12)) {
        linhasPrazo.push(['impugnacao', 'Prazo para impugnacao do edital', null, idLic, null, null,
          dataHora(Math.max(contexto[i].dias - 3, 1), 18), usuarioIds[0], 'aberto', null]);
      }
    });

    await inserir(c, 'prazo',
      ['tipo', 'titulo', 'participacao_id', 'licitacao_id', 'contrato_id', 'documento_id',
        'data_hora', 'responsavel_id', 'status', 'obs'],
      linhasPrazo);
    console.log('[seed] prazos: ' + linhasPrazo.length);

    // --------------------------------------------------------------------- custos
    // Poucos, e de proposito: a tabela existe, mas "resultado" so vira metrica na v0.2.
    const linhasCusto = [];
    contratoIds.forEach(function (idContrato, i) {
      if (!chance(25)) return;
      linhasCusto.push([idContrato, null, escolher(['juridico', 'plataforma', 'documentacao']),
        'Custo direto do contrato', dinheiro(180, 3200), data(ctxContrato[i].inicio + inteiro(5, 40))]);
    });
    await inserir(c, 'custo',
      ['contrato_id', 'participacao_id', 'tipo', 'descricao', 'valor', 'data'], linhasCusto);

    console.log('[seed] concluido.');
  });

  // Confere o que a demo vai mostrar.
  const resumo = await db.um(
    `SELECT (SELECT count(*) FROM cliente)                                      AS clientes,
            (SELECT count(*) FROM participacao)                                 AS participacoes,
            (SELECT count(*) FROM vw_participacao WHERE venceu)                 AS ganhas,
            (SELECT count(*) FROM vw_documento_status WHERE situacao = 'vencido')  AS certidoes_vencidas,
            (SELECT count(*) FROM vw_documento_status WHERE situacao = 'a_vencer') AS certidoes_a_vencer,
            (SELECT COALESCE(sum(valor_aberto),0) FROM vw_comissao
              WHERE status IN ('a_receber','em_cobranca'))                      AS comissao_a_receber`
  );
  console.log('[seed] resumo:', resumo);
  console.log('[seed] login de demo: ' + USUARIOS[0][1] + ' / ' + config.seedSenhaPadrao);
}

principal()
  .then(function () { return db.pool.end(); })
  .catch(function (erro) {
    console.error('[seed] falhou:', erro.message);
    db.pool.end().finally(function () { process.exit(1); });
  });
