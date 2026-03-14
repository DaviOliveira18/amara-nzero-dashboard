import { useState, useMemo, useRef, useEffect } from 'react'
import { FileText, Package } from 'lucide-react'
import { F, R$, R$s, fmtDate, fmtDtHr, leadDays } from '../utils/constants.js'
import { fetchProducts } from '../lib/supabase.js'

export function ProductModal({order,onClose,liveProducts}){
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
