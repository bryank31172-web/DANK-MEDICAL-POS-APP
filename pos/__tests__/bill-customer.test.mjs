/* The bill list showed "Walk-in" on every row because custMap was keyed only by
 * our own customer id, while StoreHub sends its own. Pull the resolver out of
 * the source and check it against the id shapes StoreHub actually uses. */
import fs from 'fs';
const src=fs.readFileSync('/home/user/DANK-MEDICAL-POS-APP/pos/app.fixed.jsx','utf8');
const a=src.indexOf('    var custMap={};\n'), b=src.indexOf('    var rows=[];',a);
const body=src.slice(a,b);
const make=new Function('customers', body+'; return _lookupCust;');

let pass=0,fail=0;
const is=(g,w,n)=>{const ok=g===w;ok?pass++:fail++;console.log(`${ok?'✓':'✗'}  ${n}: got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);};

const customers=[
  {id:'REF-9001', shId:'SH-77', name:'คุณสมชาย', phone:'081-234-5678', email:'somchai@x.com'},
  {id:'local-42', name:'Nok Wilai', phone:'0899999999'},
  {id:'REF-blank', name:'   '},                 // a name-less record must never win
];
const look=make(customers);

is(look({customerId:'REF-9001'}), 'คุณสมชาย', 'matches our stored id (StoreHub refId)');
is(look({customerId:'SH-77'}),    'คุณสมชาย', "matches StoreHub's own id");
is(look({customerId:'sh-SH-77'}), 'คุณสมชาย', 'matches the sh- prefixed form');
is(look({customerId:'ref-9001'}), 'คุณสมชาย', 'id match is case-insensitive');
is(look({customerPhone:'0812345678'}), 'คุณสมชาย', 'falls back to phone');
is(look({phone:'081-234-5678'}), 'คุณสมชาย', 'phone match ignores dashes');
is(look({customerEmail:'somchai@x.com'}), 'คุณสมชาย', 'falls back to email');
is(look({customer:'local-42'}), 'Nok Wilai', 'matches a locally created customer');
is(look({customerName:'Walk-in Bob'}), 'Walk-in Bob', 'uses an inline name when there is no id');
is(look({customerFirstName:'Ann', customerLastName:'Lee'}), 'Ann Lee', 'joins inline first/last name');
is(look({}), '', 'no customer at all resolves to empty (the caller shows "none")');
is(look({customerId:'REF-blank'}), '', 'a blank-named record is not a match');
is(look({customerId:'UNKNOWN-1'}), '', 'an unknown id is not a false match');
is(look({customerId:null, phone:''}), '', 'null and empty keys are skipped');

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
