import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronDown, ArrowUpRight, Eye } from 'lucide-react'
import { F, R$, R$s, fmtDate, fmtDtHr, leadDays, N, STATUS_COLOR } from '../utils/constants.js'
import ProductModal from './ProductModal.jsx'

export function OrdersTable({etapa,vendor,state,search,skuSearch,selMonth,liveOrders,liveProducts}){
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
