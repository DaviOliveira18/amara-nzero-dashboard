// Field index map
export const F = { id:0,cl:1,vd:2,vl:3,st:4,kw:5,fi:6,uf:7,ci:8,nf:9,cn:10,cp:11,tv:12,de:13,df:14,dc:15 }

export const STATUS_COLOR = {
  'Finalizado':              { bg:'rgba(0,229,160,.12)', text:'#00e5a0', dot:'#00e5a0' },
  'WMS Picking Pendente':    { bg:'rgba(251,191,36,.12)', text:'#fbbf24', dot:'#fbbf24' },
  'Em Trânsito':             { bg:'rgba(96,165,250,.12)', text:'#60a5fa', dot:'#60a5fa' },
  'Stand By':                { bg:'rgba(249,115,22,.12)', text:'#f97316', dot:'#f97316' },
  'Cancelado':               { bg:'rgba(239,68,68,.12)',  text:'#f87171', dot:'#f87171' },
  'Análise Crédito':         { bg:'rgba(167,139,250,.12)',text:'#a78bfa', dot:'#a78bfa' },
  'Ag. Faturamento':         { bg:'rgba(52,211,153,.12)', text:'#34d399', dot:'#34d399' },
  'Em Separação':            { bg:'rgba(251,191,36,.10)', text:'#fbbf24', dot:'#f59e0b' },
  'Bloqueado':               { bg:'rgba(239,68,68,.10)',  text:'#f87171', dot:'#ef4444' },
  'Ag. Coleta':              { bg:'rgba(96,165,250,.10)', text:'#93c5fd', dot:'#3b82f6' },
}

export const ETAPAS = [
  { id:'all',                   label:'Todos os Pedidos',    ic: null, col:'#00e5a0' },
  { id:'Finalizado',            label:'Finalizados',          ic: null, col:'#00e5a0' },
  { id:'WMS Picking Pendente',  label:'WMS Picking Pendente', ic: null, col:'#fbbf24' },
  { id:'Em Trânsito',           label:'Em Trânsito',          ic: null, col:'#60a5fa' },
  { id:'Stand By',              label:'Stand By',             ic: null, col:'#f97316' },
  { id:'Análise Crédito',       label:'Análise Crédito',      ic: null, col:'#a78bfa' },
  { id:'Ag. Faturamento',       label:'Ag. Faturamento',      ic: null, col:'#34d399' },
  { id:'Em Separação',          label:'Em Separação',         ic: null, col:'#fbbf24' },
  { id:'Bloqueado',             label:'Bloqueado',            ic: null, col:'#f87171' },
  { id:'Ag. Coleta',            label:'Ag. Coleta',           ic: null, col:'#93c5fd' },
  { id:'Cancelado',             label:'Cancelado',            ic: null, col:'#f87171' },
]

export const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// Excel column map (0-indexed)
export const COL = {
  id:0, razao:2, cnpj:3, vend:4, cond:11, tipo:12, vl:6, st:17, kwp:19,
  fil:20, nf:23, uf:31, ci:32, dc:48, df:52, de:57,
  skuId:59, skuCd:61, skuNm:62, skuPr:63, skuQt:64
}

// Formatters
export const R$ = v =>
  new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2}).format(v||0)

export const R$s = v => {
  if (!v) return 'R$ 0'
  if (v >= 1e9) return `R$ ${(v/1e9).toFixed(2).replace('.',',')}B`
  if (v >= 1e6) return `R$ ${(v/1e6).toFixed(3).replace('.',',')}M`
  if (v >= 1e3) return `R$ ${(v/1e3).toFixed(1).replace('.',',')}k`
  return R$(v)
}

export const N   = v => new Intl.NumberFormat('pt-BR').format(v||0)
export const fmtDate  = v => !v ? '—' : v.slice(0,10).split('-').reverse().join('/')
export const fmtHora  = v => !v ? '—' : v.slice(11,16)
export const fmtDtHr  = v => !v ? '—' : `${fmtDate(v)} ${fmtHora(v)}`

export const leadDays = (fat, ent) => {
  if (!fat || !ent) return null
  const d = Math.round((new Date(ent.slice(0,10)) - new Date(fat.slice(0,10))) / 86400000)
  return d >= 0 && d <= 365 ? d : null
}