/* /api/grok — the AI endpoint CLINICWORKS POS has always called but never had.

   The POS speaks the Anthropic Messages shape ({system, messages, max_tokens}
   in, content[0].text out) because that is what it was written against. xAI
   speaks the OpenAI chat-completions shape. This translates between the two so
   the POS keeps its contract and the bill goes to the xAI account already in
   use by the storefront — no second AI subscription.

   The POS also sends model:"claude-sonnet-4-6", which is not a model that
   exists anywhere. It is ignored: the model comes from GROK_MODEL.

   Actions
     POST ?action=chat    {system, messages[]}        -> {content:[{text}]}
     POST ?action=vision  {image, system, prompt}     -> {content:[{text}]}
     POST ?action=video   {prompt, duration}          -> {request_id}
     GET  ?action=job&id= poll a video job            -> {status, url}

   Errors come back as content[0].text rather than a bare {error}, because that
   is where the POS looks — a 500 with the wrong shape shows staff nothing but
   "having trouble connecting", which is how this went unnoticed.

   Env
     XAI_API_KEY        required. console.x.ai
     GROK_MODEL         optional, default "grok-4"
     GROK_VISION_MODEL  optional, defaults to GROK_MODEL
     XAI_VIDEO_URL      optional. Only set this if you have a Grok Imagine
                        video endpoint that takes {prompt,duration} and returns
                        a job id. Without it the POS's "Generate via API"
                        button reports that it is off and staff use the
                        grok.com/imagine link sitting next to it.
     XAI_JOB_URL        optional, job-status URL; "{id}" is replaced.
     ALLOWED_ORIGIN     optional, extra hosts allowed to call this.           */

import { requireSameOrigin } from "./_auth.js";
import { requireRate } from "./_ratelimit.js";

const XAI = "https://api.x.ai/v1/chat/completions";
const MAX_TEXT_BODY = 60000;      // a fat system prompt plus history
const MAX_VISION_BODY = 6000000;  // a 1100px JPEG data URI is ~300-600KB
const MAX_SYSTEM = 24000;
const MAX_TOKENS_CAP = 2000;

const said = (text) => ({ content: [{ type: "text", text: String(text) }] });

function bodyOf(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return {}; } }
  return b;
}

