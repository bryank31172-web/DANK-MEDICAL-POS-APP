import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const ART_STYLE = "hyper-saturated neon comic and airbrush street-art poster; thick glowing magenta-purple neon border with a melted drip along the top edge, rounded corners, black background, volumetric neon smoke, sparkles and glow, bold high-contrast cel shading with heavy black outlines";

export function artworkKey(p) {
  return String(p?.id || p?.sku || p?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

export function isWeedProduct(p) {
  const s = `${p?.category || p?.cat || ""} ${p?.name || ""}`.toLowerCase();
  return /flower|weed|cannabis|strain|bud|pre[- ]?roll|joint|exotic|top ?shelf|midgrade/.test(s)
    && !/paper|tray|grinder|bong|lighter|bag|shirt|beer|cocktail/.test(s);
}

export async function curatedNames() {
  const raw = JSON.parse(await readFile(join(process.cwd(), "products.json"), "utf8"));
  return new Set((Array.isArray(raw) ? raw : raw.products || []).map((p) => String(p.name || "").toLowerCase().trim()));
}

export function extractResponseText(j) {
  if (typeof j?.output_text === "string") return j.output_text;
  return (j?.output || []).flatMap((o) => o?.content || []).map((c) => c?.text || c?.output_text || "").join("\n");
}

export function parseResearch(text, name) {
  const fenced = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let j; try { j = JSON.parse(fenced); } catch { return null; }
  const type = /^(indica|sativa|hybrid)$/i.test(j.type || "") ? j.type[0].toUpperCase() + j.type.slice(1).toLowerCase() : "Hybrid";
  const sources = (Array.isArray(j.sources) ? j.sources : []).filter((u) => /^https:\/\/(?:[^/]+\.)?(?:leafly\.com|weed\.com)\//i.test(u)).slice(0, 4);
  if (!sources.length) return null;
  return {
    name: String(name || ""), type,
    thc: Number.isFinite(+j.thc) ? Math.max(0, Math.min(100, +j.thc)) : 0,
    flavors: (Array.isArray(j.flavors) ? j.flavors : []).map(String).slice(0, 5),
    effects: (Array.isArray(j.effects) ? j.effects : []).map(String).slice(0, 5),
    description: String(j.description || "").slice(0, 500),
    character: String(j.character || "a distinctive original character inspired by the strain name").slice(0, 300),
    sources,
  };
}

export function artworkPrompt(meta) {
  return `Create NEW artwork for the cannabis strain "${meta.name}". ${meta.character}. Flavour cues: ${meta.flavors.join(", ") || "use the strain name"}. Match the reference image's visual identity, frame geometry, line weight, lighting and colour intensity, but do not copy its character. Style: ${ART_STYLE}. NO text, NO letters, NO logo, NO watermark. Square 1:1, character centred, retail product tile.`;
}
