'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');

const COOKIE = 'pl_sessao';

function gerarHash(senha) {
  return bcrypt.hash(senha, 10);
}

function conferirSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    config.jwtSecret,
    { expiresIn: config.jwtExpiraEm }
  );
}

function definirCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.producao,
    maxAge: 12 * 60 * 60 * 1000
  });
}

function limparCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.producao });
}

// Le o token do cookie (ou do header Authorization) e popula req.usuario.
function autenticar(req, res, proximo) {
  let token = req.cookies && req.cookies[COOKIE];
  const header = req.get('authorization');
  if (!token && header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  }
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado.' });
  }
  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    return proximo();
  } catch (erro) {
    limparCookie(res);
    return res.status(401).json({ erro: 'Sessao expirada. Entre novamente.' });
  }
}

// Restringe a rota a determinados papeis. Admin passa sempre.
function exigirPapel() {
  const papeis = Array.prototype.slice.call(arguments);
  return function (req, res, proximo) {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Nao autenticado.' });
    }
    if (req.usuario.papel === 'admin' || papeis.indexOf(req.usuario.papel) !== -1) {
      return proximo();
    }
    return res.status(403).json({ erro: 'Seu perfil nao tem acesso a esta area.' });
  };
}

module.exports = {
  COOKIE,
  gerarHash,
  conferirSenha,
  gerarToken,
  definirCookie,
  limparCookie,
  autenticar,
  exigirPapel
};
