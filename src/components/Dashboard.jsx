import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, Clock, Truck, Package, PackageSearch, ShoppingBag, RotateCcw, XCircle, Activity, Zap, DollarSign, Calendar, Filter, ChevronDown, BarChart3, Users, MapPin, Sun, RefreshCw, Upload, FileText, Plus, Cloud, Send, X, Menu, ChevronLeft, Trophy, Star, Search, ChevronRight, Box, ArrowUpRight, ArrowDownRight, Eye } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// SUPABASE — Configurar no .env ou trocar as strings abaixo
// ══════════════════════════════════════════════════════════════
const SB_URL = (typeof import !== 'undefined' && typeof import.meta !== 'undefined')
  ? (import.meta.env?.VITE_SUPABASE_URL || '')
  : (typeof window !== 'undefined' ? window.__SB_URL__ || '' : '')
const SB_KEY = (typeof import !== 'undefined' && typeof import.meta !== 'undefined')
  ? (import.meta.env?.VITE_SUPABASE_ANON_KEY || '')
  : (typeof window !== 'undefined' ? window.__SB_KEY__ || '' : '')

// Lazy-load Supabase client only when needed
let _sb = null
async function getSB() {
  if (_sb) return _sb
  if (!SB_URL || !SB_KEY) return null
  try {
    if (window.supabase?.createClient) {
      _sb = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:false } })
      return _sb
    }
    // Load supabase from CDN
    await new Promise((res, rej) => {
      if (window._sbLoading) { setTimeout(res, 2000); return }
      window._sbLoading = true
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
      s.onload = () => { window._sbLoading = false; res() }
      s.onerror = rej
      document.head.appendChild(s)
    })
    _sb = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:false } })
    return _sb
  } catch(e) { console.warn('Supabase unavailable:', e.message); return null }
}

const orderToRow = o => ({
  id: o[0], cliente: (o[1]||'').slice(0,80), vendedor: o[2]||'S/ VENDEDOR',
  valor: Math.round((o[3]||0)*100), status: o[4]||null,
  kwp: Math.round((o[5]||0)*10), filial: o[6]||'FSA',
  uf: o[7]||null, cidade: o[8]||null, nota_fiscal: o[9]||null,
  cnpj: o[10]||null, cond_pag: o[11]||null, tipo_venda: o[12]||null,
  dt_entrega: o[13]||null, dt_faturada: o[14]||null, dt_criacao: o[15]||null,
})
const rowToOrder = r => [
  r.id, r.cliente, r.vendedor, (r.valor||0)/100, r.status,
  (r.kwp||0)/10, r.filial, r.uf, r.cidade, r.nota_fiscal,
  r.cnpj, r.cond_pag, r.tipo_venda, r.dt_entrega, r.dt_faturada, r.dt_criacao,
]

async function sbFetchAllOrders() {
  const sb = await getSB(); if (!sb) return null
  const PAGE=1000; let all=[], from=0
  while(true) {
    const {data,error} = await sb.from('pedidos')
      .select('id,cliente,vendedor,valor,status,kwp,filial,uf,cidade,nota_fiscal,cnpj,cond_pag,tipo_venda,dt_entrega,dt_faturada,dt_criacao')
      .order('dt_criacao',{ascending:false}).range(from, from+PAGE-1)
    if(error){console.error('sbFetch:',error);return null}
    all=all.concat(data.map(rowToOrder))
    if(data.length<PAGE) break
    from+=PAGE
  }
  return all
}

async function sbUpsertOrders(orders) {
  const sb = await getSB(); if (!sb) return
  const CHUNK=500
  for(let i=0;i<orders.length;i+=CHUNK){
    const {error}=await sb.from('pedidos').upsert(orders.slice(i,i+CHUNK).map(orderToRow),{onConflict:'id'})
    if(error) console.error('sbUpsert:',error)
  }
}

async function sbUpsertProducts(productsMap) {
  const sb = await getSB(); if (!sb) return
  const rows=[]
  for(const [pid,prods] of Object.entries(productsMap))
    for(const p of prods)
      rows.push({pedido_id:pid,cod:p[0]||null,nome:p[1]||null,preco:Math.round((p[2]||0)*100),qtd:p[3]||0})
  const CHUNK=500
  for(let i=0;i<rows.length;i+=CHUNK){
    const {error}=await sb.from('produtos').upsert(rows.slice(i,i+CHUNK),{onConflict:'pedido_id,cod,nome'})
    if(error) console.error('sbUpsertProds:',error)
  }
}

async function sbFetchProducts(pedidoId) {
  const sb = await getSB(); if (!sb) return []
  const {data,error}=await sb.from('produtos').select('cod,nome,preco,qtd').eq('pedido_id',pedidoId)
  if(error) return []
  return data.map(p=>[p.cod,p.nome,(p.preco||0)/100,p.qtd])
}

// ── LocalStorage Cache ───────────────────────────────────────────────────────
const CACHE_KEY='amara_v3', CACHE_TTL=5*60*1000
const loadCache=()=>{try{const r=localStorage.getItem(CACHE_KEY);if(!r)return null;const{ts,d}=JSON.parse(r);return Date.now()-ts<CACHE_TTL?d:null}catch{return null}}
const saveCache=orders=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),d:orders}))}catch{localStorage.removeItem(CACHE_KEY)}}

// ══════════════════════════════════════════════════════════════
// DADOS — carregados do Supabase ou via importação de arquivo
// ══════════════════════════════════════════════════════════════
const ORDERS = [];
const PRODUCTS = {};
const STATUS_STATS = {
  "Finalizado":{"count":5832,"valor":168345076.49,"kwp":324614.47},
  "WMS Picking Pendente":{"count":451,"valor":12555468.12,"kwp":93184.59},
  "Trânsito":{"count":160,"valor":9916296.30,"kwp":2047.90},
  "Stand By":{"count":41,"valor":1387029.00,"kwp":1077.32},
  "Confirmação de Entrega":{"count":41,"valor":4149815.27,"kwp":1975.14},
  "Expedição":{"count":27,"valor":1192389.32,"kwp":4536.00},
  "Aguardando Retirada":{"count":14,"valor":343330.30,"kwp":320.04},
  "WMS Picking Iniciado":{"count":4,"valor":199854.49,"kwp":141.84},
  "Solicitação de Devol. de NF para Retorno":{"count":1,"valor":16121.20,"kwp":12.18},
  "Solicitação de Devol. de NF para Cancelamento":{"count":1,"valor":15922.50,"kwp":12.18}
};

const DAILY_FEB = [
  {d:"02",c:59,v:1389884},{d:"03",c:33,v:1689750},{d:"04",c:78,v:1433615},
  {d:"05",c:51,v:869160},{d:"06",c:98,v:1416063},{d:"07",c:7,v:385440},
  {d:"09",c:54,v:1035194},{d:"10",c:64,v:985096},{d:"11",c:72,v:1407786},
  {d:"12",c:61,v:1016399},{d:"13",c:55,v:734733},{d:"16",c:14,v:250396},
  {d:"18",c:59,v:3433739},{d:"19",c:73,v:1261892},{d:"20",c:43,v:972597},
  {d:"23",c:35,v:714704},{d:"24",c:22,v:276472},
];

const TOP_SELLERS = [
  {n:"MAIANE MATOS MELO",c:637,v:20120331,t:31586},
  {n:"ELMA EDLLA",c:494,v:14490253,t:29332},
  {n:"NARA RIBEIRO COSTA ALBUQUERQUE PITANGA",c:33,v:12569730,t:380901},
  {n:"THAMIRES FERNANDA SOARES DE SANTANA",c:464,v:12433472,t:26796},
  {n:"GABRIEL BORGES DOS SANTOS",c:464,v:12375006,t:26670},
  {n:"LUIS HENRIQUE FERREIRA SANT ANNA FILHO",c:854,v:12274514,t:14373},
  {n:"JORDANA BAIAO",c:449,v:11655257,t:25958},
  {n:"CELENE CARMO DOS SANTOS",c:286,v:9244751,t:32324},
  {n:"RAINEI TRINDADE DE SOUZA",c:539,v:8870484,t:16457},
  {n:"LUANA ELIZABETT DE SANTANA SOBRINHO",c:363,v:8619897,t:23746},
  {n:"VITOR BERTIN TEIXEIRA",c:52,v:8464102,t:162771},
  {n:"LIANDRA LOPES DE SOUSA",c:58,v:5549941,t:95689},
  {n:"RAFAELA PEREIRA DE MENEZES",c:191,v:5080819,t:26601},
  {n:"JOYCE SANTOS OLIVEIRA",c:48,v:4718706,t:98306},
  {n:"VANESSA VIEIRA DE CARVALHO",c:126,v:4113466,t:32647},
  {n:"BRUNO RICARDO CONCEICAO BARRETO",c:222,v:4011974,t:18072},
  {n:"ARIELSON SANTANA",c:164,v:3636965,t:22177},
  {n:"IANEQUELE SOUZA DA SILVA",c:125,v:3467337,t:27739},
  {n:"MARCELO SOUZA FERREIRA DIAS",c:150,v:2543832,t:16959},
  {n:"JOAQUIM EMANUEL ARAGAO ARAUJO",c:19,v:1123652,t:59140},
];

const TOP_ESTADOS = [
  {uf:"BA",c:2847,v:79700887},{uf:"PE",c:582,v:13970829},
  {uf:"CE",c:484,v:15956245},{uf:"RN",c:361,v:10925188},
  {uf:"SE",c:311,v:5733038},{uf:"PB",c:267,v:8039617},
  {uf:"PA",c:244,v:6575247},{uf:"AL",c:220,v:7882462},
  {uf:"MA",c:219,v:4592290},{uf:"PI",c:129,v:2813098},
  {uf:"MG",c:56,v:8378698},{uf:"TO",c:46,v:1153315},
  {uf:"PR",c:31,v:301177},{uf:"AM",c:19,v:1496450},
  {uf:"SP",c:7,v:574852},
];

const ALL_VENDORS = ["ALINE MIEKO MIYASHIRO HIGA DOS SANTOS","ANDRESSA CLICIA DE JESUS SILVA","ARIELSON SANTANA","BRUNA APARECIDA DOS SANTOS BATISTA","BRUNO FELIPE OLIVEIRA DE JESUS","BRUNO RICARDO CONCEICAO BARRETO","CELENE CARMO DOS SANTOS","ELMA EDLLA","GABRIEL BORGES DOS SANTOS","GUILHERME VICTOR PEREIRA DE ARRUDA","HUGO ANDRADE DO CARMO","IANEQUELE SOUZA DA SILVA","JOAQUIM EMANUEL ARAGAO ARAUJO","JORDANA BAIAO","JOYCE SANTOS OLIVEIRA","KALILA DOS SANTOS CAETANO","LAYANNE PATRICIA MONTEIRO FERREIRA","LIANDRA LOPES DE SOUSA","LUANA ELIZABETT DE SANTANA SOBRINHO","LUANA SANTANA DAMASCENO","LUCAS MASSIAS FREITAS","LUIS HENRIQUE FERREIRA SANT ANNA FILHO","MAIANE MATOS MELO","MARCELO COELHO ARANTES MAROTTA","MARCELO SOUZA FERREIRA DIAS","NARA ELZIRA OLIVEIRA DE SANTANA","NARA RIBEIRO COSTA ALBUQUERQUE PITANGA","RAFAELA FERNANDES FERREIRA","RAFAELA PEREIRA DE MENEZES","RAINEI TRINDADE DE SOUZA","S/ VENDEDOR","THAMIRES FERNANDA SOARES DE SANTANA","TIAGO DE OLIVEIRA JACINTO","VANESSA VIEIRA DE CARVALHO","VITOR BERTIN TEIXEIRA"];
const ALL_STATES = ["AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","PA","PB","PE","PI","PR","RN","RR","SE","SP","TO"];

// Índices do array de pedido
const F = {id:0,cl:1,vd:2,vl:3,st:4,kw:5,fi:6,uf:7,ci:8,nf:9,cn:10,cp:11,tv:12,de:13,df:14,dc:15};

const STATUS_COLOR = {
  "Finalizado":"#00e5a0","WMS Picking Pendente":"#f59e0b","Trânsito":"#3b82f6",
  "Stand By":"#8b5cf6","Confirmação de Entrega":"#06b6d4","Expedição":"#f97316",
  "Aguardando Retirada":"#ec4899","WMS Picking Iniciado":"#14b8a6",
  "Solicitação de Devol. de NF para Retorno":"#ef4444",
  "Solicitação de Devol. de NF para Cancelamento":"#dc2626"
};

const ETAPAS = [
  {id:"all",lb:"Todos os Pedidos",ic:Activity,co:"#6366f1"},
  {id:"Finalizado",lb:"Finalizado",ic:CheckCircle2,co:"#00e5a0"},
  {id:"WMS Picking Pendente",lb:"WMS Picking Pendente",ic:PackageSearch,co:"#f59e0b"},
  {id:"Trânsito",lb:"Trânsito",ic:Truck,co:"#3b82f6"},
  {id:"Stand By",lb:"Stand By",ic:Clock,co:"#8b5cf6"},
  {id:"Confirmação de Entrega",lb:"Confirmação de Entrega",ic:RefreshCw,co:"#06b6d4"},
  {id:"Expedição",lb:"Expedição",ic:Package,co:"#f97316"},
  {id:"Aguardando Retirada",lb:"Aguardando Retirada",ic:ShoppingBag,co:"#ec4899"},
  {id:"WMS Picking Iniciado",lb:"WMS Picking Iniciado",ic:Box,co:"#14b8a6"},
  {id:"Solicitação de Devol. de NF para Retorno",lb:"Devol. NF Retorno",ic:RotateCcw,co:"#ef4444"},
  {id:"Solicitação de Devol. de NF para Cancelamento",lb:"Devol. NF Cancelamento",ic:XCircle,co:"#dc2626"},
];

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const G = {
  bg:"var(--g-bg)",panel:"var(--g-panel)",card:"var(--g-card)",border:"var(--g-border)",
  green:"var(--g-green)",text:"var(--g-text)",muted:"var(--g-muted)",dim:"var(--g-dim)",
  grad:"var(--g-grad)"
};
const DARK_THEME = `
  --g-bg:#04090f;--g-panel:#070e1b;--g-card:#0a1628;--g-border:#1a2e4a;
  --g-green:#00e5a0;--g-text:#f1f5f9;--g-muted:#64748b;--g-dim:#334155;
  --g-grad:linear-gradient(135deg,#00c27b,#005c35);
  --g-scrollbar:#1a2e4a;--g-insight-bg:rgba(10,22,40,.9);
`;
const LIGHT_THEME = `
  --g-bg:#f0f4f8;--g-panel:#e2e8f0;--g-card:#ffffff;--g-border:#cbd5e1;
  --g-green:#059669;--g-text:#0f172a;--g-muted:#475569;--g-dim:#94a3b8;
  --g-grad:linear-gradient(135deg,#059669,#047857);
  --g-scrollbar:#cbd5e1;--g-insight-bg:rgba(240,244,248,.95);
`;

const R$ = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2}).format(v||0);
const R$s = v => {
  if(!v) return "R$ 0,00";
  if(v>=1e9) return `R$ ${(v/1e9).toFixed(2).replace(".",",")}B`;
  if(v>=1e6) return `R$ ${(v/1e6).toFixed(3).replace(".",",")}M`;
  if(v>=1e3) return `R$ ${(v/1e3).toFixed(1).replace(".",",")}k`;
  return R$(v);
};
const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const N = v => new Intl.NumberFormat("pt-BR").format(v||0);
const fmtDate = v => !v?"—":v.slice(0,10).split("-").reverse().join("/");
const fmtHora = v => !v?"—":v.slice(11,16);
const fmtDtHr = v => !v?"—":`${fmtDate(v)} ${fmtHora(v)}`;
const leadDays = (fat,ent) => {
  if(!fat||!ent) return null;
  const d = Math.round((new Date(ent.slice(0,10))-new Date(fat.slice(0,10)))/86400000);
  return d>=0&&d<=365?d:null;
};

