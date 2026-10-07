// Monthly payroll calculation. No clock, storage, network or UI side effects.
export const KPI_WEIGHTS = {sales:30,upselling:15,crm:10,compliments:10,shift:10,punctuality:25};
export const KPI_LABELS = {sales:'ยอดขาย / Sales',upselling:'บิล ≥ ฿1,000 / Upselling',crm:'CRM + Google Reviews',compliments:'ลูกค้าชม / Compliments',shift:'เปิด–ปิดกะ / Open & Close',punctuality:'ตรงเวลา / Punctuality'};
export function kpiDate(raw) {
  if (!raw) return '';
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms+7*3600000).toISOString().slice(0,10) : '';
}
export function kpiTxDate(t) {
  // Old local receipts used an ambiguous locale date; their ID is reliable.
  const id = String(t.id||'').match(/^DCK-(\d{12,})$/);
  return kpiDate(t.transactionTime || t.createdAt || (id ? new Date(+id[1]).toISOString() : t.date));
}
export function kpiGrade(score) { return score>=90?'A':score>=80?'B':score>=70?'C':'D'; }
const num = n => Number.isFinite(+n) ? +n : 0;
const norm = n => String(n||'').trim().toLowerCase();
const points = (actual,target,weight) => target>0 ? Math.min(1,Math.max(0,actual/target))*weight : 0;
export function kpiSchedules(book, locations, staff) {
  const schedules=[], errors=[];
  Object.entries(book?.cells||{}).forEach(([key,cell])=>{
    if (!cell || cell.closed || !cell.id) return;
    const [loc,date,slotId]=key.split('|');
    const location=locations.find(x=>x.id===loc), slot=location?.slots?.find(x=>x.id===slotId);
    [cell,...(cell.extra||[])].forEach(person=>{
      const matches=staff.filter(s=>norm(s.name)===norm(person.name) || String(s.rosterId||'')===String(person.id));
      if(matches.length!==1) {errors.push('Roster staff mapping: '+person.name);return;}
      const times=String(person.window||slot?.label||'').match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
      if(!times) {errors.push('Roster time: '+person.name);return;}
      const start=date+'T'+times[1]+':00+07:00';
      const endMs=Date.parse(date+'T'+times[2]+':00+07:00')+(times[2]<=times[1]?86400000:0);
      schedules.push({staffId:matches[0].id,date,loc,branch:location?.name,start,end:new Date(endMs).toISOString()});
    });
  });
  return {schedules,errors};
}
export function calculateKpi({month,staff,local=[],storehub=[],schedules=[],shifts=[],evidence=[],targets={},coverage=false,mappingErrors=[],refundLinks={},now=Date.now()}) {
  const issues=[], byId=new Map(), seen=new Set(),billNets=new Map(),refunds=[];
  const eligible=staff.filter(s=>s.approved && !['owner','shareholder','accountant','kitchen','rider'].includes(s.role));
  const rows=eligible.map(s=>{
    const r={staffId:s.id,name:s.name,sales:0,bills:0,upselling:0,crm:0,reviews:0,compliments:0,scheduled:0,completed:0,onTime:0,parts:{},issues:[]};
    byId.set(String(s.id),r); return r;
  });
  // StoreHub ID is the canonical identity when a local receipt was synced.
  const txs=[...storehub.map(t=>({...t,_source:'sh'})),...local.map(t=>({...t,_source:'local'}))];
  txs.forEach(t=>{
    if(kpiTxDate(t).slice(0,7)!==month) return;
    const key=t.shId||t.storehubId||t.storehubTransactionId||t.id||t._id;
    if(!key) {issues.push('Transaction without ID');return;}
    if(seen.has(String(key)))return;
    seen.add(String(key));
    if(t.isVoid || /void|cancel/i.test(String(t.transactionType||t.status||'')))return;
    const matches=staff.filter(s=>t._source==='sh' ? s.shId && String(s.shId)===String(t.employeeId) : String(s.id)===String(t.staffId));
    if(matches.length!==1) {issues.push('Unmapped seller: '+String(t.employeeId||t.staffId||key));return;}
    const r=byId.get(String(matches[0].id));if(!r)return;
    const refund=/return|refund/i.test(String(t.transactionType||t.status||'')) || num(t.total)<0;
    const amount=refund?-Math.abs(num(t.total)):num(t.total);
    r.sales+=amount;
    if(!refund && amount>0)billNets.set(String(key),{r,net:amount});
    if(refund)refunds.push({staffId:r.staffId,id:String(key),amount,originalId:String(refundLinks[String(key)]||t.originalTransactionId||t.refundedTransactionId||t.originalReceiptId||'')});
  });
  refunds.forEach(refund=>{
    const r=byId.get(String(refund.staffId));
    const original=txs.find(t=>String(t.shId||t.storehubId||t.storehubTransactionId||t.id||t._id)===refund.originalId);
    if(!original || /return|refund|void|cancel/i.test(String(original.transactionType||original.status||'')) || original.isVoid){r.issues.push('Refund original receipt: '+refund.id);return;}
    const same=original._source==='sh'?String(original.employeeId)===String(staff.find(s=>String(s.id)===String(r.staffId))?.shId):String(original.staffId)===String(r.staffId);
    if(!same){r.issues.push('Refund seller mismatch: '+refund.id);return;}
    const bill=billNets.get(refund.originalId);if(bill)bill.net+=refund.amount;
  });
  billNets.forEach(({r,net})=>{if(net>0)r.bills++;if(net>=1000)r.upselling++;});
  const usedEvidence=new Set();
  evidence.filter(e=>e.month===month && e.verified===true).forEach(e=>{
    const r=byId.get(String(e.staffId));
    const key=String(e.type)+'|'+(e.attachment || norm(e.reference));
    if(!r || !e.reference || !['crm','reviews','compliments'].includes(e.type) || usedEvidence.has(key))return;
    usedEvidence.add(key); r[e.type]++;
  });
  const usedShifts=new Set();
  schedules.filter(s=>s.date.slice(0,7)===month && Date.parse(s.end)<=now).forEach(sc=>{
    const r=byId.get(String(sc.staffId));if(!r)return;
    r.scheduled++;
    const matching=shifts.filter(sh=>String(sh.staffId)===String(sc.staffId) && kpiDate(sh.inAt)===sc.date && (!sc.branch || norm(sh.branch)===norm(sc.branch)) && !usedShifts.has(String(sh.id)));
    matching.sort((a,b)=>Math.abs(Date.parse(a.inAt)-Date.parse(sc.start))-Math.abs(Date.parse(b.inAt)-Date.parse(sc.start)));
    const sh=matching[0];if(!sh)return;
    usedShifts.add(String(sh.id));
    if(sh.outAt && Date.parse(sh.arrivedAt||sh.inAt)<=Date.parse(sc.start)+15*60000 && Date.parse(sh.outAt)>=Date.parse(sc.end))r.onTime++;
    const exact=rs=>Array.isArray(rs)&&rs.every(x=>x.measured!=='' && x.measured!=null && Math.abs(num(x.measured)-num(x.expected))<0.000001);
    if(sh.openTasksComplete && sh.closeTasksComplete && sh.outAt && exact(sh.openCheck) && exact(sh.closeCheck) && sh.report?.cash!=='' && sh.report?.cash!=null && sh.report?.sigOut && sh.report?.proofPhoto)r.completed++;
  });
  rows.forEach(r=>{
    const t=targets[String(r.staffId)]||{};
    ['sales','upselling','crm','reviews','compliments'].forEach(k=>{if(!(num(t[k])>0))r.issues.push('Target: '+k);});
    if(!r.scheduled)r.issues.push('No elapsed approved roster shifts');
    r.parts={sales:points(r.sales,num(t.sales),30),upselling:points(r.upselling,num(t.upselling),15),crm:points(r.crm,num(t.crm),5)+points(r.reviews,num(t.reviews),5),compliments:points(r.compliments,num(t.compliments),10),shift:points(r.completed,r.scheduled,10),punctuality:points(r.onTime,r.scheduled,25)};
    // Grade uses full precision, never rounded display values.
    r.score=Object.values(r.parts).reduce((a,b)=>a+b,0);
    r.ready=coverage && !issues.length && !mappingErrors.length && !r.issues.length;
    r.grade=r.ready?kpiGrade(r.score):'Pending';
    r.rate=r.ready?({A:3,B:2,C:1,D:0}[r.grade]):0;
    r.commission=Math.round(Math.max(0,r.sales)*r.rate)/100;
    r.warning=r.grade==='D';r.bonus=0;
  });
  rows.sort((a,b)=>b.sales-a.sales || String(a.staffId).localeCompare(String(b.staffId),'en',{numeric:true}));
  // An exact sales tie is broken by stable staff ID; only two awards ever exist.
  rows.forEach((r,i)=>{r.rank=i+1;if(coverage && !issues.length && !mappingErrors.length && i<2 && r.sales>0)r.bonus=1500;r.variablePay=r.commission+r.bonus;});
  const source={month,rows,coverage,issues,mappingErrors,targets,schedules,refundLinks,
    shifts:shifts.filter(sh=>kpiDate(sh.inAt).slice(0,7)===month).map(sh=>({id:sh.id,staffId:sh.staffId,inAt:sh.inAt,arrivedAt:sh.arrivedAt,outAt:sh.outAt,openTasksComplete:sh.openTasksComplete,closeTasksComplete:sh.closeTasksComplete,openCheck:sh.openCheck,closeCheck:sh.closeCheck,report:sh.report?{cash:sh.report.cash,sigOut:sh.report.sigOut,proof:!!sh.report.proofPhoto}:null})),
    evidence:evidence.filter(e=>e.month===month),
    txs:txs.filter(t=>kpiTxDate(t).slice(0,7)===month).map(t=>({id:t.shId||t.storehubId||t.storehubTransactionId||t.id||t._id,time:kpiTxDate(t),staffId:t.staffId,employeeId:t.employeeId,total:t.total,type:t.transactionType,status:t.status,isVoid:t.isVoid}))};
  return {month,rows,refunds,issues:[...new Set([...issues,...mappingErrors])], fingerprint:JSON.stringify(source),ready:rows.length>0&&rows.every(r=>r.ready)};
}
export function kpiCsv(report,approval) {
  const lines=[['Month','Staff','Rank','Sales THB','Score','Grade','Commission %','Commission THB','Top 2 Bonus THB','Variable Pay THB','Status','Approved By']];
  report.rows.forEach(r=>lines.push([report.month,r.name,r.rank,r.sales,r.score.toFixed(2),r.grade,r.rate,r.commission,r.bonus,r.variablePay,approval?'Approved':'Draft',approval?.by||'']));
  return '\uFEFF'+lines.map(row=>row.map(v=>{let s=String(v);if(typeof v==='string' && /^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
}
export function kpiProofReady(proofs) {
  return ['crm','reviews'].every(type=>{
    const p=proofs?.[type];
    return p?.choice==='none' || (p?.choice==='proof' && Array.isArray(p.files) && p.files.length>0 && p.files.every(f=>/^data:image\/(jpeg|png|webp);base64,/.test(f.data||'')));
  });
}
export function mergeKpiBranch(payload, {month,staff,shifts,evidence}) {
  if(payload?.version!==1 || payload.month!==month || !Array.isArray(payload.staff) || !Array.isArray(payload.shifts) || !Array.isArray(payload.evidence) || !payload.device)throw new Error('Invalid branch package or wrong month');
  if(payload.shifts.length>2000 || payload.evidence.length>4000)throw new Error('Branch package too large');
  const mapping=new Map();
  payload.staff.forEach(remote=>{
    const matches=staff.filter(s=>(remote.shId && s.shId && String(s.shId)===String(remote.shId)) || norm(s.name)===norm(remote.name));
    if(matches.length!==1)throw new Error('Staff mapping required: '+remote.name);
    mapping.set(String(remote.id),matches[0]);
  });
  const idFor=id=>String(id).startsWith('KPIIMPORT:')?String(id):'KPIIMPORT:'+String(payload.device).slice(0,60)+':'+String(id).slice(0,150);
  const importedShifts=payload.shifts.map(sh=>{
    const s=mapping.get(String(sh.staffId));
    if(!s || !sh.id || kpiDate(sh.inAt).slice(0,7)!==month || !kpiDate(sh.outAt))throw new Error('Invalid closed shift');
    return {...sh,id:idFor(sh.id),staffId:s.id,staffName:s.name};
  });
  const importedEvidence=payload.evidence.map(e=>{
    const s=mapping.get(String(e.staffId));
    if(!s || e.month!==month || !e.id || !e.reference || !['crm','reviews','compliments'].includes(e.type))throw new Error('Invalid evidence record');
    if(e.attachment && !/^data:image\/(jpeg|png|webp);base64,/.test(e.attachment))throw new Error('Invalid proof image');
    const entry={...e,id:idFor(e.id),staffId:s.id,shiftId:e.shiftId?idFor(e.shiftId):undefined,verified:false,verifiedBy:undefined,verifiedAt:undefined};
    const old=evidence.find(x=>x.id===entry.id);
    if(old && old.reference===entry.reference && old.attachment===entry.attachment && old.comment===entry.comment && old.staffId===entry.staffId)return old;
    return entry;
  });
  const merge=(before,incoming)=>{const map=new Map(before.map(x=>[String(x.id),x]));incoming.forEach(x=>map.set(String(x.id),x));return [...map.values()];};
  return {shifts:merge(shifts,importedShifts),evidence:merge(evidence,importedEvidence),count:importedShifts.length+importedEvidence.length};
}
