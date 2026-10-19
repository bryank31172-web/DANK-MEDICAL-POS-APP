const BASE=process.env.STOREHUB_API_BASE||"https://api.storehubhq.com";
const USER=process.env.STOREHUB_STORE||process.env.STOREHUB_USER;
const TOKEN=process.env.STOREHUB_TOKEN||process.env.STOREHUB_KEY;
const thaiDay=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"});
const list=x=>Array.isArray(x)?x:Array.isArray(x?.data)?x.data:Array.isArray(x?.transactions)?x.transactions:null;
export async function fetchStoreHubSales(date){
  if(!USER||!TOKEN) throw new Error("StoreHub credentials unavailable");
  const start=new Date(date+"T00:00:00+07:00");
  if(!Number.isFinite(start.getTime())||thaiDay.format(start)!==date)throw new Error("Invalid date");
  const end=new Date(start.getTime()+86400000);
  const auth="Basic "+Buffer.from(USER+":"+TOKEN).toString("base64");
  const collected=[];let complete=false;let error=null;
  for(let page=1;page<=50;page++){
    const url=new URL("/transactions",BASE);
    url.searchParams.set("from",start.toISOString());
    url.searchParams.set("to",end.toISOString());
    url.searchParams.set("page",String(page));
    url.searchParams.set("limit","100");
    const response=await fetch(url,{headers:{Authorization:auth,Accept:"application/json"}});
    if(!response.ok){error="StoreHub HTTP "+response.status;break;}
    const payload=await response.json(),batch=list(payload);
    if(!batch){error="Unknown transaction payload format";break;}
    collected.push(...batch);
    if(batch.length<100){complete=true;break;}
  }
  const seen=new Set(),byStore={},transactions=[];
  for(const t of collected){
    const id=String(t.id||t._id||t.refId||"");
    const timestamp=t.transactionTime||t.createdAt||t.date;
    if(!id||seen.has(id)||!timestamp||!Number.isFinite(Date.parse(timestamp))||thaiDay.format(new Date(timestamp))!==date)continue;
    seen.add(id);
    const store=String(t.storeId||"unknown"),type=String(t.transactionType||t.type||"unknown").toLowerCase();
    if(!["sale","refund","return"].includes(type))continue;
    const lines=Array.isArray(t.items)?t.items:Array.isArray(t.lineItems)?t.lineItems:[];
    const normalized=lines.map(i=>({sku:i.productId||i.sku||null,name:i.name||i.productName||null,quantity:Number(i.quantity??i.qty)||0,unit:i.unit||null,amount:Number(i.total??i.lineTotal)||0}));
    const group=byStore[store] ||= {transactions:0,total:0,sku:{}};
    group.transactions++;group.total+=Number(t.total)||0;
    for(const line of normalized){const k=String(line.sku||line.name||"unmapped"),entry=group.sku[k] ||= {name:line.name,unit:line.unit,quantity:0,amount:0};const sign=type==="sale"?1:-1;entry.quantity+=sign*line.quantity;entry.amount+=sign*line.amount;}
    transactions.push({id,store,timestamp,type,total:Number(t.total)||0,items:normalized});
  }
  return {date,source:"StoreHub transactions",timezone:"Asia/Bangkok",complete,error,recordsFetched:collected.length,recordsMatched:transactions.length,byStore,transactions};
}