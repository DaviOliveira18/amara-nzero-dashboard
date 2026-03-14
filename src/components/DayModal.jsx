import { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { F, R$, fmtDate, fmtDtHr } from '../utils/constants.js'
import ProductModal from './ProductModal.jsx'

export function DayModal({dateStr,onClose,liveProducts,liveOrders}){
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
