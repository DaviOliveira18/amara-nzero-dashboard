-- ═══════════════════════════════════════════════════════════════════════
-- AMARA NZERO DASHBOARD — Supabase Schema
-- Cole este SQL no Supabase > SQL Editor > New Query > Run
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Tabela principal de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id          TEXT        PRIMARY KEY,       -- NZ2026MMMA_001.234
  cliente     TEXT,
  vendedor    TEXT,
  valor       INTEGER     NOT NULL DEFAULT 0, -- centavos (×100)
  status      TEXT,
  kwp         INTEGER     DEFAULT 0,          -- kwp×10 (1 decimal)
  filial      TEXT        DEFAULT 'FSA',
  uf          TEXT,
  cidade      TEXT,
  nota_fiscal TEXT,
  cnpj        TEXT,
  cond_pag    TEXT,
  tipo_venda  TEXT,
  dt_entrega  TIMESTAMPTZ,
  dt_faturada TIMESTAMPTZ,
  dt_criacao  DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_ped_status   ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_ped_dc       ON pedidos(dt_criacao);
CREATE INDEX IF NOT EXISTS idx_ped_de       ON pedidos(dt_entrega);
CREATE INDEX IF NOT EXISTS idx_ped_vendedor ON pedidos(vendedor);
CREATE INDEX IF NOT EXISTS idx_ped_uf       ON pedidos(uf);

-- 2. Tabela de produtos (composição dos pedidos)
CREATE TABLE IF NOT EXISTS produtos (
  id          SERIAL PRIMARY KEY,
  pedido_id   TEXT        REFERENCES pedidos(id) ON DELETE CASCADE,
  cod         TEXT,
  nome        TEXT,
  preco       INTEGER     DEFAULT 0,           -- centavos
  qtd         NUMERIC(10,2) DEFAULT 0,
  UNIQUE(pedido_id, cod, nome)
);

CREATE INDEX IF NOT EXISTS idx_prod_pedido ON produtos(pedido_id);

-- 3. Row Level Security (acesso público — ajuste conforme necessidade)
ALTER TABLE pedidos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Permitir leitura, inserção e atualização públicas (anon key)
CREATE POLICY "anon_read"   ON pedidos  FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON pedidos  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON pedidos  FOR UPDATE USING (true);

CREATE POLICY "anon_read"   ON produtos FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON produtos FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON produtos FOR UPDATE USING (true);

-- 4. Função para estatísticas de uso (opcional)
CREATE OR REPLACE VIEW v_resumo AS
  SELECT
    COUNT(*)                          AS total_pedidos,
    COUNT(*) FILTER (WHERE status='Finalizado') AS finalizados,
    SUM(valor)::BIGINT                AS valor_total_centavos,
    SUM(kwp)::BIGINT                  AS kwp_total_decimos,
    MIN(dt_criacao)                   AS primeiro_pedido,
    MAX(dt_criacao)                   AS ultimo_pedido
  FROM pedidos;
