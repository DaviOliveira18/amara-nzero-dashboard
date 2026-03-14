import { useState, useEffect, useCallback } from 'react'
import { fetchAllOrders, upsertOrders, upsertProducts } from '../lib/supabase.js'

const CACHE_KEY = 'amara_orders_v2'
const CACHE_TTL  = 5 * 60 * 1000   // 5 min

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(orders) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: orders })) }
  catch { localStorage.removeItem(CACHE_KEY) }
}

export function useOrders(seedOrders) {
  const [orders, setOrders]   = useState(() => loadCache() || seedOrders || [])
  const [loading, setLoading] = useState(false)
  const [synced,  setSynced]  = useState(false)
  const [source,  setSource]  = useState(() => loadCache() ? 'cache' : 'seed')

  useEffect(() => {
    setLoading(true)
    fetchAllOrders()
      .then(data => {
        if (data && data.length > 0) {
          setOrders(data); setSource('supabase'); saveCache(data); setSynced(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const mergeOrders = useCallback(async ({ orders: newOrders, products }) => {
    const map = {}
    orders.forEach(o => { map[o[0]] = [...o] })
    let added = 0, updated = 0, unchanged = 0
    const changed = []

    newOrders.forEach(n => {
      const id = n[0]
      if (map[id]) {
        const o = map[id]; let c = false
        if (n[4] && n[4] !== o[4])   { o[4]  = n[4];  c = true }
        if (n[13] && !o[13])          { o[13] = n[13]; c = true }
        if (n[14] && !o[14])          { o[14] = n[14]; c = true }
        if (n[9]  && !o[9])           { o[9]  = n[9];  c = true }
        if (n[5] > 0 && o[5] === 0)   { o[5]  = n[5];  c = true }
        if (c) { updated++; changed.push(o) } else unchanged++
      } else { map[id] = n; added++; changed.push(n) }
    })

    const merged = Object.values(map)
    setOrders(merged); setSource('local'); saveCache(merged)
    if (changed.length > 0) {
      upsertOrders(changed).then(() => setSynced(true)).catch(console.error)
      if (products && Object.keys(products).length) upsertProducts(products).catch(console.error)
    }
    const totalV = merged.reduce((a, o) => a + o[3], 0)
    return { added, updated, unchanged, total: merged.length, totalV }
  }, [orders])

  const hardReset = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    setOrders(seedOrders || []); setSource('seed'); setSynced(false)
  }, [seedOrders])

  return { orders, loading, synced, source, mergeOrders, hardReset }
}