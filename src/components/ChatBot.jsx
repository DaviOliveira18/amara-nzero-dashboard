import { useState, useMemo, useRef, useEffect } from 'react'
import { Send, X, Star, BarChart3, ChevronDown } from 'lucide-react'
import { SUN_URL } from '../utils/sunUrl.js'
import { FAB_CSS, CHAT_CSS, AI_DATA } from '../utils/chatAssets.js'
import { R$s, N } from '../utils/constants.js'

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