// ══════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',sans-serif;background:var(--g-bg);color:var(--g-text);overflow:hidden}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a3a5a;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2a5a8a}
input,button{font-family:'Outfit',sans-serif}input::placeholder{color:#475569}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
.card{background:var(--g-card);border:1px solid var(--g-border);border-radius:16px;transition:border-color .2s,transform .15s,box-shadow .15s}
.card:hover{border-color:rgba(0,229,160,.19);box-shadow:0 8px 32px rgba(0,0,0,.5)}
.rh{transition:background .12s;cursor:pointer}.rh:hover{background:rgba(0,229,160,.04)!important}
.btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:8px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:600;transition:all .15s}.btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:600;display:flex;align-items:center;justify-content:center;animation:fadeUp .15s ease;padding:16px}
.modal{background:var(--g-panel);border:1px solid var(--g-border);border-radius:20px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.95);display:flex;flex-direction:column;animation:fadeUp .18s ease}
.dd{position:absolute;top:calc(100%+6px);left:0;background:var(--g-card);border:1px solid var(--g-border);border-radius:12px;min-width:230px;z-index:400;box-shadow:0 20px 50px rgba(0,0,0,.75);animation:fadeUp .12s ease;max-height:300px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#1a2e4a transparent}
.ddi{padding:10px 16px;cursor:pointer;font-size:13px;transition:background .1s;color:var(--g-text)}.ddi:hover{background:rgba(0,229,160,.07)}2a}
.sbi{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;border:none;border-left:3px solid transparent;cursor:pointer;background:transparent;text-align:left;margin-bottom:2px;transition:all .15s;color:#f1f5f9}.sbi:hover{background:rgba(255,255,255,.04)}
.sbi.active{border-left-color:var(--g-green);background:rgba(0,229,160,.08)}
.tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
`;

// ══════════════════════════════════════════════════════════════
// DROPDOWN
// ══════════════════════════════════════════════════════════════
function DD({label,icon:Icon,opts,val,onChange,ph}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  return <div ref={ref} style={{position:"relative",flexShrink:0}}>
    <button onClick={()=>setOpen(v=>!v)} style={{
      display:"flex",alignItems:"center",gap:6,padding:"7px 12px",
      background:val?"rgba(0,229,160,.08)":G.card,
      border:`1px solid ${val?"#00e5a050":G.border}`,
      borderRadius:8,color:val?G.green:"#94a3b8",fontSize:13,cursor:"pointer",
      whiteSpace:"nowrap",transition:"all .15s",fontWeight:val?600:400
    }}>
      {Icon&&<Icon size={13} color={val?G.green:"#64748b"}/>}
      <span style={{maxWidth:130,overflow:"hidden",textOverflow:"ellipsis"}}>{val||label}</span>
      <ChevronDown size={11} style={{transform:open?"rotate(180deg)":"",transition:"transform .2s",flexShrink:0}}/>
    </button>
    {open&&<div className="dd">
      <div className="ddi" style={{color:G.muted,borderBottom:`1px solid ${G.border}`}}
        onClick={()=>{onChange(null);setOpen(false)}}>{ph||"Todos"}</div>
      {opts.map(o=><div key={o} className="ddi"
        style={{color:val===o?G.green:G.text,background:val===o?"rgba(0,229,160,.08)":"",fontWeight:val===o?700:400}}
        onClick={()=>{onChange(o);setOpen(false)}}>{o}</div>)}
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════
// STATUS BADGE
// ══════════════════════════════════════════════════════════════
function SBadge({s}){
  const c=STATUS_COLOR[s]||"#64748b";
  return <span className="tag" style={{background:`${c}18`,color:c,border:`1px solid ${c}28`}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>
    {s}
  </span>;
}

// ══════════════════════════════════════════════════════════════
// PRODUCT MODAL — composição da nota
// ══════════════════════════════════════════════════════════════
function ProductModal({order,onClose,liveProducts}){
  const prodsSource = (liveProducts && Object.keys(liveProducts).length > 0) ? liveProducts : PRODUCTS;
  const prods = prodsSource[order[F.id]] || [];
  const totalCalc = prods.reduce((a,p)=>a+(p[4]||0),0);
  const lt = leadDays(order[F.df], order[F.de]);
  const ltColor = lt===null?"#64748b":lt>30?"#ef4444":lt>14?"#f97316":"#22c55e";

  return <div className="ov" style={{zIndex:700}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal" style={{width:880,maxHeight:"90vh"}}>
      {/* Header */}
      <div style={{background:G.grad,padding:"18px 24px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <div style={{width:44,height:44,background:"rgba(255,255,255,.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <FileText size={20} color="#fff"/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:"#fff",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",gap:10}}>
            NF: {order[F.nf]||"—"}
            <span style={{background:"rgba(255,255,255,.15)",color:"#fff",fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:700}}>FSA</span>
          </div>
          <div style={{color:"rgba(255,255,255,.7)",fontSize:12,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            Pedido: {order[F.id]} · {order[F.cl]}
          </div>
        </div>
        <button onClick={onClose} className="btn" style={{background:"rgba(255,255,255,.15)",color:"#fff",padding:"7px 10px",flexShrink:0}}><X size={15}/></button>
      </div>

      {/* Order info grid */}
      <div style={{padding:"14px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0,background:"rgba(10,22,40,.8)"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[
            {l:"CLIENTE",v:order[F.cl],mono:false},
            {l:"VENDEDOR",v:order[F.vd]?.split(" ").slice(0,3).join(" "),mono:false},
            {l:"CNPJ",v:order[F.cn]||"—",mono:true},
            {l:"ESTADO / CIDADE",v:`${order[F.uf]||"—"} · ${order[F.ci]||"—"}`,mono:false},
            {l:"DT. BAIXA (ENTREGA)",v:fmtDtHr(order[F.de]),mono:true,hi:true},
            {l:"DT. FATURADA",v:fmtDtHr(order[F.df]),mono:true},
            {l:"LEAD TIME",v:lt!==null?`${lt} dias`:"—",mono:true,color:ltColor},
            {l:"POTÊNCIA",v:order[F.kw]>0?`${order[F.kw]} kWp`:"—",mono:true},
          ].map(({l,v,mono,hi,color})=>(
            <div key={l}>
              <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>{l}</div>
              <div style={{color:color||(hi?G.green:G.text),fontSize:12,fontWeight:hi?700:500,fontFamily:mono?"'JetBrains Mono',monospace":"'Outfit',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Products table header */}
      <div style={{padding:"12px 24px 0",flexShrink:0}}>
        <div style={{color:G.text,fontSize:14,fontWeight:800,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
          <Package size={15} color={G.green}/>
          Composição da Nota — {prods.length} {prods.length===1?"item":"itens"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"110px 1fr 120px 80px 120px",gap:8,
          padding:"8px 12px",background:"rgba(10,31,56,.9)",borderRadius:"8px 8px 0 0",
          color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>
          <span>CÓD. PRODUTO</span>
          <span>DESCRIÇÃO DO PRODUTO</span>
          <span style={{textAlign:"right"}}>PREÇO UNITÁRIO</span>
          <span style={{textAlign:"right"}}>QTD</span>
          <span style={{textAlign:"right"}}>TOTAL</span>
        </div>
      </div>

      <div style={{overflowY:"auto",flex:1,padding:"0 24px",scrollbarWidth:"thin",scrollbarColor:"#1a2e4a transparent"}}>
        {prods.length===0?(
          <div style={{padding:"32px",textAlign:"center",color:G.muted,fontSize:13}}>
            <div style={{fontSize:32,marginBottom:12}}>📥</div>
            <div style={{color:G.text,fontWeight:700,marginBottom:6}}>Composição não disponível</div>
            <div style={{fontSize:12,lineHeight:1.6}}>Para ver os produtos, importe um novo relatório<br/>clicando em <strong style={{color:G.green}}>Add Arq.</strong> no cabeçalho.</div>
          </div>
        ):prods.map((p,i)=>{
          const [cod,nome,pu,qtd,total]=p;
          const rowBg = i%2===0?"transparent":"rgba(10,31,56,.4)";
          return <div key={i} className="rh" style={{display:"grid",gridTemplateColumns:"110px 1fr 120px 80px 120px",gap:8,
            padding:"10px 12px",background:rowBg,borderBottom:`1px solid #0d1b2a`,alignItems:"center"}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:G.green,fontWeight:600}}>{cod||"—"}</span>
            <span style={{fontSize:12,color:G.text,lineHeight:1.4}}>{nome||"—"}</span>
            <span style={{textAlign:"right",fontSize:12,color:pu>0?"#94a3b8":G.muted,fontFamily:"'JetBrains Mono',monospace"}}>
              {pu>0?R$(pu):"—"}
            </span>
            <span style={{textAlign:"right",fontSize:13,color:G.text,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
              {N(qtd)}
            </span>
            <span style={{textAlign:"right",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:total>0?G.text:G.muted}}>
              {total>0?R$(total):"—"}
            </span>
          </div>;
        })}
      </div>

      {/* Totals footer */}
      <div style={{padding:"14px 24px",borderTop:`1px solid ${G.border}`,flexShrink:0,
        background:"rgba(10,31,56,.9)",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:40}}>
        <div style={{textAlign:"right"}}>
          <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>TOTAL CALCULADO ({prods.length} itens)</div>
          <div style={{color:"#94a3b8",fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{R$(totalCalc)}</div>
        </div>
        <div style={{width:1,height:36,background:G.border}}/>
        <div style={{textAlign:"right"}}>
          <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>VALOR TOTAL DA NOTA</div>
          <div style={{color:G.green,fontSize:22,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{R$(order[F.vl])}</div>
        </div>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════════
// DAY MODAL — notas baixadas num dia
// ══════════════════════════════════════════════════════════════
function DayModal({dateStr,onClose,liveProducts,liveOrders}){
  const [pg,setPg]=useState(1);
  const [sortC,setSortC]=useState("de");
  const [sortD,setSortD]=useState("asc");
  const [selOrder,setSelOrder]=useState(null);
  const PER=10;

  const orders=useMemo(()=>{
    let d=(liveOrders||ORDERS).filter(o=>o[F.st]==="Finalizado"&&o[F.de]&&o[F.de].startsWith(dateStr));
    d.sort((a,b)=>{
      const av=a[sortC==="de"?F.de:F.vl]||"";
      const bv=b[sortC==="de"?F.de:F.vl]||"";
      return sortD==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });
    return d;
  },[dateStr,sortC,sortD]);

  const total=useMemo(()=>orders.reduce((a,o)=>a+o[F.vl],0),[orders]);
  const pages=Math.max(1,Math.ceil(orders.length/PER));
  const paged=orders.slice((pg-1)*PER,pg*PER);
  const display=dateStr.split("-").reverse().join("/");

  return <>
    {selOrder&&<ProductModal order={selOrder} onClose={()=>setSelOrder(null)} liveProducts={liveProducts||PRODUCTS}/>}
    <div className="ov" onClick={e=>e.target===e.currentTarget&&!selOrder&&onClose()}>
      <div className="modal" style={{width:980,maxHeight:"90vh"}}>
        {/* Header */}
        <div style={{background:G.grad,padding:"18px 24px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
          <div style={{width:44,height:44,background:"rgba(255,255,255,.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Calendar size={20} color="#fff"/>
          </div>
          <div>
            <div style={{color:"#fff",fontSize:17,fontWeight:800}}>Notas Baixadas em {display}</div>
            <div style={{color:"rgba(255,255,255,.7)",fontSize:12,marginTop:1}}>Dt. Entrega — data e hora que a nota foi baixada no intranet</div>
          </div>
          <button onClick={onClose} className="btn" style={{marginLeft:"auto",background:"rgba(255,255,255,.15)",color:"#fff",padding:"7px 10px",flexShrink:0}}><X size={15}/></button>
        </div>

        {/* Summary */}
        <div style={{display:"flex",borderBottom:`1px solid ${G.border}`,flexShrink:0,background:"rgba(10,22,40,.6)"}}>
          {[
            {ic:FileText,l:"TOTAL DE NOTAS",v:String(orders.length)},
            {ic:DollarSign,l:"VALOR TOTAL BAIXADO",v:R$(total)},
          ].map(({ic:Ic,l,v},i)=>(
            <div key={i} style={{padding:"14px 28px",display:"flex",alignItems:"center",gap:12,borderRight:i===0?`1px solid ${G.border}`:"none"}}>
              <div style={{width:34,height:34,background:G.card,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ic size={16} color={G.green}/>
              </div>
              <div>
                <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>{l}</div>
                <div style={{color:G.text,fontSize:20,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
              </div>
            </div>
          ))}
          <div style={{padding:"14px 28px",display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:G.green,animation:"pulse 2s infinite"}}/>
            <span style={{color:G.green,fontSize:12,fontWeight:700}}>Clique na linha para ver composição</span>
          </div>
        </div>

        {/* Table */}
        <div style={{display:"grid",gridTemplateColumns:"1.3fr 1.8fr 1.5fr 1.3fr 0.65fr 1.05fr 0.75fr",
          padding:"9px 20px",borderBottom:`1px solid ${G.border}`,
          color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",flexShrink:0,background:"rgba(10,22,40,.8)"}}>
          {["NOTA FISCAL","PEDIDO","CLIENTE","VENDEDOR","LEAD","VALOR TOTAL","HORA BAIXA"].map((h,i)=>(
            <span key={h} style={{
              textAlign:h==="VALOR TOTAL"?"right":"left",
              color:(h==="HORA BAIXA"||h==="NOTA FISCAL")&&sortC===("de")?"#00e5a0":G.muted,
              cursor:"pointer"
            }}
            onClick={()=>{
              if(h==="VALOR TOTAL"){setSortC("vl");setSortD(d=>d==="asc"?"desc":"asc");}
              else if(h==="HORA BAIXA"){setSortC("de");setSortD(d=>d==="asc"?"desc":"asc");}
            }}>
              {h}{(h==="VALOR TOTAL"&&sortC==="vl")||(h==="HORA BAIXA"&&sortC==="de")?<span style={{color:G.green}}> {sortD==="asc"?"↑":"↓"}</span>:null}
            </span>
          ))}
        </div>

        <div style={{overflowY:"auto",flex:1,scrollbarWidth:"thin",scrollbarColor:"#1a2e4a transparent"}}>
          {paged.length===0?(
            <div style={{padding:"48px",textAlign:"center",color:G.muted}}>Nenhuma nota baixada nesta data.</div>
          ):paged.map((o,i)=>{
            const lt=leadDays(o[F.df],o[F.de]);
            const lc=lt===null?"#475569":lt>30?"#ef4444":lt>14?"#f97316":"#22c55e";
            return <div key={i} className="rh"
              style={{display:"grid",gridTemplateColumns:"1.3fr 1.8fr 1.5fr 1.3fr 0.65fr 1.05fr 0.75fr",
                padding:"11px 20px",borderBottom:`1px solid #0d1b2a`,alignItems:"center",
                background:i%2===0?"transparent":"rgba(10,22,40,.3)"}}
              onClick={()=>setSelOrder(o)}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:G.green,fontWeight:800,fontSize:13,fontFamily:"'JetBrains Mono',monospace"}}>{o[F.nf]||"—"}</span>
                  <span style={{background:"#1a2e4a",color:"#93c5fd",fontSize:9,padding:"1px 5px",borderRadius:3,fontWeight:700}}>FSA</span>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,color:"#94a3b8",fontSize:11,overflow:"hidden"}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o[F.id]}</span>
              </div>
              <span style={{color:G.text,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={o[F.cl]}>{o[F.cl]}</span>
              <span style={{color:"#94a3b8",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={o[F.vd]}>{o[F.vd]?.split(" ").slice(0,2).join(" ")}</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 7px",borderRadius:7,
                background:`${lc}18`,color:lc,fontSize:11,fontWeight:700,width:"fit-content"}}>
                <Clock size={9}/>{lt!==null?`${lt}d`:"—"}
              </span>
              <span style={{textAlign:"right",color:G.text,fontSize:13,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{R$s(o[F.vl])}</span>
              <span style={{fontSize:12,color:G.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtHora(o[F.de])}</span>
            </div>;
          })}
        </div>

        {/* Pagination */}
        <div style={{padding:"11px 20px",borderTop:`1px solid ${G.border}`,display:"flex",
          alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"rgba(10,22,40,.6)"}}>
          <span style={{color:G.muted,fontSize:12}}>{orders.length===0?"0":`${(pg-1)*PER+1}–${Math.min(pg*PER,orders.length)}`} de {orders.length} notas</span>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1}
              style={{width:28,height:28,borderRadius:6,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:pg===1?G.dim:G.muted,opacity:pg===1?.4:1}}>
              <ChevronLeft size={13}/>
            </button>
            <span style={{color:G.muted,fontSize:12,padding:"0 8px",fontFamily:"'JetBrains Mono',monospace"}}>Pg {pg}/{pages}</span>
            <button onClick={()=>setPg(p=>Math.min(pages,p+1))} disabled={pg===pages}
              style={{width:28,height:28,borderRadius:6,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:pg===pages?G.dim:G.muted,opacity:pg===pages?.4:1}}>
              <ChevronRight size={13}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
// SELLERS MODAL
// ══════════════════════════════════════════════════════════════
function SellersModal({onClose,sellers}){
  const [q,setQ]=useState(""),
    [sc,setSc]=useState("v"),
    [sd,setSd]=useState("desc");
  const data=useMemo(()=>{
    let d=[...(sellers||TOP_SELLERS)];
    if(q) d=d.filter(s=>s.n.toLowerCase().includes(q.toLowerCase()));
    d.sort((a,b)=>{const av=sc==="t"?(a.c>0?a.v/a.c:0):a[sc];const bv=sc==="t"?(b.c>0?b.v/b.c:0):b[sc];return sd==="desc"?bv-av:av-bv;});
    return d;
  },[q,sc,sd]);
  const sort=col=>{if(sc===col)setSd(d=>d==="asc"?"desc":"asc");else{setSc(col);setSd("desc");}};
  const SH=({col,l,align="left"})=>(
    <button onClick={()=>sort(col)} style={{background:"none",border:"none",color:sc===col?G.green:G.muted,
      fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",cursor:"pointer",
      fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:3,
      justifyContent:align==="right"?"flex-end":"flex-start",width:"100%"}}>
      {l}{sc===col&&<span style={{color:G.green}}>{sd==="asc"?"↑":"↓"}</span>}
    </button>);
  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal" style={{width:760,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:G.grad,padding:"18px 24px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <div style={{width:44,height:44,background:"rgba(255,255,255,.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Trophy size={22} color="#fbbf24"/>
        </div>
        <div style={{flex:1}}>
          <div style={{color:"#fff",fontSize:17,fontWeight:800}}>Ranking de Vendedores</div>
          <div style={{color:"rgba(255,255,255,.7)",fontSize:12,marginTop:1}}>Top {data.length} vendedores · base completa de pedidos finalizados</div>
        </div>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.28)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}>✕</button>
      </div>

      {/* Search + Sort */}
      <div style={{padding:"14px 24px",background:G.card,borderBottom:`1px solid ${G.border}`,display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
        <div style={{position:"relative",flex:1}}>
          <Search size={13} color={G.muted} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar vendedor..."
            style={{width:"100%",padding:"7px 10px 7px 30px",background:"rgba(255,255,255,.04)",border:`1px solid ${G.border}`,borderRadius:8,color:G.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'Outfit',sans-serif"}}/>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{k:"v",l:"Faturamento"},{k:"c",l:"Pedidos"},{k:"t",l:"Ticket Médio"}].map(({k,l})=>(
            <button key={k} onClick={()=>sort(k)} style={{padding:"6px 12px",background:sc===k?"rgba(0,229,160,.15)":"rgba(255,255,255,.04)",border:`1px solid ${sc===k?G.green:G.border}`,borderRadius:8,color:sc===k?G.green:G.muted,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
              {l} {sc===k&&(sd==="desc"?"↓":"↑")}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div style={{display:"grid",gridTemplateColumns:"40px 1fr 120px 100px 120px",gap:8,padding:"8px 24px",background:"rgba(10,31,56,.9)",flexShrink:0,color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>
        <span>#</span><span>VENDEDOR</span>
        <span style={{textAlign:"right"}}>FATURAMENTO</span>
        <span style={{textAlign:"right"}}>PEDIDOS</span>
        <span style={{textAlign:"right"}}>TICKET MÉDIO</span>
      </div>

      {/* Table rows */}
      <div style={{overflowY:"auto",flex:1,scrollbarWidth:"thin",scrollbarColor:"#1a2e4a transparent"}}>
        {data.map((s,i)=>{
          const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
          const ticket=s.c>0?Math.round(s.v/s.c):0;
          return <div key={s.n} className="rh" style={{display:"grid",gridTemplateColumns:"40px 1fr 120px 100px 120px",gap:8,padding:"10px 24px",alignItems:"center",borderBottom:`1px solid ${G.border}`,background:i%2===0?"transparent":"rgba(10,31,56,.3)"}}>
            <span style={{color:medal?"#fbbf24":G.muted,fontWeight:800,fontSize:13}}>{medal||`${i+1}`}</span>
            <div>
              <div style={{color:G.text,fontWeight:700,fontSize:13}}>{s.n}</div>
            </div>
            <span style={{textAlign:"right",color:G.green,fontWeight:800,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(s.v)}</span>
            <span style={{textAlign:"right",color:G.text,fontWeight:700,fontSize:13,fontFamily:"'JetBrains Mono',monospace"}}>{s.c}</span>
            <span style={{textAlign:"right",color:"#94a3b8",fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(ticket)}</span>
          </div>;
        })}
        {data.length===0&&<div style={{padding:"32px",textAlign:"center",color:G.muted}}>Nenhum vendedor encontrado.</div>}
      </div>

    </div>
  </div>;
}


// ══════════════════════════════════════════════════════════════
// AMAR ELO — CHATBOT ULTRA INTELIGENTE ☀️
// ══════════════════════════════════════════════════════════════
const SUN_URL = "data:image/png;base64,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";

const AI_DATA = (() => {
  const fin = ORDERS.filter(o=>o[F.st]==="Finalizado");
  const vMap={};
  fin.forEach(o=>{const v=o[F.vd]||"S/ VENDEDOR";if(!vMap[v])vMap[v]={n:v,c:0,v:0,kw:0};vMap[v].c++;vMap[v].v+=o[F.vl];vMap[v].kw+=o[F.kw];});
  const sellers=Object.values(vMap).sort((a,b)=>b.v-a.v);
  const ufMap={};
  fin.forEach(o=>{const u=o[F.uf]||"?";if(!ufMap[u])ufMap[u]={uf:u,c:0,v:0};ufMap[u].c++;ufMap[u].v+=o[F.vl];});
  const estados=Object.values(ufMap).sort((a,b)=>b.c-a.c);
  const daily={};
  fin.forEach(o=>{if(o[F.de]){const d=o[F.de].slice(0,10);if(!daily[d])daily[d]={d,c:0,v:0};daily[d].c++;daily[d].v+=o[F.vl];}});
  const dailyArr=Object.values(daily).sort((a,b)=>a.d.localeCompare(b.d));
  let ltSum=0,ltCnt=0;
  fin.forEach(o=>{const lt=leadDays(o[F.df],o[F.de]);if(lt!==null&&lt>=0&&lt<=365){ltSum+=lt;ltCnt++;}});
  const statMap={};
  ORDERS.forEach(o=>{if(!statMap[o[F.st]])statMap[o[F.st]]={s:o[F.st],c:0,v:0};statMap[o[F.st]].c++;statMap[o[F.st]].v+=o[F.vl];});
  const hourMap={};
  fin.forEach(o=>{if(o[F.de]&&o[F.de].length>=13){const h=parseInt(o[F.de].slice(11,13));if(!isNaN(h)){if(!hourMap[h])hourMap[h]={h,c:0};hourMap[h].c++;}}});
  const horaPico=Object.values(hourMap).sort((a,b)=>b.c-a.c)[0]||{h:14,c:80};
  const fmtR=v=>`R$${new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2}).format(v)}`;
  const top10S=sellers.slice(0,10).map((s,i)=>`${i+1}. ${s.n}: ${s.c} pedidos, ${fmtR(s.v)}, ${s.kw.toFixed(0)} kWp`).join("\n");
  const top10UF=estados.slice(0,10).map(e=>`${e.uf}: ${e.c} pedidos, ${fmtR(e.v)}`).join("\n");
  const dailySummary=dailyArr.map(d=>`${d.d}: ${d.c} notas, ${fmtR(d.v)}`).join("\n");
  const hourSummary=Object.values(hourMap).sort((a,b)=>a.h-b.h).map(h=>`${String(h.h).padStart(2,"0")}h: ${h.c} baixas`).join(" | ");
  const statusFull=Object.values(statMap).sort((a,b)=>b.c-a.c).map(s=>`${s.s}: ${s.c} pedidos, ${fmtR(s.v)}`).join("\n");
  const cidMap={};
  fin.forEach(o=>{const c=`${o[F.ci]||"?"} (${o[F.uf]||"?"})`;if(!cidMap[c])cidMap[c]={c,cnt:0,v:0};cidMap[c].cnt++;cidMap[c].v+=o[F.vl];});
  const top10Cid=Object.values(cidMap).sort((a,b)=>b.cnt-a.cnt).slice(0,10).map((c,i)=>`${i+1}. ${c.c}: ${c.cnt} pedidos, ${fmtR(c.v)}`).join("\n");
  const ltVend={};
  fin.forEach(o=>{const v=o[F.vd]||"?";const lt=leadDays(o[F.df],o[F.de]);if(lt!==null&&lt>=0&&lt<=365){if(!ltVend[v])ltVend[v]={n:v,sum:0,cnt:0};ltVend[v].sum+=lt;ltVend[v].cnt++;}});
  const ltVendStr=Object.values(ltVend).sort((a,b)=>(a.sum/a.cnt)-(b.sum/b.cnt)).slice(0,5).map(v=>`${v.n.split(" ")[0]}: ${(v.sum/v.cnt).toFixed(1)}d`).join(" | ");
  return {
    totalPedidos:ORDERS.length, totalFaturamento:ORDERS.reduce((a,o)=>a+o[F.vl],0),
    totalKwp:ORDERS.reduce((a,o)=>a+o[F.kw],0), finalizados:fin.length,
    faturamentoFin:fin.reduce((a,o)=>a+o[F.vl],0),
    leadTimeMedio:ltCnt>0?(ltSum/ltCnt).toFixed(1):"11.6",
    top10Sellers:top10S, top10UF, dailySummary, statusFull, top10Cidades:top10Cid,
    hourSummary, ltVendorStr:ltVendStr,
    melhorDia:dailyArr.sort((a,b)=>b.c-a.c)[0]||{d:"2026-02-06",c:98,v:1416063},
    maiorFatDia:[...dailyArr].sort((a,b)=>b.v-a.v)[0]||{d:"2026-02-18",c:59,v:3433739},
    horaPico, ticketMedio:fin.length>0?(fin.reduce((a,o)=>a+o[F.vl],0)/fin.length).toFixed(0):"30146",
    totalUFs:estados.length, totalVendedores:sellers.length, fmtR,
  };
})();

const CHAT_CSS = `
@keyframes aura-ping{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(2.2);opacity:0}}
@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
@keyframes sparkle-a{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
@keyframes sparkle-b{0%,100%{opacity:.4;transform:scale(.7)}60%{opacity:1;transform:scale(1.1)}}
@keyframes sparkle-c{0%,100%{opacity:.7;transform:scale(.9)}40%{opacity:.2;transform:scale(.5)}}
@keyframes msg-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes sun-glow{0%,100%{filter:drop-shadow(0 0 6px rgba(251,191,36,.5))}50%{filter:drop-shadow(0 0 14px rgba(251,191,36,.9))}}
.sparkle-1{animation:sparkle-a 2.1s ease infinite}
.sparkle-2{animation:sparkle-b 1.7s .4s ease infinite}
.sparkle-3{animation:sparkle-c 2.4s .8s ease infinite}
.msg-bubble{animation:msg-in .25s ease}
.chat-win{animation:msg-in .2s ease}
.sun-face{animation:sun-glow 3s ease infinite}
`;

const FAB_CSS = `
@keyframes fab-ring-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fab-ring-ping{0%,100%{transform:scale(1);opacity:.35}60%{transform:scale(1.28);opacity:0}}
@keyframes fab-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes fab-tooltip{from{opacity:0;transform:translateY(4px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
.fab-btn:hover{transform:scale(1.1)!important}
.fab-btn:hover .fab-sun{transform:rotate(15deg) scale(1.08)}
.fab-btn:hover .fab-tip{animation:fab-tooltip .15s ease forwards;display:flex!important}
.fab-sun{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
`;

function ChatBot({onClose}){
  const fmtR=v=>`R$${new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2}).format(v)}`;
  const fmtN=v=>new Intl.NumberFormat("pt-BR").format(v);
  const welcomeMsg=`Ola! Sou o **Amar Elo** - sua IA de inteligencia solar da Amara NZero!\n\nTenho acesso completo a todos os dados. Posso responder sobre:\n- **Vendas, faturamento, KPIs** de qualquer periodo\n- **Pedidos por status**, lead time, baixas\n- **Ranking de vendedores** e analise por UF/cidade\n- **Como usar o dashboard**, filtros, upload, export\n- **Insights estrategicos** e recomendacoes\n\nFev/2026: **${fmtN(AI_DATA.finalizados)}** finalizados - **${fmtR(AI_DATA.faturamentoFin)}** - lead **${AI_DATA.leadTimeMedio}d**\n\nO que quer saber?`;
  const [msgs,setMsgs]=useState([{r:"bot",t:welcomeMsg}]);
  const [inp,setInp]=useState("");
  const [load,setLoad]=useState(false);
  const [tab,setTab]=useState("chat");
  const endRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const buildSystem=()=>{
    const fmtR=v=>`R$${new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2}).format(v)}`;
    const fmtN=v=>new Intl.NumberFormat("pt-BR").format(v);
    return "Voce e o Amar Elo, IA de inteligencia logistica e solar da Amara NZero, CD FSA.\nVoce e EXTREMAMENTE inteligente e analitico. Sabe de tudo sobre os dados do dashboard.\n\nDADOS REAIS - FEVEREIRO 2026:\nTotal pedidos: "+fmtN(AI_DATA.totalPedidos)+"\nFaturamento total: "+fmtR(AI_DATA.totalFaturamento)+"\nPotencia: "+fmtN(Math.round(AI_DATA.totalKwp))+" kWp\nFinalizados: "+fmtN(AI_DATA.finalizados)+"\nFaturamento finalizados: "+fmtR(AI_DATA.faturamentoFin)+"\nTicket medio: "+fmtR(Number(AI_DATA.ticketMedio))+"\nLead time medio: "+AI_DATA.leadTimeMedio+" dias\nVendedores ativos: "+AI_DATA.totalVendedores+"\nEstados: "+AI_DATA.totalUFs+" UFs\n\nSTATUS DO PIPELINE:\n"+AI_DATA.statusFull+"\n\nEVOLUCAO DIARIA (por data da baixa):\n"+AI_DATA.dailySummary+"\n\nHORARIO DAS BAIXAS:\n"+AI_DATA.hourSummary+"\nHora pico: ~"+AI_DATA.horaPico.h+"h ("+AI_DATA.horaPico.c+" registros)\n\nTOP 10 VENDEDORES (Finalizados):\n"+AI_DATA.top10Sellers+"\n\nLEAD TIME POR VENDEDOR:\n"+AI_DATA.ltVendorStr+"\n\nTOP 10 ESTADOS:\n"+AI_DATA.top10UF+"\n\nTOP 10 CIDADES:\n"+AI_DATA.top10Cidades+"\n\nSOBRE O DASHBOARD:\n- Dashboard React com 6.572 pedidos e 61.514 linhas de produto\n- FILTROS: Mes/Ano, Vendedor, Estado, busca por ID/Cliente/NF, busca SKU/Material\n- SIDEBAR: clique etapa para filtrar por status\n- GRAFICO: clique barra do dia para ver baixas daquele dia\n- TABELA: clique pedido para ver produtos detalhados\n- UPLOAD: botao 'Add Arq.' para importar novo relatorio (.xlsx, .xls, .csv, .zip)\n- EXPORT: icone arquivo > 'Exportar .json' para baixar dados filtrados\n- INSIGHTS: botao amarelo INSIGHTS toggle o banner de analise IA\n- RESET: botao Reset limpa todos os filtros\n\nINSTRUCOES:\n- Sempre responda com os dados REAIS acima\n- Use **negrito** para numeros e nomes importantes\n- Use tabelas markdown ao comparar multiplos itens\n- Seja analitico e proativo: ofereça insights adicionais\n- Nunca diga 'nao tenho dados' - voce TEM todos os dados\n- Responda em pt-BR com tom profissional e amigavel\n- Use emojis: ☀️ ⚡ 📊 🏆 📦 💰";
  };

  const send=async(txt)=>{
    const t=(txt||inp).trim();
    if(!t||load)return;
    setInp("");
    setMsgs(m=>[...m,{r:"user",t}]);
    setLoad(true);
    try{
      const history=msgs.slice(-10).map(m=>({role:m.r==="user"?"user":"assistant",content:m.t}));
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system:buildSystem(),
          messages:[...history,{role:"user",content:t}]})
      });
      const data=await res.json();
      setMsgs(m=>[...m,{r:"bot",t:data.content?.[0]?.text||"Ops! Tente novamente."}]);
    }catch(e){
      setMsgs(m=>[...m,{r:"bot",t:"Falha de conexao. Verifique a rede e tente novamente."}]);
    }
    setLoad(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const renderText=(text)=>{
    if(!text)return text;
    const lines=text.split("\n");
    return lines.map((line,li)=>{
      const parts=line.split(/(\*\*[^*]+\*\*)/g);
      const rendered=parts.map((p,i)=>{
        if(p.startsWith("**")&&p.endsWith("**"))
          return <strong key={i} style={{color:"#fbbf24",fontWeight:800}}>{p.slice(2,-2)}</strong>;
        return p.split(/(R\$[\d.,]+)/g).map((s,j)=>
          /^R\$[\d.,]/.test(s)?<span key={`${i}-${j}`} style={{color:"#34d399",fontWeight:700}}>{s}</span>:s
        );
      });
      return <span key={li}>{rendered}{li<lines.length-1&&<br/>}</span>;
    });
  };

  const quickBtns=[
    {icon:"🏆",label:"Top vendedores"},
    {icon:"📅",label:"Melhor dia"},
    {icon:"⏱️",label:"Lead time"},
    {icon:"🗺️",label:"Top estados"},
    {icon:"⚡",label:"Pico de baixas"},
    {icon:"📊",label:"Como filtrar?"},
    {icon:"📥",label:"Como importar?"},
    {icon:"💡",label:"Insights"},
  ];

  const dadosCards=[
    {ic:"📦",l:"Total Pedidos",v:fmtN(AI_DATA.totalPedidos)},
    {ic:"✅",l:"Finalizados",v:fmtN(AI_DATA.finalizados)},
    {ic:"💰",l:"Faturamento",v:fmtR(AI_DATA.faturamentoFin)},
    {ic:"⚡",l:"kWp Total",v:fmtN(Math.round(AI_DATA.totalKwp))},
    {ic:"⏱️",l:"Lead Time",v:`${AI_DATA.leadTimeMedio}d`},
    {ic:"🎯",l:"Ticket Medio",v:fmtR(Number(AI_DATA.ticketMedio))},
    {ic:"👥",l:"Vendedores",v:AI_DATA.totalVendedores},
    {ic:"🗺️",l:"Estados",v:AI_DATA.totalUFs},
  ];

  return <><style>{CHAT_CSS}</style>
    <div className="chat-win" style={{position:"fixed",bottom:104,right:24,width:420,height:580,
      background:"linear-gradient(180deg,#060f1c 0%,#040b14 100%)",
      borderRadius:22,display:"flex",flexDirection:"column",overflow:"hidden",
      boxShadow:"0 32px 80px rgba(0,0,0,.95), 0 0 0 1px rgba(5,150,105,.15)",
      border:"1px solid rgba(5,150,105,.2)",zIndex:500}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#064e3b 0%,#065f46 40%,#047857 100%)",
        padding:"14px 16px",flexShrink:0,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-20,width:120,height:120,
          background:"radial-gradient(circle,rgba(251,191,36,.18) 0%,transparent 65%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,position:"relative"}}>
          <div style={{width:50,height:50,borderRadius:"50%",flexShrink:0,background:"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 0 2px rgba(251,191,36,.4), 0 4px 20px rgba(251,191,36,.35)",overflow:"visible"}}>
            <img src={SUN_URL} alt="Amar Elo" className="sun-face" width={46} height={46} style={{objectFit:"contain"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:"#fff",fontWeight:900,fontSize:18}}>Amar Elo</span>
              <span className="sparkle-1" style={{color:"#fbbf24",fontSize:13}}>✦</span>
              <span className="sparkle-2" style={{color:"#fde68a",fontSize:10}}>✦</span>
              <span className="sparkle-3" style={{color:"#fbbf24",fontSize:12}}>✦</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
              <div style={{position:"relative",width:7,height:7}}>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"#86efac",animation:"aura-ping 2s infinite"}}/>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"#22c55e"}}/>
              </div>
              <span style={{color:"rgba(255,255,255,.85)",fontSize:9.5,fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}>SOLAR INTELLIGENCE ASSISTANT</span>
            </div>
          </div>
          <button onClick={onClose}
            style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,.15)",border:"none",
              display:"flex",alignItems:"center",justifyContent:"center",
              cursor:"pointer",color:"#fff",flexShrink:0,fontSize:14,fontWeight:700}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.28)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}>✕</button>
        </div>
        {/* TABS */}
        <div style={{display:"flex",gap:4,marginTop:10}}>
          {[["chat","💬 Chat"],["dados","📊 Dados"],["ajuda","❓ Ajuda"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:"5px 0",background:tab===t?"rgba(255,255,255,.18)":"rgba(255,255,255,.07)",
                border:"none",borderRadius:8,color:tab===t?"#fff":"rgba(255,255,255,.6)",
                fontSize:11,fontWeight:tab===t?800:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: DADOS */}
      {tab==="dados"&&<div style={{flex:1,overflowY:"auto",padding:"14px",
        background:"linear-gradient(180deg,#060f1c,#040b14)",scrollbarWidth:"thin",scrollbarColor:"#1a3a2a transparent"}}>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>
          ☀️ PAINEL DE DADOS — FEV 2026
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {dadosCards.map(({ic,l,v})=>(
            <div key={l} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(5,150,105,.2)",borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:20,marginBottom:4}}>{ic}</div>
              <div style={{color:"#f8fafc",fontSize:15,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{v}</div>
              <div style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>TOP 5 VENDEDORES</div>
        {AI_DATA.top10Sellers.split("\n").slice(0,5).map((s,i)=>(
          <div key={i} style={{padding:"7px 10px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,marginBottom:5,fontSize:11,color:"#94a3b8",fontFamily:"'JetBrains Mono',monospace"}}>{s}</div>
        ))}
        <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginTop:12,marginBottom:8}}>PIPELINE POR STATUS</div>
        {AI_DATA.statusFull.split("\n").slice(0,6).map((s,i)=>(
          <div key={i} style={{padding:"6px 10px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)",borderRadius:7,marginBottom:4,fontSize:11,color:"#94a3b8",fontFamily:"'JetBrains Mono',monospace"}}>{s}</div>
        ))}
      </div>}

      {/* TAB: AJUDA */}
      {tab==="ajuda"&&<div style={{flex:1,overflowY:"auto",padding:"14px",
        background:"linear-gradient(180deg,#060f1c,#040b14)",scrollbarWidth:"thin",scrollbarColor:"#1a3a2a transparent"}}>
        <div style={{color:"#fbbf24",fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>
          📖 GUIA DO DASHBOARD
        </div>
        {[
          {t:"🔍 Filtros",d:"Use o FILTROS bar para filtrar por Mes/Ano, Vendedor, Estado, ID/Cliente/NF ou SKU/Material. Clique Limpar para resetar."},
          {t:"📊 Grafico Diario",d:"Clique em qualquer barra do grafico para ver todas as notas baixadas naquele dia com detalhes completos."},
          {t:"📋 Tabela",d:"Clique em qualquer linha da tabela para ver a composicao de produtos do pedido com SKU, preco e quantidades."},
          {t:"🗂️ Sidebar",d:"Clique em qualquer etapa (Finalizado, Em Transito etc.) para filtrar apenas pedidos daquele status."},
          {t:"📥 Importar",d:"Clique Add Arq. no header. Aceita .xlsx, .xls, .csv e .zip com Excel dentro. Substitui todos os dados."},
          {t:"💾 Exportar",d:"Icone arquivo > Exportar .json salva os dados do mes filtrado como arquivo JSON local."},
          {t:"🔄 Reset",d:"Botao Reset no header limpa todos os filtros e volta ao estado inicial."},
          {t:"💡 Insights IA",d:"Botao INSIGHTS (amarelo) toggle o banner de analise estrategica gerada por IA no topo."},
        ].map(({t,d})=>(
          <div key={t} style={{marginBottom:10,padding:"10px 12px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(5,150,105,.15)",borderRadius:10}}>
            <div style={{color:"#e2e8f0",fontWeight:800,fontSize:12,marginBottom:4}}>{t}</div>
            <div style={{color:"#64748b",fontSize:11,lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>}

      {/* TAB: CHAT */}
      {tab==="chat"&&<>
        <div style={{flex:1,overflowY:"auto",padding:"12px 12px 4px",display:"flex",flexDirection:"column",gap:10,
          background:"linear-gradient(180deg,#060f1c,#040b14)",scrollbarWidth:"thin",scrollbarColor:"#1a3a2a transparent"}}>
          {msgs.map((m,i)=>(
            <div key={i} className="msg-bubble" style={{display:"flex",
              justifyContent:m.r==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
              {m.r==="bot"&&(
                <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,background:"transparent",overflow:"visible",
                  boxShadow:"0 2px 8px rgba(251,191,36,.35)"}}>
                  <img src={SUN_URL} alt="" width={28} height={28} style={{objectFit:"contain",display:"block"}}/>
                </div>
              )}
              <div style={{maxWidth:"80%",padding:"10px 13px",
                borderRadius:m.r==="user"?"14px 14px 4px 14px":"4px 14px 14px 14px",
                background:m.r==="user"?"linear-gradient(135deg,#059669,#047857)":"rgba(255,255,255,.06)",
                border:m.r==="bot"?"1px solid rgba(5,150,105,.2)":"none",
                color:"#f8fafc",fontSize:13,lineHeight:1.65,
                boxShadow:m.r==="user"?"0 4px 16px rgba(5,150,105,.35)":"none"}}>
                {m.r==="user"?<span style={{fontWeight:700}}>{m.t}</span>:renderText(m.t)}
              </div>
            </div>
          ))}
          {load&&(
            <div className="msg-bubble" style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"transparent",overflow:"visible",
                boxShadow:"0 2px 8px rgba(251,191,36,.35)"}}>
                <img src={SUN_URL} alt="" width={28} height={28} style={{objectFit:"contain",display:"block"}}/>
              </div>
              <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(5,150,105,.2)",
                padding:"12px 16px",borderRadius:"4px 14px 14px 14px",display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#059669",animation:`bounce 1.2s ${i*.22}s infinite ease`}}/>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {msgs.length<=2&&<div style={{padding:"6px 12px 4px",display:"flex",gap:5,flexWrap:"wrap",
          background:"linear-gradient(180deg,#060f1c,#040b14)"}}>
          {quickBtns.map(({icon,label})=>(
            <button key={label} onClick={()=>send(label)}
              style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",
                background:"rgba(5,150,105,.08)",border:"1px solid rgba(5,150,105,.22)",
                borderRadius:20,color:"#34d399",fontSize:11,fontWeight:600,cursor:"pointer",
                fontFamily:"'Outfit',sans-serif",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(5,150,105,.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(5,150,105,.08)";}}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>}

        <div style={{padding:"8px 12px 10px",borderTop:"1px solid rgba(5,150,105,.12)",
          background:"linear-gradient(180deg,#060f1c,#040b14)",display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input ref={inputRef} value={inp} onChange={e=>setInp(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="Pergunte sobre vendas, filtros, lead time..."
              style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(5,150,105,.18)",
                borderRadius:12,padding:"9px 14px",color:"#f8fafc",fontSize:13,outline:"none",
                transition:"border .15s",fontFamily:"'Outfit',sans-serif"}}
              onFocus={e=>e.target.style.borderColor="rgba(5,150,105,.6)"}
              onBlur={e=>e.target.style.borderColor="rgba(5,150,105,.18)"}/>
            <button onClick={()=>send()} disabled={load||!inp.trim()}
              style={{width:40,height:40,borderRadius:11,border:"none",
                background:inp.trim()?"linear-gradient(135deg,#059669,#047857)":"rgba(255,255,255,.05)",
                display:"flex",alignItems:"center",justifyContent:"center",
                cursor:inp.trim()?"pointer":"default",opacity:inp.trim()?1:.4,transition:"all .2s",flexShrink:0,
                boxShadow:inp.trim()?"0 4px 14px rgba(5,150,105,.5)":"none"}}>
              <Send size={15} color="#fff"/>
            </button>
          </div>
          <div style={{textAlign:"center",color:"rgba(5,150,105,.4)",fontSize:9,fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}>
            ENERGIA AMARA NZERO
          </div>
        </div>
      </>}
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
// AMAR ELO FAB
// ══════════════════════════════════════════════════════════════
function AmarEloFAB({onClick}){
  return <><style>{FAB_CSS}</style>
    <div style={{position:"fixed",bottom:24,right:24,zIndex:499}}>
      <div style={{position:"absolute",inset:-8,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(251,191,36,.15) 0%,transparent 70%)",
        animation:"fab-ring-ping 2.8s ease infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:-4,borderRadius:"50%",
        border:"1.5px dashed rgba(251,191,36,.35)",
        animation:"fab-ring-spin 12s linear infinite",pointerEvents:"none"}}/>
      <button className="fab-btn" onClick={onClick}
        style={{width:62,height:62,borderRadius:"50%",
          background:"transparent",
          border:"2.5px solid rgba(251,191,36,.6)",
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",transition:"transform .25s cubic-bezier(.34,1.56,.64,1)",
          boxShadow:"0 8px 32px rgba(251,191,36,.3), 0 4px 16px rgba(0,0,0,.5)",
          animation:"fab-float 3.5s ease infinite",position:"relative",overflow:"hidden"}}>
        <img className="fab-sun" src={SUN_URL} alt="Amar Elo"
          width={50} height={50}
          style={{objectFit:"contain",position:"relative",zIndex:1,
            transition:"transform .3s cubic-bezier(.34,1.56,.64,1)",
            filter:"drop-shadow(0 0 8px rgba(251,191,36,.7))"}}/>
        <div className="fab-tip" style={{
          display:"none",position:"absolute",right:74,bottom:"50%",transform:"translateY(50%)",
          background:"rgba(6,15,28,.95)",border:"1px solid rgba(5,150,105,.4)",
          borderRadius:10,padding:"8px 12px",whiteSpace:"nowrap",pointerEvents:"none",
          boxShadow:"0 8px 24px rgba(0,0,0,.6)"}}>
          <div style={{color:"#fff",fontSize:12,fontWeight:800}}>Amar Elo</div>
          <div style={{color:"#34d399",fontSize:10,fontWeight:600,marginTop:1}}>SOLAR INTELLIGENCE</div>
          <div style={{position:"absolute",right:-6,top:"50%",transform:"translateY(-50%)",
            width:0,height:0,borderTop:"6px solid transparent",borderBottom:"6px solid transparent",
            borderLeft:"6px solid rgba(5,150,105,.4)"}}/>
        </div>
      </button>
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
// ORDERS TABLE — tabela principal com todos os filtros
// ══════════════════════════════════════════════════════════════
function OrdersTable({etapa,vendor,state,search,skuSearch,selMonth,liveOrders,liveProducts}){
  const [pg,setPg]=useState(1);
  const [sc,setSc]=useState("de");
  const [sd,setSd]=useState("desc");
  const [selOrder,setSelOrder]=useState(null);
  const PER=12;

  const data=useMemo(()=>{
    const ordSrc=liveOrders||ORDERS;
    let d=ordSrc;
    // filter by month
    if(selMonth) d=d.filter(o=>{
      const key=o[F.st]==="Finalizado"&&o[F.de]?o[F.de].slice(0,7):(o[F.dc]||"").slice(0,7);
      return key===selMonth;
    });
    // filter by etapa
    if(etapa&&etapa!=="all") d=d.filter(o=>o[F.st]===etapa);
    // filter by vendor
    if(vendor) d=d.filter(o=>o[F.vd]===vendor);
    // filter by state
    if(state) d=d.filter(o=>o[F.uf]===state);
    // search
    if(search){
      const q=search.toLowerCase();
      d=d.filter(o=>
        o[F.id].toLowerCase().includes(q)||
        o[F.cl].toLowerCase().includes(q)||
        o[F.nf].toLowerCase().includes(q)||
        o[F.vd].toLowerCase().includes(q)||
        (o[F.ci]||"").toLowerCase().includes(q)
      );
    }
    // sku/material search — look in PRODUCTS
    if(skuSearch){
      const q=skuSearch.toLowerCase();
      d=d.filter(o=>{
        const prodSrc=liveProducts||PRODUCTS;
        const prods=prodSrc[o[F.id]]||[];
        return prods.some(p=>(p[0]||"").toLowerCase().includes(q)||(p[1]||"").toLowerCase().includes(q));
      });
    }
    // sort
    const cmap={de:F.de,df:F.df,vl:F.vl,cl:F.cl,vd:F.vd,uf:F.uf,nf:F.nf};
    const ci=cmap[sc]??F.de;
    d=[...d].sort((a,b)=>{
      let av=a[ci]||"", bv=b[ci]||"";
      if(sc==="vl"){av=a[F.vl]||0;bv=b[F.vl]||0;}
      return sd==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });
    return d;
  },[etapa,vendor,state,search,skuSearch,selMonth,sc,sd]);

  useEffect(()=>setPg(1),[etapa,vendor,state,search,skuSearch,selMonth,sc,sd]);

  const pages=Math.max(1,Math.ceil(data.length/PER));
  const paged=data.slice((pg-1)*PER,pg*PER);

  const SH=({col,l,align="left"})=>(
    <button onClick={()=>{if(sc===col)setSd(d=>d==="asc"?"desc":"asc");else{setSc(col);setSd("desc");}}}
      style={{background:"none",border:"none",color:sc===col?G.green:G.muted,fontSize:10,
        fontWeight:700,letterSpacing:.8,textTransform:"uppercase",cursor:"pointer",
        fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:3,
        justifyContent:align==="right"?"flex-end":"flex-start",width:"100%"}}>
      {l}{sc===col&&<span style={{color:G.green}}>{sd==="asc"?"↑":"↓"}</span>}
    </button>);

  const COLS="1.4fr 2fr 1.6fr 0.85fr 0.65fr 1.15fr 1.25fr 0.55fr";

  return <>
    {selOrder&&<ProductModal order={selOrder} onClose={()=>setSelOrder(null)} liveProducts={liveProducts}/>}
    <div className="card" style={{overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:COLS,padding:"10px 16px",
        borderBottom:`1px solid ${G.border}`,background:"rgba(10,31,56,.8)"}}>
        <SH col="nf" l="NOTA FISCAL"/>
        <SH col="cl" l="CLIENTE"/>
        <SH col="vd" l="VENDEDOR"/>
        <SH col="vl" l="VALOR" align="right"/>
        <SH col="uf" l="UF"/>
        <SH col="df" l="DT. FATURADA"/>
        <SH col="de" l="DT. BAIXA ↓"/>
        <span style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>STATUS</span>
      </div>
      {data.length===0?(
        <div style={{padding:"48px",textAlign:"center",color:G.muted,fontSize:14}}>
          <Search size={32} style={{display:"block",margin:"0 auto 12px",opacity:.3}}/>
          Nenhum pedido encontrado com os filtros aplicados.
        </div>
      ):paged.map((o,i)=>{
        const lt=leadDays(o[F.df],o[F.de]);
        const lc=lt===null?"#475569":lt>30?"#ef4444":lt>14?"#f97316":"#22c55e";
        const sColor=STATUS_COLOR[o[F.st]]||"#64748b";
        return <div key={i} className="rh"
          style={{display:"grid",gridTemplateColumns:COLS,padding:"10px 16px",
            borderBottom:`1px solid #0a1628`,alignItems:"center",
            background:i%2===0?"transparent":"rgba(10,22,40,.25)"}}
          onClick={()=>setSelOrder(o)}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:G.green,fontWeight:800,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{o[F.nf]||"—"}</span>
              {o[F.fi]&&<span style={{background:"#1a2e4a",color:"#93c5fd",fontSize:9,padding:"1px 4px",borderRadius:3,fontWeight:700}}>{o[F.fi]}</span>}
            </div>
            <div style={{color:G.dim,fontSize:10,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o[F.id]}</div>
          </div>
          <span style={{fontSize:12,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={o[F.cl]}>{o[F.cl]}</span>
          <span style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={o[F.vd]}>{o[F.vd]?.split(" ").slice(0,2).join(" ")}</span>
          <span style={{textAlign:"right",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:G.text,fontWeight:700}}>{R$s(o[F.vl])}</span>
          <span style={{textAlign:"center"}}>
            <span style={{background:"#1a2e4a",color:"#94a3b8",fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:5}}>{o[F.uf]||"—"}</span>
          </span>
          <div>
            <div style={{fontSize:11,color:G.muted,fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(o[F.df])}</div>
            <div style={{fontSize:10,color:G.dim,fontFamily:"'JetBrains Mono',monospace"}}>{fmtHora(o[F.df])}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:o[F.de]?G.green:G.dim,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtDate(o[F.de])}</div>
            {o[F.de]&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:1}}>
              <span style={{fontSize:10,color:G.muted,fontFamily:"'JetBrains Mono',monospace"}}>{fmtHora(o[F.de])}</span>
              {lt!==null&&<span style={{fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:3,background:`${lc}18`,color:lc}}>{lt}d</span>}
            </div>}
          </div>
          <div>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:10,
              background:`${sColor}15`,color:sColor,border:`1px solid ${sColor}25`,fontSize:9,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",maxWidth:"100%"}}>
              <span style={{width:4,height:4,borderRadius:"50%",background:sColor,display:"inline-block",flexShrink:0}}/>
              {o[F.st].split(" ").slice(0,2).join(" ")}
            </span>
          </div>
        </div>;
      })}
      {/* Pagination */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderTop:`1px solid ${G.border}`,background:"rgba(10,22,40,.6)"}}>
        <span style={{color:G.muted,fontSize:12}}>{data.length===0?"0":`${(pg-1)*PER+1}–${Math.min(pg*PER,data.length)}`} de {N(data.length)} pedidos</span>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <button onClick={()=>setPg(1)} disabled={pg===1} style={{width:26,height:26,borderRadius:5,background:G.card,border:`1px solid ${G.border}`,cursor:"pointer",color:pg===1?G.dim:G.muted,opacity:pg===1?.4:1,fontSize:10,fontWeight:700}}>«</button>
          <button onClick={()=>setPg(p=>Math.max(1,p-1))} disabled={pg===1} style={{width:26,height:26,borderRadius:5,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:pg===1?G.dim:G.muted,opacity:pg===1?.4:1}}><ChevronLeft size={12}/></button>
          {Array.from({length:pages},(_,i)=>i+1).filter(p=>p===1||p===pages||Math.abs(p-pg)<=2).map((p,idx,arr)=>[
            idx>0&&arr[idx-1]!==p-1?<span key={`e${p}`} style={{color:G.dim,fontSize:11,padding:"0 2px"}}>…</span>:null,
            <button key={p} onClick={()=>setPg(p)} style={{width:26,height:26,borderRadius:5,fontSize:12,fontWeight:700,
              background:pg===p?"rgba(0,229,160,.12)":G.card,border:`1px solid ${pg===p?"#00e5a050":G.border}`,
              color:pg===p?G.green:G.muted,cursor:"pointer"}}>{p}</button>
          ])}
          <button onClick={()=>setPg(p=>Math.min(pages,p+1))} disabled={pg===pages} style={{width:26,height:26,borderRadius:5,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:pg===pages?G.dim:G.muted,opacity:pg===pages?.4:1}}><ChevronRight size={12}/></button>
          <button onClick={()=>setPg(pages)} disabled={pg===pages} style={{width:26,height:26,borderRadius:5,background:G.card,border:`1px solid ${G.border}`,cursor:"pointer",color:pg===pages?G.dim:G.muted,opacity:pg===pages?.4:1,fontSize:10,fontWeight:700}}>»</button>
        </div>
      </div>
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
// CHART TOOLTIP
// ══════════════════════════════════════════════════════════════
function ChartTip({active,payload,label,month}){
  if(!active||!payload?.length)return null;
  const yr=month?month.slice(0,4):"2026";
  const mo=month?month.slice(5,7):"02";
  return <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:10,padding:"10px 14px",fontSize:12}}>
    <div style={{color:G.muted,marginBottom:5,fontWeight:600}}>📅 {label}/{mo}/{yr}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||G.green,fontWeight:700,marginBottom:2}}>
      {p.dataKey==="c"?`📦 ${p.value} notas baixadas`:`💰 ${R$s(p.value)}`}
    </div>)}
    <div style={{color:"#475569",fontSize:10,marginTop:4}}>▶ Clique para ver notas</div>
  </div>;
}

// ══════════════════════════════════════════════════════════════
// UPLOAD MODAL — parse real Excel/ZIP e substitui ORDERS
// ══════════════════════════════════════════════════════════════
// Column indices matching the original Amara NZero Excel export
const COL={id:0,razao:2,cnpj:3,vend:4,cond:11,tipo:12,vl:6,st:17,kwp:19,fil:20,nf:23,uf:31,ci:32,dc:48,df:52,de:57,skuId:59,skuCd:61,skuNm:62,skuPr:63,skuQt:64};

function parseExcelToOrders(workbook){
  const sheetName=workbook.SheetNames.find(n=>n.toLowerCase().includes("sheet")||n==="Sheet1")||workbook.SheetNames[0];
  const ws=workbook.Sheets[sheetName];
  const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""});
  if(rows.length<2)return{orders:[],products:{}};
  const pedidosMap={};const productsMap={};const seenProds={};

  const parseDate=v=>{
    if(!v)return null;const s=String(v).trim();
    for(const fmt of[
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/,
      /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
    ]){
      const m=s.match(fmt);
      if(m){
        if(fmt.source.startsWith("^(\\d{4})-"))return s.slice(0,16);
        if(fmt.source.includes("(\\d{2})\\/(\\d{2})\\/(\\d{4})"))return `${m[3]}-${m[2]}-${m[1]} ${m[4]||"00"}:${m[5]||"00"}`;
        return s;
      }
    }
    const num=parseFloat(s);
    if(!isNaN(num)&&num>40000){
      try{
        const d=window.XLSX.SSF.parse_date_code(num);
        if(d)return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")} ${String(d.H||0).padStart(2,"0")}:${String(d.M||0).padStart(2,"0")}`;
      }catch{}
    }
    return null;
  };

  const pNum=v=>{try{return Math.round(parseFloat(String(v||"0").replace(/[^\d.,]/g,"").replace(",","."))*100)/100;}catch{return 0;}};

  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const pedido=String(r[COL.id]||"").trim();
    if(!pedido)continue;
    if(!pedidosMap[pedido]){
      pedidosMap[pedido]=[
        pedido,                                    // 0 id
        String(r[COL.razao]||"").slice(0,60),       // 1 cliente
        String(r[COL.vend]||"S/ VENDEDOR"),         // 2 vendedor
        pNum(r[COL.vl]),                            // 3 valor
        String(r[COL.st]||""),                      // 4 status
        pNum(r[COL.kwp]),                           // 5 kwp
        String(r[COL.fil]||"FSA"),                  // 6 filial
        String(r[COL.uf]||""),                      // 7 uf
        String(r[COL.ci]||""),                      // 8 cidade
        String(r[COL.nf]||""),                      // 9 nota_fiscal
        String(r[COL.cnpj]||""),                    // 10 cnpj
        String(r[COL.cond]||""),                    // 11 cond_pag
        String(r[COL.tipo]||""),                    // 12 tipo_venda
        parseDate(r[COL.de]),                       // 13 dt_entrega (baixa)
        parseDate(r[COL.df]),                       // 14 dt_faturada
        parseDate(r[COL.dc])?.slice(0,10)||null,    // 15 dt_criacao
      ];
      seenProds[pedido]=new Set();
    }
    const cod=String(r[COL.skuCd]||"").trim();
    const nome=String(r[COL.skuNm]||"").trim();
    const pu=pNum(r[COL.skuPr]),qt=pNum(r[COL.skuQt]);
    if(cod||nome){
      const key=`${cod}|${nome}|${pu}|${qt}`;
      if(!seenProds[pedido].has(key)){
        seenProds[pedido].add(key);
        if(!productsMap[pedido])productsMap[pedido]=[];
        productsMap[pedido].push([cod,nome.slice(0,60),pu,qt,Math.round(pu*qt*100)/100]);
      }
    }
  }
  return{orders:Object.values(pedidosMap),products:productsMap};
}

function UploadModal({onClose,onDataLoaded}){
  const [drag,setDrag]=useState(false);
  const [file,setFile]=useState(null);
  const [status,setStatus]=useState(null);
  const [progress,setProgress]=useState(0);
  const [stats,setStats]=useState(null);
  const [errMsg,setErrMsg]=useState("");
  const inputRef=useRef(null);

  const loadLib=url=>new Promise((res,rej)=>{
    const id="lib-"+url.split("/").pop();
    if(document.getElementById(id)){res();return;}
    const s=document.createElement("script");s.id=id;s.src=url;s.onload=res;s.onerror=rej;document.head.appendChild(s);
  });

  const handleFile=f=>{
    if(!f)return;
    const ext=f.name.toLowerCase().split(".").pop();
    if(!["xlsx","xls","csv","zip"].includes(ext)){setErrMsg("Formato não suportado. Use .xlsx, .xls, .csv ou .zip");setStatus("error");return;}
    setFile(f);setStatus(null);setErrMsg("");setStats(null);setProgress(0);
  };

  const process=async()=>{
    if(!file||["processing","parsing","done"].includes(status))return;
    setStatus("processing");setProgress(8);
    try{
      await loadLib("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      setProgress(22);
      const ext=file.name.toLowerCase().split(".").pop();
      let workbook=null;
      if(ext==="zip"){
        await loadLib("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
        setProgress(35);
        const zipBuf=await file.arrayBuffer();
        const zip=await window.JSZip.loadAsync(zipBuf);
        setProgress(55);
        const entry=Object.values(zip.files).find(f=>!f.dir&&/\.(xlsx|xls|csv)$/i.test(f.name));
        if(!entry)throw new Error("Nenhum arquivo .xlsx/.xls/.csv encontrado dentro do ZIP");
        const buf=await entry.async("arraybuffer");
        workbook=window.XLSX.read(buf,{type:"array",cellDates:false,raw:false});
        setProgress(75);
      }else if(ext==="csv"){
        const text=await file.text();setProgress(45);
        workbook=window.XLSX.read(text,{type:"string"});setProgress(75);
      }else{
        const buf=await file.arrayBuffer();setProgress(50);
        workbook=window.XLSX.read(buf,{type:"array",cellDates:false,raw:false});setProgress(75);
      }
      setStatus("parsing");setProgress(82);
      await new Promise(r=>setTimeout(r,60));
      const{orders,products}=parseExcelToOrders(workbook);
      setProgress(95);
      if(orders.length===0)throw new Error("Nenhum pedido encontrado. Verifique se o arquivo contém a coluna Pedido na coluna A.");
      const totalV=orders.reduce((a,o)=>a+o[3],0);
      const finCount=orders.filter(o=>o[4]==="Finalizado").length;
      setStats({count:orders.length,finCount,totalV,added:0,updated:0,unchanged:0,total:orders.length});
      setProgress(100);setStatus("done");
      setTimeout(()=>{
        if(onDataLoaded){
          const result=onDataLoaded({orders,products,fileName:file.name});
          if(result){setStats(s=>({...s,added:result.added,updated:result.updated,unchanged:result.unchanged,total:result.total,totalV:result.totalV}));}
        }
      },800);
    }catch(e){
      setErrMsg(e.message||"Erro ao processar arquivo");
      setStatus("error");setProgress(0);
    }
  };

  const fmtSize=b=>b>1e6?`${(b/1e6).toFixed(1)} MB`:b>1e3?`${(b/1e3).toFixed(0)} KB`:`${b} B`;
  const extIcon={"xlsx":"📊","xls":"📊","csv":"📋","zip":"📦"};
  const ext=file?file.name.split(".").pop().toLowerCase():"";
  const progressLabel={"processing":"Lendo arquivo...","parsing":"Extraindo pedidos e produtos...","done":"✅ Processado!","error":"❌ Erro"}[status]||"";

  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal" style={{width:560,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0f2a4a 0%,#0d1f38 100%)",padding:"20px 24px",display:"flex",alignItems:"center",gap:14,flexShrink:0,borderBottom:"1px solid rgba(0,229,160,.15)"}}>
        <div style={{width:48,height:48,borderRadius:13,flexShrink:0,background:"linear-gradient(135deg,rgba(0,194,123,.2),rgba(0,229,160,.08))",border:"1px solid rgba(0,229,160,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>📥</div>
        <div style={{flex:1}}>
          <div style={{color:"#f8fafc",fontSize:16,fontWeight:800,marginBottom:2}}>Importar Relatório de Pedidos</div>
          <div style={{color:"#64748b",fontSize:12}}>Extrai pedidos · produtos · status · baixas em tempo real</div>
        </div>
        <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"#94a3b8",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.12)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>✕</button>
      </div>
      <div style={{padding:"22px 24px",overflowY:"auto",flex:1}}>
        {/* Format chips */}
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          {[["xlsx","📊","Excel .xlsx","✓ Recomendado"],["xls","📊","Excel .xls",null],["csv","📋","CSV",null],["zip","📦","ZIP + Excel",null]].map(([e,ic,l,badge])=>(
            <div key={e} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:ext===e?"rgba(0,229,160,.1)":"rgba(255,255,255,.03)",border:`1.5px solid ${ext===e?G.green:"rgba(255,255,255,.07)"}`,borderRadius:10,color:ext===e?G.green:"#64748b",fontSize:12,fontWeight:600,transition:"all .2s"}}>
              <span style={{fontSize:14}}>{ic}</span><span>.{e}</span>
              {badge&&<span style={{fontSize:9,fontWeight:800,background:ext===e?"rgba(0,229,160,.15)":"rgba(255,255,255,.06)",color:ext===e?G.green:"#475569",padding:"1px 5px",borderRadius:4}}>{badge}</span>}
            </div>
          ))}
        </div>
        {/* Drop zone */}
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
          onClick={()=>!file&&inputRef.current?.click()}
          style={{border:`2px dashed ${drag?"#60a5fa":file?"#00e5a0":"rgba(255,255,255,.1)"}`,borderRadius:16,padding:"30px 24px",textAlign:"center",cursor:file?"default":"pointer",background:drag?"rgba(59,130,246,.06)":file?"rgba(0,229,160,.04)":"rgba(255,255,255,.02)",transition:"all .2s",marginBottom:18}}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.zip" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          {file?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
              <div style={{fontSize:48,filter:"drop-shadow(0 0 12px rgba(0,229,160,.4))"}}>{extIcon[ext]||"📄"}</div>
              <div style={{color:G.green,fontWeight:800,fontSize:15}}>{file.name}</div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{background:"rgba(0,229,160,.1)",border:"1px solid rgba(0,229,160,.2)",color:G.green,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{ext.toUpperCase()}</span>
                <span style={{color:G.muted,fontSize:12}}>{fmtSize(file.size)}</span>
              </div>
              <button onClick={e=>{e.stopPropagation();setFile(null);setStatus(null);setStats(null);setProgress(0);setErrMsg("");}}
                style={{padding:"5px 14px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",borderRadius:8,color:"#f87171",fontSize:12,cursor:"pointer",fontWeight:600}}>
                🔄 Trocar arquivo
              </button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{fontSize:52,marginBottom:4,filter:"drop-shadow(0 4px 12px rgba(59,130,246,.3))"}}>☁️</div>
              <div style={{color:"#f8fafc",fontSize:15,fontWeight:700}}>Arraste ou clique para selecionar</div>
              <div style={{color:"#64748b",fontSize:13}}>Relatório de Pedidos exportado do sistema</div>
              <div style={{color:"#334155",fontSize:11,marginTop:2}}>Aceita .xlsx · .xls · .csv · .zip (com Excel dentro)</div>
            </div>
          )}
        </div>
        {/* Progress */}
        {["processing","parsing","done"].includes(status)&&(
          <div style={{marginBottom:16,padding:"14px 16px",background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.2)",borderRadius:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{color:status==="done"?G.green:"#93c5fd",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
                {status==="done"?"✅":<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#3b82f6",animation:"aura-ping 1s infinite"}}/>}
                {progressLabel}
              </span>
              <span style={{color:G.muted,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{progress}%</span>
            </div>
            <div style={{height:8,background:"rgba(255,255,255,.05)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:4,background:status==="done"?"linear-gradient(90deg,#00c27b,#00e5a0)":"linear-gradient(90deg,#2563eb,#60a5fa)",width:`${progress}%`,transition:"width .5s ease",boxShadow:status==="done"?"0 0 10px rgba(0,229,160,.5)":"0 0 10px rgba(59,130,246,.4)"}}/>
            </div>
          </div>
        )}
        {/* Error */}
        {status==="error"&&(
          <div style={{padding:"14px 16px",background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.25)",borderRadius:12,color:"#f87171",fontSize:13,marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>⚠️</span>
            <div><div style={{fontWeight:700,marginBottom:2}}>Erro ao processar arquivo</div><div style={{color:"#fca5a5",fontSize:12}}>{errMsg}</div></div>
          </div>
        )}
        {/* Success stats */}
        {status==="done"&&stats&&(
          <div style={{padding:"16px 18px",background:"rgba(0,229,160,.06)",border:"1px solid rgba(0,229,160,.2)",borderRadius:14,marginBottom:12}}>
            <div style={{color:G.green,fontWeight:800,fontSize:14,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>✅</span> Merge concluído com sucesso!
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {[
                {l:"NOVOS",v:new Intl.NumberFormat("pt-BR").format(stats.added||0),ic:"➕",col:"#34d399"},
                {l:"ATUALIZADOS",v:new Intl.NumberFormat("pt-BR").format(stats.updated||0),ic:"🔄",col:"#60a5fa"},
                {l:"INALTERADOS",v:new Intl.NumberFormat("pt-BR").format(stats.unchanged||0),ic:"✓",col:"#94a3b8"},
                {l:"TOTAL GERAL",v:new Intl.NumberFormat("pt-BR").format(stats.total||0),ic:"📦",col:G.green},
              ].map(({l,v,ic,col})=>(
                <div key={l} style={{background:"rgba(0,229,160,.05)",border:"1px solid rgba(0,229,160,.1)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:16,marginBottom:3}}>{ic}</div>
                  <div style={{color:col,fontSize:15,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
                  <div style={{color:G.muted,fontSize:8,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"rgba(0,229,160,.04)",borderRadius:8,border:"1px solid rgba(0,229,160,.1)"}}>
              <span style={{color:G.muted,fontSize:12}}>Faturamento total na base</span>
              <span style={{color:G.green,fontWeight:800,fontSize:13,fontFamily:"'JetBrains Mono',monospace"}}>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(stats.totalV||0)}</span>
            </div>
          </div>
        )}
        {/* Column guide */}
        {!file&&<div style={{padding:"12px 14px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,marginBottom:16}}>
          <div style={{color:"#475569",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>📋 COLUNAS ESPERADAS NO RELATÓRIO</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {["Pedido(A)","Razão Social(C)","Vendedor(E)","Valor(G)","Status(R)","NF(X)","Estado(AF)","Dt.Criação(AW)","Dt.Faturada(BA)","Dt.Baixa(BF)","SKU Nome(BK)","SKU Qtd(BM)"].map(c=>(
              <span key={c} style={{padding:"2px 8px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:4,color:"#475569",fontSize:10,fontWeight:600}}>{c}</span>
            ))}
          </div>
        </div>}
        {/* Buttons */}
        <div style={{display:"flex",gap:10}}>
          {status==="done"?(
            <button onClick={onClose}
              style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#059669,#047857)",border:"none",borderRadius:11,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Outfit',sans-serif",boxShadow:"0 4px 18px rgba(5,150,105,.4)"}}>
              ✅ Ver Dashboard Atualizado
            </button>
          ):(
            <>
            <button onClick={onClose} style={{flex:1,padding:"11px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:11,color:"#94a3b8",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.18)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.08)"}>Cancelar</button>
            <button onClick={process} disabled={!file||["processing","parsing"].includes(status)}
              style={{flex:2,padding:"11px",border:"none",borderRadius:11,color:"#fff",fontSize:13,fontWeight:800,cursor:file&&!["processing","parsing"].includes(status)?"pointer":"default",fontFamily:"'Outfit',sans-serif",transition:"all .25s",background:file&&!["processing","parsing"].includes(status)?"linear-gradient(135deg,#059669,#047857)":"rgba(255,255,255,.04)",opacity:file?1:.4,boxShadow:file&&!["processing","parsing"].includes(status)?"0 4px 18px rgba(5,150,105,.35)":"none"}}
              onMouseEnter={e=>{if(file&&!["processing","parsing"].includes(status))e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
              {status==="processing"||status==="parsing"?"⏳ Processando dados...":"📥 Fazer Merge & Importar"}
            </button>
            </>
          )}
        </div>
      </div>
    </div>
  </div>;
}

export default function Dashboard(){
  const [etapa,setEtapa]=useState("all");
  // ── DADOS DINÂMICOS (substituídos pelo upload) ─────────────
  const [liveOrders,setLiveOrders]=useState(loadCache()||ORDERS);
  const [liveProducts,setLiveProducts]=useState(PRODUCTS);
  const [uploadedFile,setUploadedFile]=useState(null);

  const handleDataLoaded=({orders,products,fileName,mergeMode})=>{
    // ── MERGE INTELIGENTE ────────────────────────────────────────
    // Deduplica por ID de pedido. Se o pedido já existe:
    //   - atualiza status (status mais recente vence)
    //   - atualiza dt_entrega, dt_faturada se veio preenchido
    //   - mantém valor, vendedor, demais campos originais
    // Se é novo: adiciona ao final.
    const existingMap={};
    liveOrders.forEach(o=>{ existingMap[o[0]]=o; });

    let added=0, updated=0, unchanged=0;
    orders.forEach(newO=>{
      const id=newO[0];
      if(existingMap[id]){
        const old=existingMap[id];
        let changed=false;
        // Update status if changed
        if(newO[4] && newO[4]!==old[4]){ old[4]=newO[4]; changed=true; }
        // Update dt_entrega (baixa) if newly filled
        if(newO[13] && !old[13]){ old[13]=newO[13]; changed=true; }
        // Update dt_faturada if newly filled
        if(newO[14] && !old[14]){ old[14]=newO[14]; changed=true; }
        // Update nota fiscal if newly filled
        if(newO[9] && !old[9]){ old[9]=newO[9]; changed=true; }
        // Update kwp if was 0
        if(newO[5]>0 && old[5]===0){ old[5]=newO[5]; changed=true; }
        if(changed) updated++; else unchanged++;
      } else {
        existingMap[id]=newO;
        added++;
      }
    });

    // Merge products too
    const mergedProds={...liveProducts};
    Object.keys(products).forEach(id=>{
      if(!mergedProds[id] || mergedProds[id].length===0) mergedProds[id]=products[id];
    });

    const mergedOrders=Object.values(existingMap);
    setLiveOrders(mergedOrders);
    saveCache(mergedOrders);
    setLiveProducts(mergedProds);
    setUploadedFile(prev=>prev?`${prev} + ${fileName}`:fileName);
    // Sync to Supabase in background
    if(changedOrders.length>0){
      sbUpsertOrders(changedOrders).catch(console.error);
      if(Object.keys(mergedProds).length>0) sbUpsertProducts(mergedProds).catch(console.error);
    }
    // Reset filters
    setEtapa("all");
    setVendor(null);
    setState(null);
    setSearch("");
    setSkuSearch("");
    console.log(`📊 Merge: +${added} novos, ${updated} atualizados, ${unchanged} inalterados`);
    // Set month to most recent available
    const months=[...new Set(mergedOrders.map(o=>{
      const key=o[4]==="Finalizado"&&o[13]?o[13].slice(0,7):(o[15]||"").slice(0,7);
      return key;
    }).filter(Boolean))].sort().reverse();
    if(months[0]) setSelMonth(months[0]);
    // Return merge stats to modal
    const totalV=mergedOrders.reduce((a,o)=>a+o[3],0);
    return {added,updated,unchanged,total:mergedOrders.length,totalV};
  };


  // ── SUPABASE: Carrega pedidos na montagem ────────────────────
  useEffect(()=>{
    const cached=loadCache();
    if(cached&&cached.length>0) setLiveOrders(cached);
    sbFetchAllOrders().then(data=>{
      if(data&&data.length>0){ setLiveOrders(data); saveCache(data); }
    }).catch(console.error);
  },[]);

  // ── COMPUTED FROM LIVE DATA ─────────────────────────────────
  const MONTH_DATA = useMemo(()=>{
    const map={};
    liveOrders.forEach(o=>{
      const key=o[F.st]==="Finalizado"&&o[F.de]?o[F.de].slice(0,7):(o[F.dc]||"").slice(0,7);
      if(!key||key.length<7) return;
      if(!map[key]) map[key]={ym:key,c:0,v:0,kw:0};
      map[key].c++; map[key].v+=o[F.vl]; map[key].kw+=o[F.kw];
    });
    return map;
  },[liveOrders]);

  const AVAILABLE_MONTHS = useMemo(()=>
    [...new Set(liveOrders.map(o=>{
      const key=o[F.st]==="Finalizado"&&o[F.de]?o[F.de].slice(0,7):(o[F.dc]||"").slice(0,7);
      return key;
    }).filter(Boolean))].sort().reverse()
  ,[liveOrders]);


  const [sbOpen,setSbOpen]=useState(true);
  const [chatOpen,setChatOpen]=useState(false);
  const [sellOpen,setSellOpen]=useState(false);
  const [dayModal,setDayModal]=useState(null);
  const [vendor,setVendor]=useState(null);
  const [state,setState]=useState(null);
  const [search,setSearch]=useState("");
  const [skuSearch,setSkuSearch]=useState("");
  const [selMonth,setSelMonth]=useState("2026-02"); // default Fev 2026
  const [showUpload,setShowUpload]=useState(false);
  const [showInsight,setShowInsight]=useState(true);
  const [backupMenu,setBackupMenu]=useState(false);
  const [darkMode,setDarkMode]=useState(true); // default dark
  const backupRef=useRef(null);

  // Close backup menu on outside click
  useEffect(()=>{
    const h=e=>{if(backupRef.current&&!backupRef.current.contains(e.target))setBackupMenu(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  // ── FILTERED ORDERS BY MONTH ──────────────────────────────
  const filteredByMonth = useMemo(()=>{
    if(!selMonth) return liveOrders;
    return liveOrders.filter(o=>{
      const key = o[F.st]==="Finalizado"&&o[F.de] ? o[F.de].slice(0,7) : (o[F.dc]||"").slice(0,7);
      return key===selMonth;
    });
  },[selMonth]);

  const filteredFin = useMemo(()=>filteredByMonth.filter(o=>o[F.st]==="Finalizado"),[filteredByMonth]);

  // ── KPIs REATIVOS AO MÊS ─────────────────────────────────
  const kpis = useMemo(()=>{
    const fin=filteredFin;
    let ltSum=0,ltCnt=0;
    fin.forEach(o=>{const lt=leadDays(o[F.df],o[F.de]);if(lt!==null&&lt>=0&&lt<=365){ltSum+=lt;ltCnt++;}});
    const totalV=filteredByMonth.reduce((a,o)=>a+o[F.vl],0);
    const totalKwp=filteredByMonth.reduce((a,o)=>a+o[F.kw],0);
    const finV=fin.reduce((a,o)=>a+o[F.vl],0);
    // Compare with prev month
    const [yr,mo]=selMonth.split("-").map(Number);
    const prevMo=mo===1?`${yr-1}-12`:`${yr}-${String(mo-1).padStart(2,"0")}`;
    const prev=MONTH_DATA[prevMo];
    const diffPct=prev&&prev.c>0?Math.round(((fin.length-prev.c)/prev.c)*100):null;
    // daily for chart
    const daily={};
    fin.forEach(o=>{if(o[F.de]&&o[F.de].startsWith(selMonth)){const d=o[F.de].slice(8,10);if(!daily[d])daily[d]={d,c:0,v:0};daily[d].c++;daily[d].v+=o[F.vl];}});
    const dailyArr=Object.values(daily).sort((a,b)=>a.d.localeCompare(b.d));
    // sellers
    const vMap={};
    fin.forEach(o=>{const v=o[F.vd]||"S/ VENDEDOR";if(!vMap[v])vMap[v]={n:v,c:0,v:0};vMap[v].c++;vMap[v].v+=o[F.vl];});
    const sellers=Object.values(vMap).sort((a,b)=>b.v-a.v);
    // states
    const ufMap={};
    fin.forEach(o=>{const u=o[F.uf]||"?";if(!ufMap[u])ufMap[u]={uf:u,c:0,v:0};ufMap[u].c++;ufMap[u].v+=o[F.vl];});
    const estados=Object.values(ufMap).sort((a,b)=>b.c-a.c);
    return {count:filteredByMonth.length,finCount:fin.length,totalV,finV,totalKwp,
      lt:ltCnt>0?(ltSum/ltCnt).toFixed(1):null,
      diffPct,prevMo,
      dailyArr,sellers,estados};
  },[filteredByMonth,filteredFin,selMonth]);

  // ── STATUS COUNTS FOR CURRENT MONTH ──────────────────────
  const monthStatusCounts = useMemo(()=>{
    const m={};
    filteredByMonth.forEach(o=>{if(!m[o[F.st]])m[o[F.st]]={count:0,valor:0,kwp:0};m[o[F.st]].count++;m[o[F.st]].valor+=o[F.vl];m[o[F.st]].kwp+=o[F.kw];});
    return m;
  },[filteredByMonth]);

  const reset=()=>{setVendor(null);setState(null);setSearch("");setSkuSearch("");};
  const setEtapaReset=id=>{setEtapa(id);reset();};

  // ── MONTH SELECTOR ────────────────────────────────────────
  const selYear=selMonth.slice(0,4);
  const isImported=!!uploadedFile;
  const selMonthNum=parseInt(selMonth.slice(5,7));
  const selMonthName=MONTH_NAMES[selMonthNum-1];
  const availableYears=[...new Set(AVAILABLE_MONTHS.map(m=>m.slice(0,4)))].sort().reverse();
  const monthsForYear=AVAILABLE_MONTHS.filter(m=>m.startsWith(selYear));

  // ── EXPORT JSON ───────────────────────────────────────────
  const exportJSON=()=>{
    const data={exportDate:new Date().toISOString(),month:selMonth,orders:filteredByMonth,kpis};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`amara-nzero-${selMonth}.json`;a.click();
  };

  const SC=["#00e5a0","#7fff00","#00cfff","#4f8ef7","#a78bfa"];
  const maxSV=useMemo(()=>Math.max(...kpis.sellers.slice(0,5).map(s=>s.v),1),[kpis.sellers]);

  return <>
    <style>{CSS}</style>
    <style>{`@keyframes progress{from{width:0}to{width:100%}}`}</style>
    <style>{`:root{${darkMode?DARK_THEME:LIGHT_THEME}}
    body{background:var(--g-bg)!important;}
    *{transition:background-color .25s ease,border-color .25s ease,color .18s ease;}
    `}</style>
    {showUpload&&<UploadModal onClose={()=>setShowUpload(false)} onDataLoaded={handleDataLoaded}/>}

    <div style={{display:"flex",height:"100vh",background:G.bg,overflow:"hidden",fontFamily:"'Outfit',sans-serif"}}>

      {/* SIDEBAR */}
      {sbOpen&&<aside style={{width:252,flexShrink:0,background:G.panel,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:11,background:G.grad,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(0,194,123,.35)",flexShrink:0}}>
            <Zap size={19} color="#fff"/>
          </div>
          <div>
            <div style={{color:G.text,fontSize:14,fontWeight:800,lineHeight:1.2}}>Amara NZero</div>
            <div style={{color:G.muted,fontSize:10}}>Solar CD FSA · {selYear}</div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 8px",scrollbarWidth:"none"}}>
          <div style={{color:"#334155",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"6px 12px 10px"}}>Pipeline de Pedidos</div>
          {ETAPAS.map(e=>{
            const Ic=e.ic, active=etapa===e.id;
            const cnt=e.id==="all"?filteredByMonth.length:(monthStatusCounts[e.id]?.count||0);
            return <button key={e.id} className={`sbi${active?" active":""}`}
              onClick={()=>setEtapaReset(e.id)}
              style={{borderLeftColor:active?e.co:"transparent",background:active?`${e.co}10`:"transparent"}}>
              <div style={{width:30,height:30,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:active?`${e.co}20`:"rgba(255,255,255,.04)"}}>
                <Ic size={14} color={active?e.co:G.muted}/>
              </div>
              <span style={{flex:1,fontSize:12.5,fontWeight:active?700:500,color:active?G.text:G.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.lb}</span>
              <span style={{fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:active?e.co:G.dim,background:active?`${e.co}15`:"rgba(255,255,255,.04)",padding:"2px 7px",borderRadius:6,flexShrink:0}}>{N(cnt)}</span>
            </button>;
          })}
        </div>
        <div style={{padding:"10px 16px",borderTop:`1px solid ${G.border}`,color:"#1a2e4a",fontSize:10,textAlign:"center",letterSpacing:1}}>✦ AMARA NZERO · FSA · {selMonthName.toUpperCase()} {selYear}</div>
      </aside>}

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

        {/* ── HEADER ── */}
        <header style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",background:G.panel,borderBottom:`1px solid ${G.border}`,flexShrink:0,flexWrap:"nowrap"}}>
          <button onClick={()=>setSbOpen(v=>!v)} style={{width:32,height:32,borderRadius:8,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:G.muted,cursor:"pointer",flexShrink:0,transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.muted}}>
            {sbOpen?<ChevronLeft size={15}/>:<Menu size={15}/>}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9,marginRight:6}}>
            <div style={{width:34,height:34,borderRadius:10,background:G.grad,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,194,123,.3)",flexShrink:0}}><Zap size={17} color="#fff"/></div>
            <div>
              <div style={{color:G.text,fontSize:13,fontWeight:800,lineHeight:1.2,whiteSpace:"nowrap"}}>Dashboard Mensal de Pedidos Finalizados</div>
              <div style={{color:G.muted,fontSize:10}}>AMARA NZERO SOLAR · CD FSA</div>
            </div>
          </div>
          <div style={{flex:1}}/>
          {/* INSIGHTS */}
          <button onClick={()=>setShowInsight(v=>!v)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",background:"linear-gradient(135deg,#92400e,#78350f)",border:"1px solid #b45309",borderRadius:20,color:"#fde68a",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
            <Star size={10} fill="#fde68a"/> INSIGHTS
          </button>
          {/* MB */}
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",background:G.card,border:`1px solid ${G.border}`,borderRadius:20,color:G.muted,fontSize:11,flexShrink:0}}>
            <BarChart3 size={10} color={G.green}/> {(5.5).toFixed(1)} MB
          </div>
          {/* NUVEM ATIVA */}
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",background:"rgba(0,194,123,.1)",border:`1px solid ${G.green}`,borderRadius:20,color:G.green,fontSize:11,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>
            <Cloud size={10}/> NUVEM ATIVA
          </div>
          {isImported&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.35)",borderRadius:20,color:"#fbbf24",fontSize:11,fontWeight:700,flexShrink:0,maxWidth:180,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}} title={uploadedFile}>
            <Upload size={10}/> {uploadedFile?.split("/").pop()?.slice(0,22)||"Importado"}
          </div>}
          {/* History */}
          <button style={{width:30,height:30,borderRadius:7,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:G.muted,cursor:"pointer",flexShrink:0,transition:"border .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=G.green}
            onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
            <RefreshCw size={12}/>
          </button>
          {/* Backup/Export dropdown */}
          <div ref={backupRef} style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setBackupMenu(v=>!v)}
              style={{width:30,height:30,borderRadius:7,background:backupMenu?"rgba(0,229,160,.1)":G.card,
                border:`1px solid ${backupMenu?G.green:G.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:backupMenu?G.green:G.muted,cursor:"pointer",transition:"all .15s"}}>
              <FileText size={12}/>
            </button>
            {backupMenu&&<div style={{position:"absolute",top:"calc(100%+6px)",right:0,background:"#0c1e35",border:`1px solid ${G.border}`,borderRadius:12,minWidth:180,zIndex:400,boxShadow:"0 16px 40px rgba(0,0,0,.7)",overflow:"hidden"}}>
              <div style={{padding:"8px 14px 4px",color:G.dim,fontSize:9,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>BACKUPS MANUAIS</div>
              <button onClick={()=>{exportJSON();setBackupMenu(false);}}
                style={{width:"100%",padding:"10px 16px",background:"transparent",border:"none",color:G.text,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"'Outfit',sans-serif",textAlign:"left",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <FileText size={14} color={G.muted}/> Exportar .json
              </button>
              <button onClick={()=>{setShowUpload(true);setBackupMenu(false);}}
                style={{width:"100%",padding:"10px 16px",background:"transparent",border:"none",color:G.green,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"'Outfit',sans-serif",textAlign:"left",fontWeight:600,borderTop:`1px solid ${G.border}`,transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(0,229,160,.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Upload size={14} color={G.green}/> Importar de Arquivo
              </button>
            </div>}
          </div>
          {/* Add Arq */}
          <button onClick={()=>setShowUpload(true)}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:G.card,border:`1px solid ${G.border}`,borderRadius:7,color:G.muted,fontSize:12,cursor:"pointer",transition:"border .15s",flexShrink:0,whiteSpace:"nowrap"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.muted;}}>
            <Plus size={11} color={G.green}/> Add Arq.
          </button>
          {/* Reset */}
          <button onClick={()=>{reset();setEtapa("all");}}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:7,color:"#f87171",fontSize:12,cursor:"pointer",transition:"border .15s",flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#f87171"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(239,68,68,.25)"}>
            Reset
          </button>
          {/* Sun/Moon toggle */}
          <button onClick={()=>setDarkMode(d=>!d)}
            title={darkMode?"Modo Claro":"Modo Escuro"}
            style={{width:30,height:30,borderRadius:7,background:G.card,border:`1px solid ${G.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:darkMode?"#fbbf24":"#475569",flexShrink:0,transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.1)";e.currentTarget.style.borderColor=darkMode?"rgba(251,191,36,.5)":"rgba(5,150,105,.5)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.borderColor="";}}>
            {darkMode
              ? <Sun size={13} color="#fbbf24"/>
              : <span style={{fontSize:13,lineHeight:1}}>🌙</span>
            }
          </button>
        </header>
        </header>

        {/* ── MAIN ── */}
        <main style={{flex:1,overflowY:"auto",padding:"14px 18px",scrollbarWidth:"thin",scrollbarColor:"#1a2e4a transparent"}}>

          {/* ── INSIGHT ESTRATÉGICO ── */}
          {showInsight&&<div style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 18px",
            background:"rgba(10,22,40,.9)",border:`1px solid ${G.border}`,
            borderRadius:14,marginBottom:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:0,top:0,bottom:0,width:200,
              background:"radial-gradient(ellipse at right center,rgba(0,229,160,.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
            <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#92400e,#78350f)",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px rgba(180,83,9,.35)"}}>
              <Activity size={18} color="#fde68a"/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{color:"#fde68a",fontSize:11,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>INSIGHT ESTRATÉGICO IA</span>
                <span style={{background:"rgba(251,191,36,.15)",border:"1px solid rgba(251,191,36,.3)",color:"#fbbf24",fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,letterSpacing:1}}>Amar Elo INSIGHT</span>
              </div>
              <p style={{color:"#94a3b8",fontSize:12,lineHeight:1.6,margin:0}}>
                O ticket médio de {R$s(Number(AI_DATA.ticketMedio))} em <strong style={{color:"#fde68a"}}>{selMonthName} {selYear}</strong> com {N(kpis.finCount)} pedidos finalizados
                indica uma base sólida. O lead time de <strong style={{color:G.green}}>{kpis.lt||"—"} dias</strong> (Dt.Faturada→Baixa)
                é estratégico para o giro de capital. <strong style={{color:"#fde68a"}}>{kpis.sellers[0]?.n?.split(" ").slice(0,2).join(" ")||"Top vendedor"}</strong> lidera
                com {R$s(kpis.sellers[0]?.v||0)} — mapear suas táticas pode elevar a produtividade da equipe.
              </p>
            </div>
            <button onClick={()=>setShowInsight(false)} style={{background:"none",border:"none",color:G.muted,cursor:"pointer",padding:4,flexShrink:0}}>
              <X size={14}/>
            </button>
          </div>}

          {/* ── FILTER BAR ── */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
            background:G.panel,border:`1px solid ${G.border}`,borderRadius:12,marginBottom:14,flexWrap:"wrap"}}>
            <button style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:G.card,
              border:`1px solid ${G.border}`,borderRadius:8,color:G.muted,fontSize:13,cursor:"pointer",fontWeight:600}}>
              <Filter size={13} color={G.green}/> FILTROS
            </button>
            <div style={{width:1,height:22,background:G.border}}/>

            {/* ── YEAR dropdown ── */}
            <DD label={selYear} opts={availableYears} val={selYear}
              onChange={yr=>{
                const firstMonthOfYear=AVAILABLE_MONTHS.find(m=>m.startsWith(yr));
                if(firstMonthOfYear)setSelMonth(firstMonthOfYear);
              }} ph="Selecionar Ano"/>

            {/* ── MONTH dropdown ── */}
            <DD label={selMonthName} opts={monthsForYear.map(m=>MONTH_NAMES[parseInt(m.slice(5,7))-1])} val={selMonthName}
              onChange={mn=>{
                const mi=MONTH_NAMES.indexOf(mn)+1;
                const ym=`${selYear}-${String(mi).padStart(2,"0")}`;
                setSelMonth(ym);
              }} ph="Selecionar Mês"/>

            <DD label="Vendedores" icon={Users} opts={[...new Set(filteredByMonth.map(o=>o[F.vd]).filter(Boolean))].sort()} val={vendor} onChange={setVendor} ph="Todos os Vendedores"/>
            <DD label="Estados" icon={MapPin} opts={[...new Set(filteredByMonth.map(o=>o[F.uf]).filter(Boolean))].sort()} val={state} onChange={setState} ph="Todos os Estados"/>

            <div style={{flex:2,minWidth:160,position:"relative"}}>
              <Search size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:G.muted,pointerEvents:"none"}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="ID / Cliente / Nota Fiscal..."
                style={{width:"100%",background:G.card,border:`1px solid ${G.border}`,borderRadius:8,
                  padding:"7px 12px 7px 28px",color:G.text,fontSize:12,outline:"none",transition:"border .15s"}}
                onFocus={e=>e.target.style.borderColor=G.green}
                onBlur={e=>e.target.style.borderColor=G.border}/>
            </div>

            <div style={{flex:1,minWidth:120,position:"relative"}}>
              <Zap size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:G.green,pointerEvents:"none"}}/>
              <input value={skuSearch} onChange={e=>setSkuSearch(e.target.value)}
                placeholder="SKU / Material..."
                style={{width:"100%",background:G.card,border:`1px solid ${skuSearch?G.green:G.border}`,borderRadius:8,
                  padding:"7px 12px 7px 28px",color:G.text,fontSize:12,outline:"none",transition:"border .15s"}}
                onFocus={e=>e.target.style.borderColor=G.green}
                onBlur={e=>e.target.style.borderColor=skuSearch?G.green:G.border}/>
              {skuSearch&&<button onClick={()=>setSkuSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:G.muted,cursor:"pointer",display:"flex",alignItems:"center"}}><X size={10}/></button>}
            </div>

            {(vendor||state||search||skuSearch)&&<button onClick={reset}
              style={{display:"flex",alignItems:"center",gap:4,padding:"7px 11px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,color:"#f87171",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
              <X size={11}/> Limpar
            </button>}
          </div>

          {/* ── KPI CARDS ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div style={{background:"linear-gradient(135deg,#00c27b,#005c35)",borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden",cursor:"pointer"}}>
              <div style={{position:"absolute",top:-18,right:-18,width:90,height:90,background:"rgba(255,255,255,.06)",borderRadius:"50%"}}/>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:28,height:28,background:"rgba(255,255,255,.2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><Calendar size={14} color="#fff"/></div>
                <span style={{color:"rgba(255,255,255,.9)",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>PEDIDOS HOJE</span>
              </div>
              <div style={{fontSize:48,fontWeight:900,color:"#fff",lineHeight:1,display:"flex",alignItems:"baseline",gap:8}}>0 <span style={{fontSize:16,opacity:.8,fontWeight:400}}>novos</span></div>
              <div style={{marginTop:10,color:"rgba(255,255,255,.7)",fontSize:11}}>
                {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
              </div>
            </div>
            <div className="card" style={{padding:"18px 20px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                <div style={{width:32,height:32,background:"rgba(59,130,246,.15)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center"}}><BarChart3 size={16} color="#3b82f6"/></div>
                {kpis.diffPct!==null&&<span style={{display:"flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:20,
                  background:kpis.diffPct>=0?"rgba(0,229,160,.12)":"rgba(239,68,68,.12)",
                  color:kpis.diffPct>=0?G.green:"#f87171",fontSize:10,fontWeight:700}}>
                  {kpis.diffPct>=0?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}{kpis.diffPct>0?"+":""}{kpis.diffPct}%
                </span>}
              </div>
              <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>VOLUMETRIA</div>
              <div style={{fontSize:34,fontWeight:900,color:G.text,lineHeight:1,marginBottom:4}}>{N(kpis.finCount)}</div>
              <div style={{color:"#475569",fontSize:11}}>Pedidos únicos finalizados no período selecionado.</div>
              {kpis.diffPct!==null&&<span style={{background:"rgba(29,78,216,.15)",border:"1px solid rgba(29,78,216,.35)",color:"#93c5fd",fontSize:10,padding:"2px 8px",borderRadius:5,fontWeight:700,marginTop:4,display:"inline-block"}}>vs {N(MONTH_DATA[kpis.prevMo]?.c||0)} mês ant.</span>}
            </div>
            <div className="card" style={{padding:"18px 20px"}}>
              <div style={{width:32,height:32,background:"rgba(0,229,160,.12)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}><DollarSign size={16} color={G.green}/></div>
              <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>FATURAMENTO</div>
              <div style={{fontSize:20,fontWeight:900,color:G.text,lineHeight:1.2,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>{R$(kpis.finV)}</div>
              <div style={{color:"#475569",fontSize:11}}>Montante total acumulado (Baixas).</div>
            </div>
          </div>

          {/* ── LEAD TIME + KWP ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div className="card" style={{padding:"18px 22px"}}>
              <div style={{width:32,height:32,background:"rgba(251,146,60,.15)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}><Clock size={16} color="#fb923c"/></div>
              <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>LEAD TIME (BAIXA)</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontSize:48,fontWeight:900,color:G.text,lineHeight:1}}>{kpis.lt||"—"}</span>
                <span style={{fontSize:16,color:G.muted,fontWeight:400}}>dias</span>
              </div>
              <div style={{color:"#475569",fontSize:11,marginTop:4}}>Média Faturado → Entregue</div>
            </div>
            <div className="card" style={{padding:"18px 22px"}}>
              <div style={{width:32,height:32,background:"rgba(0,229,160,.12)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8}}><Zap size={16} color={G.green}/></div>
              <div style={{color:G.muted,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>POTÊNCIA TOTAL</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontSize:48,fontWeight:900,color:G.text,lineHeight:1}}>{N(Math.round(kpis.totalKwp))}</span>
                <span style={{fontSize:16,color:G.muted,fontWeight:400}}>kWp</span>
              </div>
              <div style={{color:"#475569",fontSize:11,marginTop:4}}>Capacidade instalada</div>
            </div>
          </div>

          {/* ── CHART + TOP SELLERS ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div className="card" style={{padding:"16px 16px 8px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:G.text,fontSize:13,fontWeight:800}}>Evolução Diária</span>
                  <span style={{display:"flex",alignItems:"center",gap:3,padding:"2px 7px",background:G.card,border:`1px solid rgba(0,229,160,.2)`,borderRadius:5,color:G.green,fontSize:9,fontWeight:700}}>
                    <Zap size={8}/> CLIQUE PARA DETALHES
                  </span>
                </div>
                <div style={{display:"flex",gap:8,fontSize:10,color:G.muted}}>
                  <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,borderRadius:2,background:G.green,display:"inline-block"}}/>Qtd</span>
                  <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:12,height:2,background:"#fbbf24",display:"inline-block"}}/>Valor</span>
                </div>
              </div>
              <div style={{color:G.dim,fontSize:9,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>ANÁLISE TEMPORAL DE FATURAMENTO E VOLUME</div>
              {kpis.dailyArr.length===0?(
                <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:G.dim,fontSize:13}}>Sem baixas no período</div>
              ):<ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={kpis.dailyArr} margin={{top:4,right:48,left:-22,bottom:0}}
                  onClick={d=>{if(d?.activePayload?.[0]){const day=d.activePayload[0].payload.d;setDayModal(`${selMonth}-${day}`);}}}
                  style={{cursor:"pointer"}}>
                  <CartesianGrid stroke="#0d1b2a" vertical={false}/>
                  <XAxis dataKey="d" tick={{fill:"#475569",fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="l" tick={{fill:"#475569",fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="r" orientation="right" tick={{fill:"#64748b",fontSize:10}} tickLine={false} axisLine={false}
                    tickFormatter={v=>v>=1e6?`R$${(v/1e6).toFixed(1)}M`:v>=1e3?`R$${(v/1e3).toFixed(0)}k`:""}/>
                  <Tooltip content={<ChartTip month={selMonth}/>} cursor={{fill:"rgba(0,229,160,.05)"}}/>
                  <Bar yAxisId="l" dataKey="c" radius={[4,4,0,0]} maxBarSize={28}>
                    {kpis.dailyArr.map((_,i)=><Cell key={i} fill={`rgba(0,180,100,0.85)`}/>)}
                  </Bar>
                  <Line yAxisId="r" type="monotone" dataKey="v" stroke="#fbbf24" dot={{fill:"#fbbf24",r:2,strokeWidth:0}} activeDot={{r:4}} strokeWidth={1.5}/>
                </ComposedChart>
              </ResponsiveContainer>}
            </div>
            <div className="card" style={{padding:"16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <span style={{color:G.text,fontSize:13,fontWeight:800}}>Top 5 Vendedores</span>
                <button onClick={()=>setSellOpen(true)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:G.card,border:`1px solid ${G.border}`,borderRadius:7,color:G.muted,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=G.green;e.currentTarget.style.color=G.green;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.muted;}}>
                  <BarChart3 size={11}/> Ver Todos
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {kpis.sellers.slice(0,5).map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:60,color:G.muted,fontSize:11,fontWeight:700,textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.n}>{s.n.split(" ")[0]}</span>
                    <div style={{flex:1,background:"#0d1b2a",borderRadius:5,height:24,overflow:"hidden",cursor:"pointer"}} onClick={()=>setSellOpen(true)}>
                      <div style={{height:"100%",borderRadius:5,background:SC[i],width:`${(s.v/maxSV)*100}%`,transition:"width .5s ease",opacity:.9}}/>
                    </div>
                    <span style={{width:56,textAlign:"right",color:G.muted,fontSize:10,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>{R$s(s.v)}</span>
                  </div>
                ))}
                {kpis.sellers.length===0&&<div style={{color:G.dim,fontSize:12,textAlign:"center",padding:"20px 0"}}>Sem dados para o período</div>}
              </div>
            </div>
          </div>

          {/* ── DISTRIBUIÇÃO GEOGRÁFICA ── */}
          <div className="card" style={{padding:"16px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{color:G.text,fontSize:13,fontWeight:800}}>Distribuição Geográfica</span>
              <span style={{padding:"2px 7px",background:"rgba(29,78,216,.12)",border:"1px solid rgba(29,78,216,.4)",borderRadius:5,color:"#93c5fd",fontSize:9,fontWeight:700}}>↔ EXPLORAÇÃO ATIVA</span>
            </div>
            <div style={{color:G.dim,fontSize:9,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>PEDIDOS FINALIZADOS POR ESTADO — CLIQUE PARA FILTRAR</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {kpis.estados.map((g,i)=>{
                const pct=kpis.estados[0]?.c>0?g.c/kpis.estados[0].c:0;
                const sel=state===g.uf;
                const col=`rgb(0,${Math.round(pct*190)},${Math.round(pct*95)})`;
                return <div key={i} onClick={()=>setState(v=>v===g.uf?null:g.uf)}
                  style={{padding:"7px 12px",borderRadius:9,cursor:"pointer",textAlign:"center",minWidth:55,
                    background:sel?"rgba(0,229,160,.15)":`${col}18`,
                    border:`1px solid ${sel?G.green:`${col}40`}`,transition:"all .15s"}}
                  onMouseEnter={e=>!sel&&(e.currentTarget.style.transform="scale(1.06)")}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  <div style={{color:sel?G.green:col,fontSize:12,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{g.uf}</div>
                  <div style={{color:"#94a3b8",fontSize:10,marginTop:1}}>{N(g.c)}</div>
                </div>;
              })}
              {kpis.estados.length===0&&<div style={{color:G.dim,fontSize:12,padding:"12px 0"}}>Sem dados para o período selecionado</div>}
            </div>
          </div>

          {/* ── VISÃO POR ETAPA ── */}
          <div className="card" style={{padding:"16px",marginBottom:12}}>
            <div style={{color:G.text,fontSize:13,fontWeight:800,marginBottom:2}}>Visão por Etapa</div>
            <div style={{color:G.dim,fontSize:9,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>PIPELINE COMPLETO — CLIQUE PARA FILTRAR A TABELA</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {ETAPAS.slice(1).map(e=>{
                const Ic=e.ic, stat=monthStatusCounts[e.id]||{count:0,valor:0};
                const pct=filteredByMonth.length>0?Math.round((stat.count/filteredByMonth.length)*100):0;
                const active=etapa===e.id;
                return <div key={e.id} onClick={()=>setEtapaReset(e.id)}
                  style={{padding:"11px",borderRadius:10,cursor:"pointer",transition:"all .16s",
                    background:active?`${e.co}12`:"rgba(255,255,255,.02)",
                    border:`1px solid ${active?e.co+"40":G.border}`}}
                  onMouseEnter={ev=>!active&&(ev.currentTarget.style.borderColor="#2a4a6a")}
                  onMouseLeave={ev=>!active&&(ev.currentTarget.style.borderColor=G.border)}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <div style={{width:24,height:24,borderRadius:6,background:`${e.co}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic size={11} color={e.co}/></div>
                    <span style={{color:G.text,fontSize:15,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{N(stat.count)}</span>
                  </div>
                  <div style={{color:G.muted,fontSize:10,lineHeight:1.3,marginBottom:5}}>{e.lb}</div>
                  <div style={{height:3,background:"#0d1b2a",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:2,background:e.co,width:`${Math.max(pct,.5)}%`,transition:"width .5s ease"}}/>
                  </div>
                  <div style={{color:G.dim,fontSize:9,marginTop:2}}>{pct}% · {R$s(stat.valor)}</div>
                </div>;
              })}
            </div>
          </div>

          {/* ── TABELA PRINCIPAL ── */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:G.text,fontSize:13,fontWeight:800}}>Tabela de Pedidos</span>
                <span style={{background:G.card,border:`1px solid ${G.border}`,color:G.green,fontSize:10,padding:"2px 8px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{selMonthName} {selYear}</span>
                {etapa!=="all"&&<SBadge s={etapa}/>}
                {(vendor||state)&&<span style={{color:G.muted,fontSize:11}}>
                  {vendor&&<>· <span style={{color:G.green}}>{vendor.split(" ")[0]}</span></>}
                  {state&&<>· <span style={{color:G.green}}>{state}</span></>}
                </span>}
              </div>
              <div style={{display:"flex",gap:6}}>
                {(vendor||state||search||skuSearch||etapa!=="all")&&<button onClick={()=>{reset();setEtapa("all");}}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:6,color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  <X size={9}/> Limpar
                </button>}
                <button onClick={()=>setEtapaReset("all")}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",background:G.card,border:`1px solid ${G.border}`,borderRadius:6,color:G.muted,fontSize:11,cursor:"pointer"}}>
                  <Eye size={10}/> Ver Todos
                </button>
              </div>
            </div>
            <OrdersTable etapa={etapa} vendor={vendor} state={state} search={search} skuSearch={skuSearch} selMonth={selMonth} liveOrders={liveOrders} liveProducts={liveProducts}/>
          </div>

        </main>
      </div>
    </div>

    {/* FAB Amar Elo */}
    {!chatOpen&&<AmarEloFAB onClick={()=>setChatOpen(true)}/>}

    {chatOpen&&<ChatBot onClose={()=>setChatOpen(false)}/>}
    {sellOpen&&<SellersModal onClose={()=>setSellOpen(false)} sellers={kpis.sellers}/>}
    {dayModal&&<DayModal dateStr={dayModal} onClose={()=>setDayModal(null)} liveProducts={liveProducts} liveOrders={liveOrders}/>}
  </>;
}
