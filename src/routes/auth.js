'use strict';

const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

// Trava simples de forca bruta: 8 tentativas por email a cada 10 minutos.
const tentativas = new Map();
const LIMITE = 8;
const JANELA_MS = 10 * 60 * 1000;

function podeTentar(chave) {
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.desde > JANELA_MS) {
    tentativas.set(chave, { desde: agora, contador: 0 });
    return true;
  }
  return registro.contador < LIMITE;
}

function registrarFalha(chave) {
  const registro = tentativas.get(chave);
  if (registro) {
    registro.contador += 1;
  }
}

router.post('/login', async function (req, res, proximo) {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const senha = String((req.body && req.body.senha) || '');

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    }
    if (!podeTentar(email)) {
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    }

    const usuario = await db.um(
      'SELECT id, nome, email, senha_hash, papel, ativo FROM usuario WHERE lower(email) = $1',
      [email]
    );

    if (!usuario || !usuario.ativo || !(await auth.conferirSenha(senha, usuario.senha_hash))) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'E-mail ou senha invalidos.' });
    }

    tentativas.delete(email);
    auth.definirCookie(res, auth.gerarToken(usuario));

    await db.query(
      "INSERT INTO log_evento (usuario_id, entidade, entidade_id, acao) VALUES ($1, 'usuario', $1, 'login')",
      [usuario.id]
    );

    return res.json({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel }
    });
  } catch (erro) {
    return proximo(erro);
  }
});

router.post('/logout', function (req, res) {
  auth.limparCookie(res);
  return res.json({ ok: true });
});

router.get('/eu', auth.autenticar, function (req, res) {
  return res.json({
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      email: req.usuario.email,
      papel: req.usuario.papel
    }
  });
});

module.exports = router;
