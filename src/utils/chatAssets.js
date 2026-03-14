export const FAB_CSS = `
@keyframes fab-ring-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fab-ring-ping{0%,100%{transform:scale(1);opacity:.35}60%{transform:scale(1.28);opacity:0}}
@keyframes fab-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes fab-tooltip{from{opacity:0;transform:translateY(4px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
.fab-btn:hover{transform:scale(1.1)!important}
.fab-btn:hover .fab-sun{transform:rotate(15deg) scale(1.08)}
.fab-btn:hover .fab-tip{animation:fab-tooltip .15s ease forwards;display:flex!important}
.fab-sun{transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
`;

export const CHAT_CSS = `
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

export const AI_DATA = (() => {
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
