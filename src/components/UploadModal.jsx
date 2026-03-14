import { useState, useMemo, useRef, useEffect } from 'react'
import { Upload, X, Plus } from 'lucide-react'
import { COL } from '../utils/constants.js'
import { parseExcelToOrders } from '../utils/parseExcel.js'

export function UploadModal({onClose,onDataLoaded}){
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
