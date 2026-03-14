import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (URL && KEY)
  ? createClient(URL, KEY, { auth: { persistSession: false } })
  : null

// ── Converters ───────────────────────────────────────────────────────────────
// Array[16] → DB row (valores compactos: centavos, kwp×10)
export const orderToRow = o => ({
  id:          o[0],
  cliente:     (o[1] || '').slice(0, 80),
  vendedor:    o[2] || 'S/ VENDEDOR',
  valor:       Math.round((o[3]  || 0) * 100),  // centavos
  status:      o[4]  || null,
  kwp:         Math.round((o[5]  || 0) * 10),   // 1 decimal
  filial:      o[6]  || 'FSA',
  uf:          o[7]  || null,
  cidade:      o[8]  || null,
  nota_fiscal: o[9]  || null,
  cnpj:        o[10] || null,
  cond_pag:    o[11] || null,
  tipo_venda:  o[12] || null,
  dt_entrega:  o[13] || null,
  dt_faturada: o[14] || null,
  dt_criacao:  o[15] || null,
})

export const rowToOrder = r => [
  r.id, r.cliente, r.vendedor,
  (r.valor  || 0) / 100,
  r.status,
  (r.kwp    || 0) / 10,
  r.filial,  r.uf, r.cidade,
  r.nota_fiscal, r.cnpj, r.cond_pag, r.tipo_venda,
  r.dt_entrega,  r.dt_faturada, r.dt_criacao,
]

// ── Queries ───────────────────────────────────────────────────────────────────
export async function fetchAllOrders() {
  if (!supabase) return null
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('id,cliente,vendedor,valor,status,kwp,filial,uf,cidade,nota_fiscal,cnpj,cond_pag,tipo_venda,dt_entrega,dt_faturada,dt_criacao')
      .order('dt_criacao', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) { console.error(error); return null }
    all = all.concat(data.map(rowToOrder))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function upsertOrders(orders) {
  if (!supabase) return { error: 'no supabase' }
  const CHUNK = 500
  for (let i = 0; i < orders.length; i += CHUNK) {
    const { error } = await supabase
      .from('pedidos')
      .upsert(orders.slice(i, i + CHUNK).map(orderToRow), { onConflict: 'id' })
    if (error) console.error('upsert chunk error:', error)
  }
  return { upserted: orders.length }
}

export async function upsertProducts(productsMap) {
  if (!supabase) return
  const rows = []
  for (const [pid, prods] of Object.entries(productsMap)) {
    for (const p of prods) {
      rows.push({ pedido_id: pid, cod: p[0]||null, nome: p[1]||null,
                  preco: Math.round((p[2]||0)*100), qtd: p[3]||0 })
    }
  }
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('produtos')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'pedido_id,cod,nome' })
    if (error) console.error('upsert products error:', error)
  }
}

export async function fetchProducts(pedidoId) {
  if (!supabase) return []
  const { data, error } = await supabase.from('produtos')
    .select('cod,nome,preco,qtd').eq('pedido_id', pedidoId)
  if (error) return []
  return data.map(p => [p.cod, p.nome, (p.preco||0)/100, p.qtd])
}