import http from 'node:http';
import { URL } from 'node:url';

const host='127.0.0.1';
const port=Math.max(1,Math.min(65535,Number(process.env.CLINIC_BRIDGE_PORT)||17891));
const secret=String(process.env.CLINIC_BRIDGE_SECRET||'');
const configuredOrigins=String(process.env.CLINIC_BRIDGE_ORIGINS||'https://dank-medical-pos-app.vercel.app,http://127.0.0.1:8799,http://localhost:8799')
  .split(',').map(s=>s.trim()).filter(Boolean);
let latest=null;
const byPatient=new Map();

function originAllowed(origin){
  if(!origin)return true;
  if(configuredOrigins.includes(origin))return true;
  try{const u=new URL(origin);return (u.hostname==='127.0.0.1'||u.hostname==='localhost')&&u.protocol==='http:';}catch{return false;}
}
function cors(req,res){
  const origin=req.headers.origin||'';
  if(originAllowed(origin)&&origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Clinic-Bridge-Secret');
  res.setHeader('Access-Control-Allow-Private-Network','true');
  res.setHeader('Cache-Control','no-store');
}
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
export function normalize(body){
  const d=body?.data||body?.reading||body?.vitals||body||{};
  const t=finite(d.temperatureC??d.temperature_c);
  const w=finite(d.weightKg??d.weight_kg);
  const h=finite(d.heightCm??d.height_cm);
  const errors=[];
  if(t!==null&&(t<30||t>45))errors.push('temperatureC must be 30-45');
  if(w!==null&&(w<2||w>350))errors.push('weightKg must be 2-350');
  if(h!==null&&(h<30||h>250))errors.push('heightCm must be 30-250');
  if(t===null&&w===null&&h===null)errors.push('at least one vital value is required');
  if(errors.length)return {errors};
  const reading={
    temperatureC:t,weightKg:w,heightCm:h,
    patientId:String(d.patientId??d.patient_id??body.patientId??body.patient_id??''),
    measuredAt:d.measuredAt||d.measured_at||new Date().toISOString(),
    deviceId:String(d.deviceId??d.device_id??body.deviceId??body.device_id??''),
    source:String(d.source||body.source||'local-device-bridge')
  };
  return {reading};
}
function readBody(req){
  return new Promise((resolve,reject)=>{let raw='';req.setEncoding('utf8');req.on('data',chunk=>{raw+=chunk;if(raw.length>65536){reject(new Error('payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('invalid JSON'));}});req.on('error',reject);});
}

export const server=http.createServer(async(req,res)=>{
  cors(req,res);
  const origin=req.headers.origin||'';
  if(!originAllowed(origin))return json(res,403,{ok:false,error:'origin not allowed'});
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  const url=new URL(req.url||'/',`http://${host}:${port}`);
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'clinicworks-device-bridge',time:new Date().toISOString(),hasReading:!!latest});
  if(req.method==='GET'&&url.pathname==='/v1/vitals/latest'){
    const patientId=url.searchParams.get('patientId')||'';
    const reading=patientId?(byPatient.get(patientId)||latest):latest;
    return json(res,200,{ok:true,reading:reading||null});
  }
  if(req.method==='POST'&&url.pathname==='/v1/vitals'){
    if(secret&&req.headers['x-clinic-bridge-secret']!==secret)return json(res,401,{ok:false,error:'invalid bridge secret'});
    try{
      const result=normalize(await readBody(req));
      if(result.errors)return json(res,422,{ok:false,errors:result.errors});
      latest=result.reading;if(latest.patientId)byPatient.set(latest.patientId,latest);
      return json(res,201,{ok:true,reading:latest});
    }catch(e){return json(res,400,{ok:false,error:e.message||'bad request'});}
  }
  return json(res,404,{ok:false,error:'not found'});
});

if(process.env.CLINIC_BRIDGE_TEST!=='1'){
  server.listen(port,host,()=>{
    console.log(`ClinicWorks Device Bridge listening on http://${host}:${port}`);
    console.log('POST normalized readings to /v1/vitals; ClinicWorks reads /v1/vitals/latest');
  });
}
