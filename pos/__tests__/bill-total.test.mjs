/* A comped bill (100% discount) reported total 0, and `+t.total || (subtotal
 * - discount)` read that 0 as missing — inventing a -748 total and a -848
 * profit for a sale that actually lost only the cost of the goods. */
import fs from 'fs';
const src=fs.readFileSync('/home/user/DANK-MEDICAL-POS-APP/pos/app.fixed.jsx','utf8');
const a=src.indexOf('      // A bill the customer paid nothing for');
const b=src.indexOf('var profit=total-cost;',a)+'var profit=total-cost;'.length;
const calc=new Function('t','subtotal','discount','cost', src.slice(a,b)+'; return {total:total,profit:profit};');

let pass=0,fail=0;
const is=(g,w,n)=>{const ok=g===w;ok?pass++:fail++;console.log(`${ok?'✓':'✗'}  ${n}: got ${g}, want ${w}`);};

// the exact bill from the shop: every line discounted to 0, cost 100
let r=calc({total:0}, 0, 748, 100);
is(r.total, 0, 'comped bill totals 0, not -748');
is(r.profit, -100, 'its loss is the cost of the goods, not -848');

r=calc({total:1200}, 1300, 100, 830);
is(r.total, 1200, 'a normal bill uses the reported total');
is(r.profit, 370, 'normal profit is total minus cost');

r=calc({total:-450}, 0, 0, -300);
is(r.total, -450, 'a refund keeps its negative total');
is(r.profit, -150, 'refund profit stays negative');

r=calc({}, 900, 100, 500);
is(r.total, 800, 'a missing total is still estimated from subtotal - discount');
r=calc({total:null}, 900, 100, 500);
is(r.total, 800, 'null total estimates too');
r=calc({total:""}, 900, 100, 500);
is(r.total, 800, 'empty-string total estimates too');

r=calc({}, 0, 748, 100);
is(r.total, 0, 'an estimate never fabricates a negative total');

r=calc({total:"515"}, 0, 0, 50);
is(r.total, 515, 'a numeric string total is respected');

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
