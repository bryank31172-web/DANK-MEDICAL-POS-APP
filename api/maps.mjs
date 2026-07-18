// BRYAN POS — Google Maps Routes proxy (key stays server-side in Vercel env var GMAPS_KEY)
// GET /api/maps?origin=<address>&dest=<address>            → { km, minutes }  (single route, traffic-aware)
// GET /api/maps?action=matrix&dest=<address>&origins=<json array> → { results:[{i,km,minutes}] } (compare branches)
// Add &debug=1 to see raw upstream response for troubleshooting.
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

function secOf(d) { return parseInt(String(d || "0").replace("s", ""), 10) || 0; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.GMAPS_KEY;
  let u;
  try { u = new URL(req.url, "http://x"); } catch (e) { return res.status(400).json({ error: "bad url" }); }
  const q = function (k) { return u.searchParams.get(k); };
  if (!key) return res.status(500).json({ error: "GMAPS_KEY not configured — add it in Vercel Settings → Environment Variables" });
  const dest = q("dest");
  const debug = q("debug");

  try {
    if (q("action") === "matrix") {
      let origins = [];
      try { origins = JSON.parse(q("origins") || "[]"); } catch (e) {}
      if (!dest || !origins.length) return res.status(400).json({ error: "need ?dest= and ?origins=[...]" });
      origins = origins.slice(0, 10);
      const r = await fetch(MATRIX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "originIndex,destinationIndex,duration,staticDuration,distanceMeters,condition"
        },
        body: JSON.stringify({
          origins: origins.map(function (a) { return { waypoint: { address: a } }; }),
          destinations: [{ waypoint: { address: dest } }],
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          languageCode: "th-TH"
        })
      });
      const j = await r.json().catch(function () { return {}; });
      if (debug) return res.status(200).json({ upstreamStatus: r.status, body: j });
      const arr = Array.isArray(j) ? j : (j.elements || []);
      if (!r.ok) return res.status(502).json({ error: (j && j.error && j.error.message) || ("matrix failed " + r.status) });
      const results = arr
        .filter(function (e) { return e && e.distanceMeters && e.condition !== "ROUTE_NOT_FOUND"; })
        .map(function (e) {
          return {
            i: e.originIndex || 0,
            km: Math.round((e.distanceMeters / 1000) * 10) / 10,
            minutes: Math.max(5, Math.round(secOf(e.duration || e.staticDuration) / 60))
          };
        });
      return res.status(200).json({ results: results });
    }

    // single route
    const origin = q("origin");
    if (!origin || !dest) return res.status(400).json({ error: "need ?origin= and ?dest=" });
    const r = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: dest },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "th-TH",
        units: "METRIC"
      })
    });
    const j = await r.json().catch(function () { return {}; });
    if (debug) return res.status(200).json({ upstreamStatus: r.status, body: j });
    const rt = j && j.routes && j.routes[0];
    if (!r.ok || !rt || !rt.distanceMeters) {
      return res.status(502).json({ error: (j && j.error && j.error.message) || "no route found" });
    }
    return res.status(200).json({
      km: Math.round((rt.distanceMeters / 1000) * 10) / 10,
      minutes: Math.max(5, Math.round(secOf(rt.duration || rt.staticDuration) / 60))
    });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
