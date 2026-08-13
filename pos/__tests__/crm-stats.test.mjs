/* The CRM showed POINTS/SPENT/VISITS as 0 for all 174 customers because the
 * StoreHub sync writes `totalSpent: existing.totalSpent||0` — it never reads
 * spend or visits from anywhere. The sales are already synced, so count them. */
import fs from 'fs';
const src=fs.readFileSync('/home/user/DANK-MEDICAL-POS-APP/pos/app.fixed.jsx','utf8');
const a=src.indexOf('  const custStats=React.useMemo(function(){');
const b=src.indexOf('  const [barPick,setBarPick]', a);
// run the two blocks with React's hooks stubbed to plain evaluation
const body=src.slice(a,b)
  .replace('React.useMemo(function(){','(function(){').replace('},[txHistory]);','})();')
  .replace('React.useCallback(function(c){','(function(c){').replace('},[custStats]);','});');
const make=new Function('txHistory', body+'; return statsFor;');

let pass=0,fail=0;
const is=(g,w,n)=>{const ok=g===w;ok?pass++:fail++;console.log(`${ok?'✓':'✗'}  ${n}: got ${g}, want ${w}`);};

const tx=[
  {customerId:'REF-1', total:500, transactionTime:'2026-08-01T10:00:00Z'},
  {customerId:'REF-1', total:1200, transactionTime:'2026-08-05T10:00:00Z'},
  {customerPhone:'0812345678', total:300, transactionTime:'2026-08-06T10:00:00Z'},
  {customerId:'REF-2', total:800, transactionTime:'2026-08-02T10:00:00Z'},
  {customerId:'REF-2', total:400, transactionTime:'2026-08-03T10:00:00Z', transactionType:'Refund'}, // must not count
  {total:999, transactionTime:'2026-08-04T10:00:00Z'},  // walk-in, no customer
];
const statsFor=make(tx);

let s1=statsFor({id:'REF-1'});
is(s1.spent, 1700, 'spend adds up across a customer\'s bills');
is(s1.visits, 2, 'visits counts the bills');

let s2=statsFor({id:'local-9', phone:'081-234-5678'});
is(s2.spent, 300, 'matches on a dashed phone number');
is(s2.visits, 1, '  and counts that visit');

let s3=statsFor({id:'REF-2'});
is(s3.spent, 800, 'a refund is not counted as spend');
is(s3.visits, 1, '  nor as a visit');

let s4=statsFor({id:'REF-UNKNOWN'});
is(s4.spent, 0, 'a customer with no bills is 0, not a false match');
is(s4.visits, 0, '  and no visits');

is(statsFor({}).visits, 0, 'a customer with no identifiers matches nothing');
is(statsFor({id:'', phone:''}).visits, 0, 'empty identifiers match nothing');
is(statsFor({id:'ref-1'}).visits, 2, 'id matching is case-insensitive');

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
