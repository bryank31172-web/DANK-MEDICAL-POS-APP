/* Reads parseScaleLine straight out of app.fixed.jsx and checks it against the
 * shapes real serial scales emit. Written after a shop scale set to kg sent
 * "0.132" and the count recorded 0.13g instead of 132g — every weighed item
 * was coming out 1000x short.
 *
 *   node pos/__tests__/scale-parse.test.cjs
 */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','app.fixed.jsx'),'utf8');
const body=src.slice(src.indexOf('const SCALE_TO_G='), src.indexOf('const scaleStopRef'));
const parseScaleLine=new Function(body+'; return parseScaleLine;')();
const cases=[
 ['ST,GS,+  0.132 kg','auto',132,'the video: scale in kg'],
 ['0.132kg','auto',132,'no space before unit'],
 ['  132.0 g','auto',132,'already grams'],
 ['132','auto',132,'bare number, auto -> grams'],
 ['0.132','kg','132','bare number, operator says kg'],
 ['0.132','auto',0.13,'bare number, auto -> taken as grams'],
 ['4.66 oz','auto',132.11,'ounces'],
 ['ST,GS,+ 1.5 kg','auto',1500,'kilo'],
 ['-0.05 kg','auto',-50,'negative (tare)'],
 ['garbage','auto',null,'no number at all'],
];
let pass=0;
for(const [line,pref,want,note] of cases){
  const r=parseScaleLine(line,pref);
  const got=r?r.grams:null;
  const ok=(want===null)?(r===null):(r&&Math.abs(got-Number(want))<0.5);
  if(ok)pass++;
  console.log(`${ok?'✓':'✗'}  ${JSON.stringify(line).padEnd(20)} [${pref}] -> ${got}g   want ${want}   ${r?('unit='+r.unit):''}   ${note}`);
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass===cases.length?0:1);
