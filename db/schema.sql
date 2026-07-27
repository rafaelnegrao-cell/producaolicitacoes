-- =============================================================================
-- Producao Assessoria em Licitacoes — schema v0.1
-- Idempotente: pode ser executado repetidas vezes sem efeito colateral.
-- Convencoes:
--   * dinheiro em numeric(14,2), percentual em numeric(6,3)
--   * enums via CHECK constraint (nao usamos tipos ENUM do PG: dificultam ALTER)
--   * status derivado (certidao vigente/a_vencer/vencido) e VIEW, nunca coluna
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcao de apoio: atualiza o carimbo de atualizacao em todo UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- NUCLEO
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuario (
  id            bigserial PRIMARY KEY,
  nome          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  senha_hash    text        NOT NULL,
  papel         text        NOT NULL DEFAULT 'operador'
                            CHECK (papel IN ('admin','operador','comercial','financeiro')),
  ativo         boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segmento (
  id    bigserial PRIMARY KEY,
  nome  text NOT NULL,
  slug  text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS cliente (
  id                  bigserial PRIMARY KEY,
  razao_social        text        NOT NULL,
  nome_fantasia       text,
  cnpj                text        UNIQUE,
  cidade              text,
  uf                  char(2),
  palavras_chave      text[]      NOT NULL DEFAULT '{}',
  locais_entrega      text,
  comissao_pct_padrao numeric(6,3) NOT NULL DEFAULT 0 CHECK (comissao_pct_padrao >= 0),
  status              text        NOT NULL DEFAULT 'ativo'
                                  CHECK (status IN ('ativo','sazonal','inativo')),
  responsavel_id      bigint      REFERENCES usuario(id) ON DELETE SET NULL,
  obs                 text,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cliente_status ON cliente (status);

CREATE TABLE IF NOT EXISTS cliente_segmento (
  cliente_id  bigint NOT NULL REFERENCES cliente(id)  ON DELETE CASCADE,
  segmento_id bigint NOT NULL REFERENCES segmento(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, segmento_id)
);

CREATE TABLE IF NOT EXISTS contato (
  id         bigserial PRIMARY KEY,
  cliente_id bigint  NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  nome       text    NOT NULL,
  cargo      text,
  email      text,
  telefone   text,
  principal  boolean NOT NULL DEFAULT false,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_contato_cliente ON contato (cliente_id);

CREATE TABLE IF NOT EXISTS orgao (
  id                bigserial PRIMARY KEY,
  nome              text NOT NULL,
  cnpj              text,
  esfera            text CHECK (esfera IN ('federal','estadual','municipal')),
  uf                char(2),
  municipio         text,
  rigor             text NOT NULL DEFAULT 'medio' CHECK (rigor IN ('baixo','medio','alto')),
  plataforma_padrao text,
  obs               text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_orgao_uf ON orgao (uf);


-- =============================================================================
-- DOCUMENTOS / CERTIDOES
-- =============================================================================

CREATE TABLE IF NOT EXISTS tipo_documento (
  id          bigserial PRIMARY KEY,
  nome        text    NOT NULL,
  slug        text    NOT NULL UNIQUE,
  escopo      text    NOT NULL DEFAULT 'cliente' CHECK (escopo IN ('cliente','licitacao')),
  obrigatorio boolean NOT NULL DEFAULT true,
  alerta_dias integer NOT NULL DEFAULT 30 CHECK (alerta_dias > 0),
  ordem       integer NOT NULL DEFAULT 100,
  ativo       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS documento (
  id                bigserial PRIMARY KEY,
  cliente_id        bigint NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  tipo_documento_id bigint NOT NULL REFERENCES tipo_documento(id),
  numero            text,
  emissao           date,
  validade          date,
  arquivo_url       text,
  obs               text,
  criado_por        bigint REFERENCES usuario(id) ON DELETE SET NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_documento_cliente  ON documento (cliente_id);
CREATE INDEX IF NOT EXISTS ix_documento_validade ON documento (validade);


-- =============================================================================
-- PIPELINE — licitacao (o edital, do orgao) x participacao (o cliente na disputa)
-- =============================================================================

CREATE TABLE IF NOT EXISTS licitacao (
  id               bigserial PRIMARY KEY,
  orgao_id         bigint NOT NULL REFERENCES orgao(id),
  numero_edital    text   NOT NULL,
  modalidade       text   CHECK (modalidade IN ('pregao_eletronico','pregao_presencial',
                                                'concorrencia','dispensa','inexigibilidade',
                                                'credenciamento','chamada_publica','outro')),
  plataforma       text,
  objeto           text,
  data_publicacao  date,
  data_sessao      timestamptz,
  prazo_entrega    text,
  valor_estimado   numeric(14,2),
  status_captacao  text NOT NULL DEFAULT 'captado'
                        CHECK (status_captacao IN ('captado','triado','descartado')),
  motivo_descarte  text,
  captado_por      bigint REFERENCES usuario(id) ON DELETE SET NULL,
  obs              text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_licitacao_orgao_edital ON licitacao (orgao_id, numero_edital);
CREATE INDEX IF NOT EXISTS ix_licitacao_sessao ON licitacao (data_sessao);

CREATE TABLE IF NOT EXISTS participacao (
  id                    bigserial PRIMARY KEY,
  licitacao_id          bigint NOT NULL REFERENCES licitacao(id) ON DELETE CASCADE,
  cliente_id            bigint NOT NULL REFERENCES cliente(id),
  decisao               text NOT NULL DEFAULT 'pendente'
                             CHECK (decisao IN ('pendente','aprovado','recusado')),
  motivo_decisao        text,
  decidido_por          bigint REFERENCES usuario(id) ON DELETE SET NULL,
  fase                  text NOT NULL DEFAULT 'em_analise'
                             CHECK (fase IN ('em_analise','aprovado','recusado','disputado',
                                             'ganho','perdido','contratado','em_execucao',
                                             'entregue','encerrado')),
  preco_final           numeric(14,2),
  valor_ganho           numeric(14,2),
  concorrente_vencedor  text,
  proximo_prazo         timestamptz,
  responsavel_id        bigint REFERENCES usuario(id) ON DELETE SET NULL,
  obs                   text,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_participacao_licitacao_cliente UNIQUE (licitacao_id, cliente_id)
);
CREATE INDEX IF NOT EXISTS ix_participacao_cliente ON participacao (cliente_id);
CREATE INDEX IF NOT EXISTS ix_participacao_fase    ON participacao (fase);
CREATE INDEX IF NOT EXISTS ix_participacao_prazo   ON participacao (proximo_prazo);


-- =============================================================================
-- CONTRATOS / ATAS E EXECUCAO
-- =============================================================================

CREATE TABLE IF NOT EXISTS contrato (
  id              bigserial PRIMARY KEY,
  participacao_id bigint REFERENCES participacao(id) ON DELETE SET NULL,
  cliente_id      bigint NOT NULL REFERENCES cliente(id),
  orgao_id        bigint NOT NULL REFERENCES orgao(id),
  tipo            text NOT NULL DEFAULT 'contrato'
                       CHECK (tipo IN ('contrato','ata_registro_preco')),
  numero          text NOT NULL,
  vigencia_inicio date,
  vigencia_fim    date,
  valor_total     numeric(14,2) NOT NULL DEFAULT 0,
  saldo           numeric(14,2) NOT NULL DEFAULT 0,
  comissao_pct    numeric(6,3)  NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'vigente'
                       CHECK (status IN ('vigente','suspenso','encerrado','cancelado')),
  obs             text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_contrato_cliente  ON contrato (cliente_id);
CREATE INDEX IF NOT EXISTS ix_contrato_vigencia ON contrato (vigencia_fim);

CREATE TABLE IF NOT EXISTS empenho (
  id              bigserial PRIMARY KEY,
  contrato_id     bigint NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  numero          text NOT NULL,
  data            date,
  valor           numeric(14,2) NOT NULL DEFAULT 0,
  prazo_entrega   date,
  status          text NOT NULL DEFAULT 'recebido'
                       CHECK (status IN ('recebido','agendado','em_entrega','entregue',
                                         'faturado','cancelado')),
  nota_fiscal     text,
  data_faturamento date,
  obs             text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_empenho_contrato ON empenho (contrato_id);
CREATE INDEX IF NOT EXISTS ix_empenho_status   ON empenho (status);

-- Saldo da ata/contrato e sempre derivado dos empenhos nao cancelados.
CREATE OR REPLACE FUNCTION fn_recalcular_saldo_contrato() RETURNS trigger AS $$
DECLARE
  v_contrato_id bigint;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);
  UPDATE contrato c
     SET saldo = GREATEST(c.valor_total - COALESCE((
           SELECT sum(e.valor) FROM empenho e
            WHERE e.contrato_id = c.id AND e.status <> 'cancelado'
         ), 0), 0),
         atualizado_em = now()
   WHERE c.id = v_contrato_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_empenho_saldo ON empenho;
CREATE TRIGGER tg_empenho_saldo
  AFTER INSERT OR UPDATE OF valor, status, contrato_id OR DELETE ON empenho
  FOR EACH ROW EXECUTE FUNCTION fn_recalcular_saldo_contrato();


-- =============================================================================
-- FINANCEIRO
-- =============================================================================

CREATE TABLE IF NOT EXISTS comissao (
  id            bigserial PRIMARY KEY,
  contrato_id   bigint NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
  empenho_id    bigint REFERENCES empenho(id) ON DELETE CASCADE,
  cliente_id    bigint NOT NULL REFERENCES cliente(id),
  tipo_base     text NOT NULL DEFAULT 'empenho' CHECK (tipo_base IN ('contrato','empenho')),
  base          numeric(14,2) NOT NULL DEFAULT 0,
  pct           numeric(6,3)  NOT NULL DEFAULT 0,
  valor         numeric(14,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'a_receber'
                     CHECK (status IN ('projetada','a_receber','em_cobranca','recebida','cancelada')),
  data_prevista date,
  obs           text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  -- comissao de base 'empenho' exige o empenho de origem
  CONSTRAINT ck_comissao_base CHECK (tipo_base <> 'empenho' OR empenho_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_comissao_status  ON comissao (status);
CREATE INDEX IF NOT EXISTS ix_comissao_cliente ON comissao (cliente_id);
CREATE INDEX IF NOT EXISTS ix_comissao_prevista ON comissao (data_prevista);
CREATE UNIQUE INDEX IF NOT EXISTS ux_comissao_empenho ON comissao (empenho_id) WHERE empenho_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS comissao_recebimento (
  id          bigserial PRIMARY KEY,
  comissao_id bigint NOT NULL REFERENCES comissao(id) ON DELETE CASCADE,
  data        date   NOT NULL,
  valor       numeric(14,2) NOT NULL CHECK (valor > 0),
  forma       text,
  obs         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_comissao_receb_comissao ON comissao_recebimento (comissao_id);

-- Opcional: custos diretos. Alimenta "resultado por contrato" a partir da v0.2.
CREATE TABLE IF NOT EXISTS custo (
  id              bigserial PRIMARY KEY,
  contrato_id     bigint REFERENCES contrato(id) ON DELETE CASCADE,
  participacao_id bigint REFERENCES participacao(id) ON DELETE CASCADE,
  tipo            text CHECK (tipo IN ('juridico','plataforma','garantia','deslocamento',
                                       'documentacao','outro')),
  descricao       text,
  valor           numeric(14,2) NOT NULL DEFAULT 0,
  data            date,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_custo_origem CHECK (contrato_id IS NOT NULL OR participacao_id IS NOT NULL)
);


-- =============================================================================
-- AGENDA UNIFICADA
-- =============================================================================

CREATE TABLE IF NOT EXISTS prazo (
  id              bigserial PRIMARY KEY,
  tipo            text NOT NULL CHECK (tipo IN ('impugnacao','esclarecimento','recurso',
                                                'contrarrazao','envio_docs','convocacao',
                                                'sessao','entrega','renovacao_certidao','outro')),
  titulo          text,
  participacao_id bigint REFERENCES participacao(id) ON DELETE CASCADE,
  licitacao_id    bigint REFERENCES licitacao(id)    ON DELETE CASCADE,
  contrato_id     bigint REFERENCES contrato(id)     ON DELETE CASCADE,
  documento_id    bigint REFERENCES documento(id)    ON DELETE CASCADE,
  data_hora       timestamptz NOT NULL,
  responsavel_id  bigint REFERENCES usuario(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','concluido','perdido')),
  obs             text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_prazo_data   ON prazo (data_hora);
CREATE INDEX IF NOT EXISTS ix_prazo_status ON prazo (status);


-- =============================================================================
-- AUDITORIA
-- =============================================================================

CREATE TABLE IF NOT EXISTS log_evento (
  id          bigserial PRIMARY KEY,
  usuario_id  bigint REFERENCES usuario(id) ON DELETE SET NULL,
  entidade    text NOT NULL,
  entidade_id bigint,
  acao        text NOT NULL,
  dados       jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_log_entidade ON log_evento (entidade, entidade_id);


-- =============================================================================
-- TRIGGERS DE atualizado_em
-- =============================================================================
DO $$
DECLARE
  t text;
  alvos text[] := ARRAY['usuario','cliente','orgao','documento','licitacao','participacao',
                        'contrato','empenho','comissao','prazo'];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_%1$s_atualizado_em ON %1$I', t);
    EXECUTE format('CREATE TRIGGER tg_%1$s_atualizado_em BEFORE UPDATE ON %1$I
                    FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em()', t);
  END LOOP;
END $$;


-- =============================================================================
-- VIEWS DERIVADAS
-- =============================================================================

-- Situacao de cada documento (o mais recente por cliente + tipo).
CREATE OR REPLACE VIEW vw_documento_status AS
WITH ultimo AS (
  SELECT DISTINCT ON (d.cliente_id, d.tipo_documento_id)
         d.*
    FROM documento d
   ORDER BY d.cliente_id, d.tipo_documento_id, d.validade DESC NULLS LAST, d.id DESC
)
SELECT u.id,
       u.cliente_id,
       c.razao_social,
       c.nome_fantasia,
       c.status AS cliente_status,
       u.tipo_documento_id,
       td.nome  AS tipo_nome,
       td.slug  AS tipo_slug,
       td.obrigatorio,
       td.alerta_dias,
       u.numero,
       u.emissao,
       u.validade,
       u.arquivo_url,
       (u.validade - CURRENT_DATE) AS dias_para_vencer,
       CASE
         WHEN u.validade IS NULL                                THEN 'sem_validade'
         WHEN u.validade <  CURRENT_DATE                        THEN 'vencido'
         WHEN u.validade <= CURRENT_DATE + td.alerta_dias       THEN 'a_vencer'
         ELSE 'vigente'
       END AS situacao
  FROM ultimo u
  JOIN cliente c        ON c.id  = u.cliente_id
  JOIN tipo_documento td ON td.id = u.tipo_documento_id;

-- Participacoes com o contexto que a tela de pipeline precisa.
CREATE OR REPLACE VIEW vw_participacao AS
SELECT p.id,
       p.licitacao_id,
       p.cliente_id,
       cl.razao_social,
       cl.nome_fantasia,
       p.decisao,
       p.fase,
       p.preco_final,
       p.valor_ganho,
       p.proximo_prazo,
       p.responsavel_id,
       l.numero_edital,
       l.modalidade,
       l.plataforma,
       l.objeto,
       l.data_sessao,
       l.valor_estimado,
       o.id   AS orgao_id,
       o.nome AS orgao_nome,
       o.esfera,
       o.uf,
       (p.fase IN ('ganho','contratado','em_execucao','entregue','encerrado')) AS venceu,
       (p.fase IN ('disputado','ganho','perdido','contratado','em_execucao','entregue','encerrado'))
         AS disputou
  FROM participacao p
  JOIN licitacao l ON l.id = p.licitacao_id
  JOIN orgao     o ON o.id = l.orgao_id
  JOIN cliente  cl ON cl.id = p.cliente_id;

-- Comissao com o quanto ja foi efetivamente recebido.
CREATE OR REPLACE VIEW vw_comissao AS
SELECT co.id,
       co.contrato_id,
       co.empenho_id,
       co.cliente_id,
       cl.razao_social,
       cl.nome_fantasia,
       ct.numero AS contrato_numero,
       ct.tipo   AS contrato_tipo,
       o.nome    AS orgao_nome,
       co.tipo_base,
       co.base,
       co.pct,
       co.valor,
       co.status,
       co.data_prevista,
       COALESCE(r.recebido, 0)             AS valor_recebido,
       co.valor - COALESCE(r.recebido, 0)  AS valor_aberto,
       (co.status IN ('a_receber','em_cobranca') AND co.data_prevista < CURRENT_DATE) AS atrasada
  FROM comissao co
  JOIN cliente  cl ON cl.id = co.cliente_id
  JOIN contrato ct ON ct.id = co.contrato_id
  JOIN orgao     o ON o.id  = ct.orgao_id
  LEFT JOIN (
       SELECT comissao_id, sum(valor) AS recebido
         FROM comissao_recebimento
        GROUP BY comissao_id
  ) r ON r.comissao_id = co.id;
