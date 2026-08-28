import { put } from "@vercel/blob";
import { requireSameOrigin } from "./_auth.js";
import { requireRate } from "./_ratelimit.js";
import { getJSON, setJSON } from "./_store.js";
import { artworkKey, artworkPrompt, curatedNames, extractResponseText, isWeedProduct, parseResearch } from "./_artwork.js";

const XAI = "https://api.x.ai/v1";
const TTL = 60 * 60 * 24 * 365;
const REF = "https://dank-medical-pos-app.vercel.app/assets/products/ztupid.jpg";

async function research(name) {
  const prompt = `Research the cannabis strain named "${name}" using only Leafly and weed.com. Do not guess. Return ONLY JSON: {"type":"Indica|Sativa|Hybrid","thc":number_or_0,"flavors":[strings],"effects":[strings],"description":"two factual non-medical sentences","character":"one original neon character concept based on the name and flavors","sources":[exact URLs used]}. If names conflict, describe only the closest exact strain and keep THC 0.`;
  const r = await fetch(`${XAI}/responses`, { method:"POST", headers:{Authorization:`Bearer ${process.env.XAI_API_KEY}`,"Content-Type":"application/json"}, body:JSON.stringify({model:process.env.GROK_MODEL||"grok-4.6",input:[{role:"user",content:prompt}],tools:[{type:"web_search",filters:{allowed_domains:["leafly.com","weed.com"]}}]}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`research ${r.status}: ${j?.error?.message || "xAI error"}`);
  const meta = parseResearch(extractResponseText(j), name);
  if (!meta) throw new Error("research returned no verifiable Leafly/weed.com source");
  return meta;
}

async function generate(meta, key) {
  const r = await fetch(`${XAI}/images/edits`, { method:"POST", headers:{Authorization:`Bearer ${process.env.XAI_API_KEY}`,"Content-Type":"application/json"}, body:JSON.stringify({model:process.env.XAI_IMAGE_MODEL||"grok-imagine-image-2.0",prompt:artworkPrompt(meta),image:{url:process.env.ARTWORK_REFERENCE_URL||REF,type:"image_url"},response_format:"url"}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.data?.[0]?.url) throw new Error(`image ${r.status}: ${j?.error?.message || "no image URL"}`);
  const img = await fetch(j.data[0].url);
  if (!img.ok) throw new Error(`image download ${img.status}`);
  const bytes = Buffer.from(await img.arrayBuffer());
  if (bytes.length > 8_000_000) throw new Error("generated image exceeds 8MB");
  const blob = await put(`products/auto/${key}.jpg`, bytes, {access:"public",contentType:img.headers.get("content-type")||"image/jpeg",addRandomSuffix:false,allowOverwrite:true});
  return blob.url;
}

export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!requireSameOrigin(req,res)) return;
  if (req.method !== "POST") return res.status(405).json({error:"POST only"});
  if (!(await requireRate(req,res,"product_artwork",6,3600))) return;
  if (!process.env.XAI_API_KEY || !process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({configured:false,detail:"XAI_API_KEY and BLOB_READ_WRITE_TOKEN are required",items:[]});
  const products = Array.isArray(req.body?.products) ? req.body.products.slice(0,500) : [];
  const known = await curatedNames();
  const eligible = products.filter(isWeedProduct).filter((p) => !known.has(String(p.name||"").toLowerCase().trim()));
  const items = [];
  let generated = false;
  for (const p of eligible) {
    const key = artworkKey(p); if (!key) continue;
    const cacheKey = `product-artwork:${key}`;
    let rec = await getJSON(cacheKey);
    if (!rec && !generated) {
      generated = true;
      try { const meta = await research(String(p.name||"")); const image = await generate(meta,key); rec={...meta,image,status:"ready",generatedAt:new Date().toISOString()}; await setJSON(cacheKey,rec,TTL); }
      catch(e) { rec={name:p.name,status:"error",error:String(e?.message||e).slice(0,220)}; await setJSON(cacheKey,rec,60*60*24); }
    }
    if (rec) items.push({id:p.id,...rec});
  }
  return res.status(200).json({configured:true,eligible:eligible.length,items});
}
