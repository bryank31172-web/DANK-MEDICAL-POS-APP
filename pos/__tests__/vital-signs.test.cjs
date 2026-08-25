/* Pure vital-sign parsing and clinical guardrails from app.fixed.jsx.
 *
 *   node pos/__tests__/vital-signs.test.cjs
 */
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','app.fixed.jsx'),'utf8');
const start=src.indexOf('const VITAL_LIMITS=');
const end=src.indexOf('// Serial scales send things like',start);
if(start<0||end<0)throw new Error('vital helper markers missing');
const api=new Function(src.slice(start,end)+'; return {calcVitalBMI,validateVitalValue,parsePatientScaleLine,normalizeVitalPayload};')();
let pass=0,total=0;
function check(ok,note){total++;if(ok){pass++;console.log('✓ '+note);}else console.error('✗ '+note);}

check(api.calcVitalBMI(70,175)===22.9,'BMI uses kg and metres, rounded to 1 decimal');
check(api.calcVitalBMI('',175)===null,'BMI rejects a missing measurement');
check(api.validateVitalValue('temperatureC',36.7).ok,'normal temperature accepted');
check(!api.validateVitalValue('temperatureC',49).ok,'impossible temperature blocked');
check(!api.validateVitalValue('weightKg',0.132).ok,'product-scale gram value cannot become patient weight');

let r=api.parsePatientScaleLine('WT: 72.45 kg, HT: 175.2 cm');
check(r&&r.weightKg===72.45&&r.heightCm===175.2,'combined physician scale line');
r=api.parsePatientScaleLine('ST,WT,+ 165.3 lb');
check(r&&Math.abs(r.weightKg-74.98)<0.01,'pounds converted to kilograms');
r=api.parsePatientScaleLine('Height=1.805 m');
check(r&&r.heightCm===180.5,'metres converted to centimetres');
check(api.parsePatientScaleLine('72.45')===null,'ambiguous bare number is never guessed');

r=api.normalizeVitalPayload({data:{temperature:{value:98.6,unit:'F'},weight:{value:70000,unit:'g'},height:{value:1.75,unit:'m'},deviceId:'gateway-1'}});
check(r.temperatureC===37&&r.weightKg===70&&r.heightCm===175&&r.deviceId==='gateway-1','Device Bridge units normalize safely');
r=api.normalizeVitalPayload({vitals:{temperature_c:36.6,weight_kg:64.2,height_cm:168}});
check(r.temperatureC===36.6&&r.weightKg===64.2&&r.heightCm===168,'snake_case bridge payload supported');

check(src.includes('localStorage.getItem("dank_vital_signs")'),'patient vital history is persisted');
check(src.includes('addAudit("VITAL_SIGNS_RECORDED"'),'every confirmed reading writes Audit Log');
check(src.includes('navigator.serial.requestPort()')&&src.includes('connectPatientScale'),'patient scale is wired to Web Serial');
check(src.includes('/v1/vitals/latest')&&src.includes('Clinic Device Bridge'),'vendor SDK readings are wired through Device Bridge');
check(src.includes('vital-signs scanner'),'Member QR/customer scan is wired into the workflow');

console.log('\n'+pass+'/'+total+' passed');
process.exit(pass===total?0:1);
