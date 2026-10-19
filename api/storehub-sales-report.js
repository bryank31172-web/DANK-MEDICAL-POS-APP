import { requireStaff } from "./_auth.js";
import { fetchStoreHubSales } from "./_storehub-sales.js";
export default async function handler(req,res) {
  res.setHeader("Cache-Control","private, no-store");
  if (!requireStaff(req,res)) return;
  if (req.method !== "GET") return res.status(405).json({error:"GET only"});
  const date=String(req.query.date||"");
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:"date=YYYY-MM-DD required"});
  try {
    const report=await fetchStoreHubSales(date);
    return res.status(report.complete?200:502).json(report);
  } catch(e) { return res.status(502).json({error:"Sales retrieval failed",detail:e.message}); }
}