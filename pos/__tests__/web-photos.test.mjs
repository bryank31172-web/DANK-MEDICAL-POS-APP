/* StoreHub sends no photos, so the till showed a category emoji for every item.
 * The customer site has a photo per strain under a shorter name — "Zkittles"
 * there is "Zkittles Blunt" on the till. These are the real names from both
 * sides, taken off the live screens. */
import fs from 'fs';
const src=fs.readFileSync('/home/user/DANK-MEDICAL-POS-APP/pos/app.fixed.jsx','utf8');
const a=src.indexOf('function webKey(name){');
const b=src.indexOf('// ── BAR ──',a);
const {webKey,webImgFor}=new Function(src.slice(a,b)+'; return {webKey:webKey,webImgFor:webImgFor};')();

let pass=0,fail=0;
const is=(g,w,n)=>{const ok=g===w;ok?pass++:fail++;console.log(`${ok?'✓':'✗'}  ${n}: got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);};

// the site's catalogue, keyed the same way the app keys it
const site={};
["Zkittles","Alien Mint","Blue Nerdz","Coco Chanel","Gelato X","Crunch Berrie",
 "Sherb Tank","Baby Cake","Ztupid","Black Cherry","Lemon Cherry Gelato"]
  .forEach(n=>{ site[webKey(n)]="img/"+n.toLowerCase().replace(/\s+/g,'-')+".jpg"; });

is(webKey("Zkittles Blunt"), "zkittles", 'strips the format word');
is(webKey("Alien Mint Joint"), "alien mint", 'strips Joint');
is(webKey("( Bar ) Tequila shot"), "tequila shot", 'strips the branch prefix');
is(webKey("OG Kush 1g"), "og kush", 'strips the pack size');
is(webKey("Blue Nerdz  Pre-Roll"), "blue nerdz", 'strips Pre-Roll and collapses spaces');

// the real till names from the screenshot
is(webImgFor("Zkittles Blunt", site), "img/zkittles.jpg", 'Zkittles Blunt finds its photo');
is(webImgFor("Alien Mint Joint", site), "img/alien-mint.jpg", 'Alien Mint Joint finds its photo');
is(webImgFor("Blue Nerdz Joint", site), "img/blue-nerdz.jpg", 'Blue Nerdz Joint finds its photo');
is(webImgFor("CoCo Chanel Joint", site), "img/coco-chanel.jpg", 'case difference still matches');
is(webImgFor("Gelato X Joint", site), "img/gelato-x.jpg", 'Gelato X Joint finds its photo');
is(webImgFor("Sherb Tank 3.5g", site), "img/sherb-tank.jpg", 'a weight suffix still matches');

// must NOT match
is(webImgFor("Grape Stank Joint", site), "", 'a strain the site does not carry gets nothing');
is(webImgFor("Bong XL ( 50 cm )", site), "", 'an accessory does not borrow a strain photo');
is(webImgFor("", site), "", 'an empty name matches nothing');
is(webImgFor("Crispy Boy lager Can", site), "", 'beer does not match a strain');

console.log(`\n${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
