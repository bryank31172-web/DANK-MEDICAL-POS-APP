// StoreHub API proxy v5 — /digest (AI Spot text) + /report (daily business report JSON).
const ALLOWED = ["products", "transactions", "customers", "inventory", "employees", "stores", "timesheets", "digest", "report"];

async function shFetch(path, auth) {
  const r = await fetch("https://api.storehubhq.com/" + path, { headers: { Authorization: auth, Accept: "application/json" } });
  if (!r.ok) throw new Error(path + " -> " + r.status);
  return r.json();
}

const BKK = 7 * 3600 * 1000;
const bkkDay = (t) => new Date(new Date(t).getTime() + BKK).toISOString().slice(0, 10);

async function stockTotals(stores, auth) {
  const totals = {}; let tracked = false;
  for (const st of (Array.isArray(stores) ? stores : [])) {
    try {
      const inv = await shFetch("inventory/" + st.id, auth);
      (Array.isArray(inv) ? inv : []).forEach(iv => {
        const pid = iv.productId || iv.id;
        const q = +((iv.quantityOnHand !== undefined ? iv.quantityOnHand : (iv.qty !== undefined ? iv.qty : (iv.quantity !== undefined ? iv.quantity : (iv.stock !== undefined ? iv.stock : iv.onHand))))) || 0;
        if (pid) { totals[pid] = (totals[pid] || 0) + q; tracked = true; }
      });
    } catch (e) {}
  }
  return { totals, tracked };
}