/** xAI chat-completions -> the Anthropic-shaped reply the POS parses. */
async function callXai(messages, maxTokens, model) {
  const r = await fetch(XAI, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Math.min(Math.max(+maxTokens || 600, 1), MAX_TOKENS_CAP),
      temperature: 0.5,
    }),
  });
  const raw = await r.text();
  if (!r.ok) {
    // surface the real reason (bad key, no credit, unknown model) - staff can act on it
    let why = raw.slice(0, 300);
    try { const j = JSON.parse(raw); why = j?.error?.message || j?.error || why; } catch {}
    throw new Error(`xAI ${r.status}: ${why}`);
  }
  let j; try { j = JSON.parse(raw); } catch { throw new Error("xAI returned non-JSON"); }
  const text = j?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("xAI returned no message content");
  return text;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!requireSameOrigin(req, res)) return;

  const action = String(new URL(req.url, "https://local.host").searchParams.get("action") || "chat");

  if (!process.env.XAI_API_KEY) {
    const msg = "AI not configured — add XAI_API_KEY in Vercel, then redeploy.";
    if (action === "job" || action === "video") return res.status(200).json({ status: "failed", error: msg });
    return res.status(200).json(said(msg));
  }

  const model = process.env.GROK_MODEL || "grok-4";

  try {
    /* ── video: only real when an Imagine endpoint is configured ─────────── */
    if (action === "video") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      if (!(await requireRate(req, res, "grok_video", 6, 600))) return;
      const url = process.env.XAI_VIDEO_URL;
      if (!url) {
        return res.status(200).json({
          error: "Video API is off — use the 'Open Grok Imagine' button and paste the clip back in.",
        });
      }
      const { prompt, duration } = bodyOf(req);
      if (!prompt) return res.status(400).json({ error: "prompt required" });
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: String(prompt).slice(0, 2000), duration: +duration || 10 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(200).json({ error: j?.error?.message || `video ${r.status}` });
      const id = j.request_id || j.id || j.job_id;
      return res.status(200).json(id ? { request_id: id } : { error: "video service returned no job id" });
    }

    /* ── job: poll a video job ───────────────────────────────────────────── */
    if (action === "job") {
      const id = new URL(req.url, "https://local.host").searchParams.get("id");
      if (!id) return res.status(400).json({ status: "failed", error: "id required" });
      const tpl = process.env.XAI_JOB_URL;
      if (!tpl) return res.status(200).json({ status: "failed", error: "Video API is off." });
      const r = await fetch(tpl.replace("{id}", encodeURIComponent(id)), {
        headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(200).json({ status: "failed", error: `job ${r.status}` });
      const st = String(j.status || "").toLowerCase();
      const url = j.url || j.video_url || j.output?.url || (Array.isArray(j.output) ? j.output[0] : null);
      if (url && (st === "done" || st === "succeeded" || st === "completed")) return res.status(200).json({ status: "done", url });
      if (st === "failed" || st === "expired" || st === "error") return res.status(200).json({ status: "failed", error: j.error || st });
      return res.status(200).json({ status: "pending" });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    /* ── vision: receipt / invoice scanning ──────────────────────────────── */
    if (action === "vision") {
      if (!(await requireRate(req, res, "grok_vision", 30, 300))) return;
      let size = 0; try { size = JSON.stringify(req.body || {}).length; } catch { size = MAX_VISION_BODY + 1; }
      if (size > MAX_VISION_BODY) return res.status(200).json(said("Image too large — retake the photo."));

      const { image, system, prompt } = bodyOf(req);
      if (!image || typeof image !== "string") return res.status(200).json(said("No image received."));
      if (!/^data:image\/(jpe?g|png|webp);base64,/i.test(image)) {
        return res.status(200).json(said("Unsupported image format."));
      }
      const messages = [];
      if (system) messages.push({ role: "system", content: String(system).slice(0, MAX_SYSTEM) });
      messages.push({
        role: "user",
        content: [
          { type: "text", text: String(prompt || "Describe this image.").slice(0, 4000) },
          { type: "image_url", image_url: { url: image } },
        ],
      });
      const text = await callXai(messages, 1200, process.env.GROK_VISION_MODEL || model);
      return res.status(200).json(said(text));
    }

    /* ── chat: everything behind a 🤖 AI button ──────────────────────────── */
    if (!(await requireRate(req, res, "grok_chat", 40, 300))) return;
    let size = 0; try { size = JSON.stringify(req.body || {}).length; } catch { size = MAX_TEXT_BODY + 1; }
    if (size > MAX_TEXT_BODY) return res.status(200).json(said("Request too large."));

    const b = bodyOf(req);
    const inMsgs = Array.isArray(b.messages) ? b.messages : [];
    if (!inMsgs.length) return res.status(200).json(said("No question received."));

    const messages = [];
    if (b.system) messages.push({ role: "system", content: String(b.system).slice(0, MAX_SYSTEM) });
    for (const m of inMsgs.slice(-12)) {
      // Anthropic allows content as a string or as blocks; the POS sends strings
      const c = typeof m?.content === "string"
        ? m.content
        : Array.isArray(m?.content) ? m.content.map((x) => x?.text || "").join(" ") : "";
      if (!c) continue;
      messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: c.slice(0, 8000) });
    }
    if (messages.length === (b.system ? 1 : 0)) return res.status(200).json(said("No question received."));

    const text = await callXai(messages, b.max_tokens, model);
    return res.status(200).json(said(text));
  } catch (e) {
    console.error("grok endpoint:", e?.message || e);
    const msg = `AI error — ${String(e?.message || e).slice(0, 200)}`;
    if (action === "job" || action === "video") return res.status(200).json({ status: "failed", error: msg });
    return res.status(200).json(said(msg));
  }
}
