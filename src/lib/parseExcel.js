// Colunas do Relatório de Pedidos (índices do Excel)
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

export { COL, parseExcelToOrders }
