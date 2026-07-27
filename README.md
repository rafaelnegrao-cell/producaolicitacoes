# Produção — Assessoria em Licitações

Sistema interno de gestão para a **Produção Assessoria em Licitações** (Londrina/PR):
carteira de clientes, controle de certidões com alerta de vencimento, pipeline com
**todas** as participações, contratos/atas, empenhos, comissões e dashboard analítico.

Projeto da consultoria **RN Negrão**.

---

## Stack

| Camada   | Escolha |
|----------|---------|
| Backend  | Node.js + Express + PostgreSQL (driver `pg`, SQL direto, sem ORM) |
| Frontend | React 18 via CDN, `React.createElement` — **sem build step, sem JSX** |
| Auth     | usuário/senha (bcrypt) + JWT em cookie `httpOnly`; papéis admin/operador/comercial/financeiro |
| PWA      | `manifest.json` + service worker (assets em cache, API sempre na rede) |
| Deploy   | Railway + plugin PostgreSQL, build automático a cada push no `main` |

Não há módulo de cotação/fornecedor nem busca de editais — a captação continua
no Effecti/PNCP, por decisão de escopo.

---

## Rodando local

Pré-requisitos: Node.js 20+ e um PostgreSQL 14+ acessível.

```bash
npm install
cp .env.example .env      # ajuste DATABASE_URL e JWT_SECRET
npm run migrate           # aplica db/schema.sql (idempotente)
npm run seed              # popula com os dados fictícios da demo
npm start
```

Aplicação em `http://localhost:3000`.
Login da demo: **bruno@producaolicitacoes.com.br** / senha de `SEED_SENHA_PADRAO`
(padrão `producao123`).

Outros comandos:

```bash
npm run check             # node --check em todos os .js
npm run reset             # derruba o schema, recria e popula de novo
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | sim | String de conexão do PostgreSQL |
| `JWT_SECRET` | sim em produção | Segredo de assinatura da sessão |
| `PORT` | não | Porta HTTP (Railway injeta) |
| `NODE_ENV` | não | `development` ou `production` |
| `PGSSL` | não | `true` para forçar SSL (conexão externa ao Railway) |
| `JWT_EXPIRA_EM` | não | Validade do token (padrão `12h`) |
| `APP_VERSION` | não | Versão dos assets — **suba a cada deploy** para bust de cache |
| `SEED_SENHA_PADRAO` | não | Senha dos usuários criados pelo seed |

Gere o segredo com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Deploy no Railway

1. **New Project → Deploy from GitHub repo** e selecione `producaolicitacoes`.
2. **New → Database → PostgreSQL** dentro do mesmo projeto.
3. No serviço da aplicação, aba **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao plugin)
   - `JWT_SECRET` = valor gerado acima
   - `NODE_ENV` = `production`
   - `APP_VERSION` = `0.1.0`
4. Railway detecta o Node pelo `package.json` e sobe com `npm start`. Não é
   preciso Procfile nem Dockerfile.
5. **Primeiro deploy**, prepare o banco a partir da sua máquina apontando para o
   banco do Railway (use a `DATABASE_URL` pública, com `PGSSL=true`):

   ```bash
   npm run migrate
   npm run seed
   ```

6. Todo push no `main` dispara novo deploy. Suba `APP_VERSION` junto para que os
   assets do PWA sejam recarregados nos celulares da equipe.

Health check: `GET /api/saude` responde `{ ok, versao, banco }`.

---

## Estrutura

```
db/
  schema.sql        DDL idempotente + views derivadas + triggers
  seed.js           dados fictícios determinísticos para a demo
src/
  config.js         variáveis de ambiente
  db.js             pool pg + helpers (todos/um/transacao)
  auth.js           hash, JWT, middlewares de autenticação e papel
  migrate.js        aplica o schema
  server.js         Express, estáticos versionados, rotas
  routes/           auth, meta, dashboard
public/
  index.html        shell (APP_VERSION injetado pelo servidor)
  css/app.css       identidade RN + acento #6BAF3D
  js/               api, ui, router, app e telas
  manifest.json     sw.js
tools/check.js      node --check em todo o projeto
```

### Decisões de modelagem que valem lembrar

- **`licitacao` × `participacao`.** A licitação é o edital do órgão; a participação
  é o cliente naquele edital. Permite edital captado sem cliente, dois clientes no
  mesmo pregão e — principalmente — taxa de vitória com o denominador certo.
- **Comissão nasce do empenho.** A remuneração é % sobre venda efetiva, e a venda
  se realiza nos empenhos ao longo do ano. Comissão de base `contrato` existe, mas
  entra como `projetada` e fica fora do "a receber".
- **Status de certidão é view, não coluna.** `vw_documento_status` deriva
  `vigente | a_vencer | vencido` da validade e do `alerta_dias` do tipo.
- **Saldo de ata é derivado** dos empenhos por trigger (nível de contrato na v0.1;
  por item fica para a v0.2).

---

## Roteiro

- **v0.1** — clientes, certidões com alerta, pipeline com todas as participações,
  empenhos (mínimo), comissões a receber, dashboard.
- **v0.2** — contratos/atas completos, saldo por item, prazos legais/agenda, custos
  e resultado por contrato.
- **v0.3** — relatórios por cliente/segmento/órgão, exportação PDF/Excel, notificações.