async function buildDigest(auth) {
  const [products, stores] = await Promise.all([shFetch("products", auth), shFetch("stores", auth)]);
  const { totals } = await stockTotals(stores, auth);
  let sold = {};
  try {
    const to = new Date(Date.now() + BKK + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const tx = await shFetch("transactions?from=" + from + "&to=" + to, auth);
    (Array.isArray(tx) ? tx : []).forEach(t => (t.items || []).forEach(it => { if (it.productId) sold[it.productId] = true; }));
  } catch (e) { sold = null; }
  const neg = [], out = [], low = [], loss = [], sleep = [];
  (Array.isArray(products) ? products : []).forEach(p => {
    const st = totals[p.id];
    const name = p.name || p.id;
    if (st !== undefined) {
      if (st < 0) neg.push(name + " (" + st + ")");
      else if (st === 0) out.push(name);
      else if (st <= 10) low.push(name + " (" + st + " left)");
      if (sold && st > 0 && !sold[p.id]) sleep.push(name + " (" + st + " sitting)");
    }
    const price = +p.unitPrice || 0, cost = +p.cost || 0;
    if (price > 0 && cost > 0 && price < cost) loss.push(name + " (THB " + Math.round(price) + " < cost THB " + Math.round(cost) + ")");
  });
  const L = [];
  L.push("BRYAN POS — AI SPOT INVENTORY DIGEST");
  L.push("Generated: " + new Date().toISOString());
  L.push("Products: " + (products.length || 0) + " · Stores: " + (stores.length || 0));
  L.push("");
  const sec = (title, arr, cap) => {
    L.push(title + " — " + arr.length);
    arr.slice(0, cap).forEach(x => L.push("  • " + x));
    if (arr.length > cap) L.push("  … +" + (arr.length - cap) + " more");
    L.push("");
  };
  sec("NEGATIVE STOCK (fix counts)", neg, 15);
  sec("OUT OF STOCK", out, 15);
  sec("LOW STOCK <=10 (reorder soon)", low, 20);
  sec("PRICE BELOW COST (loss per sale)", loss, 15);
  if (sold) sec("NO SALES 30 DAYS (promo candidates)", sleep, 10);
  L.push(neg.length + out.length + loss.length ? "ACTION NEEDED: yes" : (low.length ? "ACTION NEEDED: reorders only" : "ALL CLEAR"));
  return L.join("\n");
}

async function buildReport(auth) {
  const [products, stores] = await Promise.all([shFetch("products", auth), shFetch("stores", auth)]);
  const pName = {}; const pPrice = {}; const pCost = {};
  (Array.isArray(products) ? products : []).forEach(p => { pName[p.id] = p.name || p.id; pPrice[p.id] = +p.unitPrice || 0; pCost[p.id] = +p.cost || 0; });
  const sName = {};
  (Array.isArray(stores) ? stores : []).forEach(s => { sName[s.id] = s.name || s.id; });

  const yDate = bkkDay(Date.now() - 24 * 3600 * 1000);
  const from = new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + BKK + 24 * 3600 * 1000).toISOString().slice(0, 10);
  let tx = [];
  try { tx = await shFetch("transactions?from=" + from + "&to=" + to, auth); } catch (e) {}
  tx = (Array.isArray(tx) ? tx : []).filter(t => !(/return|refund|void/i.test(String(t.transactionType || ""))));

  const dayMap = {}; const yStores = {}; const yProd = {}; const sold7 = {};
  let yTotal = 0, yBills = 0;
  tx.forEach(t => {
    const d = bkkDay(t.transactionTime || 0);
    if (!d) return;
    if (!dayMap[d]) dayMap[d] = { date: d, total: 0, bills: 0 };
    dayMap[d].total += (+t.total || 0); dayMap[d].bills += 1;
    (t.items || []).forEach(it => { if (it.productId) sold7[it.productId] = true; });
    if (d === yDate) {
      yTotal += (+t.total || 0); yBills += 1;
      const sk = sName[t.storeId] || t.storeId || "?";
      if (!yStores[sk]) yStores[sk] = { name: sk, total: 0, bills: 0 };
      yStores[sk].total += (+t.total || 0); yStores[sk].bills += 1;
      (t.items || []).forEach(it => {
        if (!it.productId) return;
        if (!yProd[it.productId]) yProd[it.productId] = { name: pName[it.productId] || it.productId, qty: 0, revenue: 0 };
        yProd[it.productId].qty += (+it.quantity || 0);
        yProd[it.productId].revenue += (+it.total || 0);
      });
    }
  });
  const days = [];
  for (let i = 7; i >= 1; i--) {
    const d = bkkDay(Date.now() - i * 24 * 3600 * 1000);
    days.push(dayMap[d] || { date: d, total: 0, bills: 0 });
  }
  const weekTotal = days.reduce((s, d) => s + d.total, 0);

  const { totals, tracked } = await stockTotals(stores, auth);
  const neg = [], out = [], low = [], loss = [];
  let valCost = 0, valRetail = 0, noSales7 = 0;
  (Array.isArray(products) ? products : []).forEach(p => {
    const st = totals[p.id];
    if (st !== undefined) {
      if (st < 0) neg.push(pName[p.id] + " (" + st + ")");
      else if (st === 0) out.push(pName[p.id]);
      else if (st <= 10) low.push(pName[p.id] + " (" + st + ")");
      if (st > 0) { valCost += st * pCost[p.id]; valRetail += st * pPrice[p.id]; if (!sold7[p.id]) noSales7++; }
    }
    if (pPrice[p.id] > 0 && pCost[p.id] > 0 && pPrice[p.id] < pCost[p.id]) loss.push(pName[p.id]);
  });

  let custTotal = null;
  try { const cs = await shFetch("customers", auth); custTotal = Array.isArray(cs) ? cs.length : null; } catch (e) {}

  return {
    ok: true, generatedAt: new Date().toISOString(), tz: "Asia/Bangkok",
    yesterday: {
      date: yDate, total: Math.round(yTotal), bills: yBills,
      avgBasket: yBills ? Math.round(yTotal / yBills) : 0,
      byStore: Object.values(yStores).sort((a, b) => b.total - a.total).map(s => ({ name: s.name, total: Math.round(s.total), bills: s.bills })),
      topProducts: Object.values(yProd).sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(p => ({ name: p.name, qty: Math.round(p.qty * 10) / 10, revenue: Math.round(p.revenue) }))
    },
    week: { dailyAvg: Math.round(weekTotal / 7), days: days.map(d => ({ date: d.date, total: Math.round(d.total), bills: d.bills })) },
    stock: {
      tracked, negative: neg.slice(0, 15), out: out.slice(0, 15), low: low.slice(0, 20),
      valuationCost: Math.round(valCost), valuationRetail: Math.round(valRetail), noSales7d: noSales7
    },
    priceBelowCost: loss.slice(0, 15),
    customers: { total: custTotal },
    products: { total: Array.isArray(products) ? products.length : 0 }
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  const user = process.env.STOREHUB_USER;
  const key = process.env.STOREHUB_KEY;
  const u = new URL(req.url, "https://local.host");
  const debug = u.searchParams.get("debug") === "1";
  u.searchParams.delete("debug");
  let clean = decodeURIComponent(u.pathname)
    .replace(/^\/api\/storehub\/?/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");
  const sub = u.searchParams.get("sub");
  if (sub) { clean += "/" + String(sub).replace(/[^a-zA-Z0-9/_-]/g, ""); u.searchParams.delete("sub"); }
  u.searchParams.delete("path");
  if (!user || !key) {
    res.status(debug ? 200 : 500).json({ error: "StoreHub credentials not configured. Add STOREHUB_USER and STOREHUB_KEY in Vercel settings, then redeploy." });
    return;
  }
  if (!clean || !ALLOWED.includes(clean.split("/")[0])) {
    res.status(debug ? 200 : 400).json({ error: "Path not allowed: /" + clean, requestUrl: req.url });
    return;
  }
  const auth = "Basic " + Buffer.from(user + ":" + key).toString("base64");
  if (clean === "digest") {
    try {
      const text = await buildDigest(auth);
      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch (e) {
      res.status(502).send("Digest error: " + String(e && e.message));
    }
    return;
  }
  if (clean === "report") {
    try {
      const j = await buildReport(auth);
      res.status(200).json(j);
    } catch (e) {
      res.status(502).json({ error: "Report error: " + String(e && e.message) });
    }
    return;
  }
  const qs = u.searchParams.toString();
  const target = "https://api.storehubhq.com/" + clean + (qs ? "?" + qs : "");
  try {
    const r = await fetch(target, { headers: { Authorization: auth, Accept: "application/json" } });
    const text = await r.text();
    if (debug) {
      res.status(200).json({ target, upstreamStatus: r.status, contentType: r.headers.get("content-type"), bodyPreview: text.slice(0, 600) });
      return;
    }
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "StoreHub upstream error: " + String(e && e.message), target });
  }
}
