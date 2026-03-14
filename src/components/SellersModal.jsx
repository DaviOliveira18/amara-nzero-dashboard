import { useState, useMemo, useRef, useEffect } from 'react'
import { Trophy, Search, ChevronDown } from 'lucide-react'
import { R$, N } from '../utils/constants.js'

const TOP_SELLERS = [] // populated from liveOrders via prop

export function SellersModal({onClose,sellers}){
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
