process.env.CLINIC_BRIDGE_TEST='1';
const {normalize,server}=await import('./server.mjs');
let pass=0,total=0;
function check(ok,note){total++;if(ok){pass++;console.log('✓ '+note);}else console.error('✗ '+note);}

let r=normalize({temperatureC:36.7,weightKg:68.25,heightCm:172.4,deviceId:'TEST-001'});
check(r.reading&&r.reading.temperatureC===36.7&&r.reading.deviceId==='TEST-001','accepts normalized complete reading');
r=normalize({vitals:{temperature_c:36.5,source:'thermometer'}});
check(r.reading&&r.reading.temperatureC===36.5&&r.reading.weightKg===null,'accepts partial thermometer reading');
r=normalize({temperatureC:99});
check(r.errors&&r.errors[0].includes('30-45'),'rejects impossible temperature');
r=normalize({});
check(r.errors&&r.errors.length,'rejects empty payload');

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
let response=await fetch(base+'/health',{headers:{Origin:'https://dank-medical-pos-app.vercel.app'}});
check(response.ok&&(await response.json()).service==='clinicworks-device-bridge','health endpoint is reachable');
response=await fetch(base+'/v1/vitals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({temperatureC:36.8,deviceId:'HTTP-TEST'})});
check(response.status===201,'adapter can POST a reading');
response=await fetch(base+'/v1/vitals/latest');
const latest=await response.json();
check(latest.reading?.temperatureC===36.8&&latest.reading?.deviceId==='HTTP-TEST','POS can read the latest measurement');
response=await fetch(base+'/v1/vitals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({weightKg:999})});
check(response.status===422,'HTTP endpoint rejects unsafe values');
await new Promise(resolve=>server.close(resolve));

console.log(`\n${pass}/${total} passed`);
process.exit(pass===total?0:1);
