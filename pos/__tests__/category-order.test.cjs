/* Reads catCmp/catRank out of app.fixed.jsx. Categories used to sort
 * alphabetically, which put Accessories above Exotics on every screen — not how
 * anyone shops or counts a shift. Flower first, best grade first.
 *
 *   node pos/__tests__/category-order.test.cjs
 */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','app.fixed.jsx'),'utf8');
const body=src.slice(src.indexOf('const CAT_TIERS=['), src.indexOf('// ——— end of the category-order block'));
const {catCmp,catRank}=new Function(body+'; return {catCmp:catCmp,catRank:catRank};')();
// exactly what the shop's own data contains today
const live=["Accessories","Beer","Edibles","Exotics","Merch","Midgrade","Premium","Joints","Topshelf","Vapes"];
const got=live.slice().sort(catCmp);
console.log('live categories sorted:\n  '+got.join(' → ')+'\n');
const want=["Exotics","Topshelf","Midgrade","Premium","Joints","Vapes","Edibles","Beer","Accessories","Merch"];
const ok=JSON.stringify(got)===JSON.stringify(want);
console.log((ok?'✓':'✗')+' matches the requested order');
if(!ok)console.log('  want: '+want.join(' → '));

// names the POS feed actually uses, plus one nobody has seen before
const feed=["( Bar ) Tequila shot","( Beer ) Crispy Boy","( Edible) Gummies","( Equipment ) Bong XL","Exotics","Top Shelf","Mid Grade","Flowers","Hash & Wax","Something New","Other"];
console.log('\nfeed-style + unknown categories:\n  '+feed.slice().sort(catCmp).join(' → '));

let pass=ok;
const checks=[
 ['Exotics beats Accessories', catCmp('Exotics','Accessories')<0],
 ['Top Shelf beats Midgrade', catCmp('Top Shelf','Midgrade')<0],
 ['Midgrade beats Edibles', catCmp('Midgrade','Edibles')<0],
 ['any flower beats beer', catCmp('Flowers','Beer')<0],
 ['unknown lands before Other', catRank('Zzz Unknown')<catRank('Other')],
 ['unknown lands after Merch', catRank('Zzz Unknown')>catRank('Merch')],
 ['spacing variants match', catRank('top shelf')===catRank('Topshelf')],
];
checks.forEach(([n,c])=>{console.log((c?'✓':'✗')+'  '+n); if(!c)pass=false;});
console.log('\n'+(pass?'PASS':'FAIL'));
process.exit(pass?0:1);
