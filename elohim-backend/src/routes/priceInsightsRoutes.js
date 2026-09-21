const express = require("express");
const pool = require("../config/db");
const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

let priceIntelligenceReady = false;
const ensurePriceIntelligenceTables = async () => {
  if (priceIntelligenceReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS market_price_observations (
    id BIGSERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    location VARCHAR(120) NOT NULL DEFAULT 'Abuja',
    market VARCHAR(120) NOT NULL DEFAULT 'Abuja',
    price DECIMAL(12,2) NOT NULL CHECK (price > 0),
    unit VARCHAR(80) NOT NULL,
    observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    source VARCHAR(255) NOT NULL DEFAULT 'Elohim catalogue snapshot',
    source_type VARCHAR(50) NOT NULL DEFAULT 'catalogue_snapshot',
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, market, unit, observed_on)
  )`);
  await pool.query(`ALTER TABLE market_price_observations
    ADD COLUMN IF NOT EXISTS location VARCHAR(120) NOT NULL DEFAULT 'Abuja',
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'catalogue_snapshot',
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP
  `);
  await pool.query(`UPDATE market_price_observations
    SET source_type = 'catalogue_snapshot', verification_status = 'verified', verified_at = COALESCE(verified_at, created_at)
    WHERE source = 'Elohim catalogue snapshot' AND verification_status = 'pending'`);
  await pool.query("CREATE INDEX IF NOT EXISTS market_price_observations_lookup_idx ON market_price_observations(product_id, market, unit, observed_on DESC)");
  priceIntelligenceReady = true;
};

const snapshotCataloguePrices = async () => {
  await pool.query(`INSERT INTO market_price_observations (product_id, product_name, location, market, price, unit, observed_on, source, source_type, verification_status, verified_at)
    SELECT p.id, p.name, 'Abuja', 'Elohim catalogue', p.price, COALESCE(NULLIF(p.weight, ''), 'unit'), CURRENT_DATE, 'Elohim catalogue snapshot', 'catalogue_snapshot', 'verified', CURRENT_TIMESTAMP
    FROM products p WHERE COALESCE(p.price, 0) > 0
    ON CONFLICT (product_id, market, unit, observed_on) DO NOTHING`);
};

const calculateMetrics = (observations) => {
  if (!observations.length) return null;
  const sorted = [...observations].sort((a, b) => new Date(a.observed_on) - new Date(b.observed_on));
  const latest = sorted[sorted.length - 1];
  const latestTime = new Date(`${latest.observed_on}T00:00:00Z`).getTime();
  const changeForDays = (days) => {
    const target = latestTime - days * 86400000;
    const baseline = [...sorted].reverse().find((row) => new Date(`${row.observed_on}T00:00:00Z`).getTime() <= target);
    return baseline ? Number((((Number(latest.price) - Number(baseline.price)) / Number(baseline.price)) * 100).toFixed(2)) : null;
  };
  const window90 = sorted.filter((row) => new Date(`${row.observed_on}T00:00:00Z`).getTime() >= latestTime - 90 * 86400000);
  const values = window90.map((row) => Number(row.price));
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(values.length, 1);
  return {
    product_id: latest.product_id,
    current_price: Number(latest.price), unit: latest.unit, market: latest.market, observed_on: latest.observed_on,
    change_7d: changeForDays(7), change_30d: changeForDays(30), change_90d: changeForDays(90),
    high_90d: Math.max(...values), low_90d: Math.min(...values), market_range_low: Math.min(...values), market_range_high: Math.max(...values), volatility_90d: mean ? Number((Math.sqrt(variance) / mean * 100).toFixed(2)) : 0,
    observation_count: sorted.length, verified_observation_count: sorted.length,
    verified_source_count: new Set(sorted.map((row) => `${row.source_type}:${row.source}`)).size,
  };
};

const ensurePriceAlerts = () => pool.query(`CREATE TABLE IF NOT EXISTS product_price_follows (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  baseline_price DECIMAL(12,2) NOT NULL, threshold_percent DECIMAL(5,2) NOT NULL DEFAULT 3, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,product_id)
)`);

router.post("/follow", verifyToken, async (req,res) => {
  try { await ensurePriceAlerts(); const { product_id, threshold_percent }=req.body; const product=await pool.query("SELECT id,price FROM products WHERE id=$1",[product_id]); if(!product.rows[0])return res.status(404).json({error:"Product not found"}); const threshold=Math.max(1,Number(threshold_percent)||3); const result=await pool.query(`INSERT INTO product_price_follows (user_id,product_id,baseline_price,threshold_percent) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,product_id) DO UPDATE SET baseline_price=EXCLUDED.baseline_price,threshold_percent=EXCLUDED.threshold_percent,created_at=CURRENT_TIMESTAMP RETURNING *`,[req.user.id,product_id,product.rows[0].price,threshold]);res.status(201).json(result.rows[0]); }
  catch(err){console.error("FOLLOW PRICE ERROR:",err);res.status(500).json({error:"Failed to follow product price"});}
});
router.delete("/follow/:productId", verifyToken, async (req,res) => { try { await ensurePriceAlerts();await pool.query("DELETE FROM product_price_follows WHERE user_id=$1 AND product_id=$2",[req.user.id,req.params.productId]);res.status(204).end(); } catch(err){res.status(500).json({error:"Failed to unfollow product price"});} });
router.get("/alerts/me", verifyToken, async (req,res) => { try { await ensurePriceAlerts();const result=await pool.query(`SELECT f.*,p.name,p.price,ROUND(((p.price-f.baseline_price)/NULLIF(f.baseline_price,0))*100,2) AS change_percent FROM product_price_follows f JOIN products p ON p.id=f.product_id WHERE f.user_id=$1 AND ABS((p.price-f.baseline_price)/NULLIF(f.baseline_price,0)*100)>=f.threshold_percent ORDER BY f.created_at DESC`,[req.user.id]);res.json({methodology:"Alerts compare the current Elohim product price with the price recorded when you followed it. An alert appears only when the selected percentage threshold is reached.",alerts:result.rows});}catch(err){console.error("PRICE ALERTS ERROR:",err);res.status(500).json({error:"Failed to load price alerts"});} });

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatProductKey = (name) => String(name || "").trim().toLowerCase();

const getBasePrice = (products, keyword, fallbackPrice) => {
  const product = products.find((item) => formatProductKey(item.name).includes(keyword));
  return Number(product?.market_price || fallbackPrice || 0);
};

const generateTrend = (basePrice, commodity, slope, volatility) => {
  const now = new Date();

  return Array.from({ length: 12 }, (_, index) => {
    const monthOffset = index - 8;
    const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const wave = Math.sin((index + commodity.length) * 0.9) * volatility;
    const marketPressure = 1 + (index - 8) * slope + wave;
    const price = Math.max(0, Math.round(basePrice * marketPressure));

    return {
      month: `${monthLabels[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
      commodity,
      price,
      predicted: index >= 9,
    };
  });
};

const getRecommendation = (trend) => {
  const current = trend[8];
  const next = trend[9];
  const future = trend[11];
  const change = current?.price ? ((future.price - current.price) / current.price) * 100 : 0;

  if (change >= 6) {
    return {
      action: "Buy now",
      confidence: 84,
      reason: "Projected prices are rising over the next three months.",
      expected_change: change,
    };
  }

  if (change <= -3) {
    return {
      action: "Wait 2-3 weeks",
      confidence: 71,
      reason: "Short-term projections show a mild price cooldown.",
      expected_change: change,
    };
  }

  return {
    action: "Buy gradually",
    confidence: 76,
    reason: "Prices look stable, so split purchases to reduce timing risk.",
    expected_change: change,
  };
};

router.get("/admin/inventory-signals", verifyToken, isAdmin, async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT p.id,p.name,COALESCE(p.stock_quantity,0)::int AS stock,
        COALESCE(SUM(oi.quantity) FILTER (WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'),0)::int AS units_sold
      FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id
      GROUP BY p.id,p.name,p.stock_quantity ORDER BY units_sold DESC, stock ASC LIMIT 30`);
    const velocity = rows.rows.map((x) => ({ ...x, velocity: Number(x.units_sold) >= 20 ? "High" : Number(x.units_sold) >= 5 ? "Medium" : "Low" }));
    res.json({ signals: velocity.map((x) => ({ ...x, action: x.stock <= 0 ? "Restock urgently" : x.stock <= 20 && x.velocity === "High" ? "Review restocking" : x.stock <= 20 ? "Monitor stock" : "Stock healthy" })) });
  } catch (err) { console.error("PRICE INVENTORY SIGNAL ERROR:", err); res.status(500).json({ error: "Failed to load inventory signals" }); }
});

router.get("/admin/observations", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensurePriceIntelligenceTables();
    const result = await pool.query(`SELECT o.*, u.name AS recorded_by FROM market_price_observations o LEFT JOIN users u ON u.id=o.created_by ORDER BY o.observed_on DESC, o.id DESC LIMIT 200`);
    res.json({ observations: result.rows });
  } catch (err) { console.error("PRICE OBSERVATIONS ERROR:", err); res.status(500).json({ error: "Failed to load market price observations" }); }
});

router.post("/admin/observations", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensurePriceIntelligenceTables();
    const { product_id, location, market, price, unit, observed_on, source, source_type, verification_status, notes } = req.body;
    const parsedPrice = Number(price);
    if (!Number.isInteger(Number(product_id)) || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !String(unit || "").trim()) return res.status(400).json({ error: "Product, price and unit are required" });
    const product = await pool.query("SELECT id,name FROM products WHERE id=$1", [product_id]);
    if (!product.rows[0]) return res.status(404).json({ error: "Product not found" });
    const allowedSourceTypes = ["market_visit", "supplier_quote", "catalogue_snapshot", "official_feed", "admin_market_observation"];
    const allowedVerification = ["pending", "verified", "rejected"];
    const normalizedSourceType = allowedSourceTypes.includes(source_type) ? source_type : "admin_market_observation";
    const normalizedVerification = allowedVerification.includes(verification_status) ? verification_status : "pending";
    const result = await pool.query(`INSERT INTO market_price_observations (product_id, product_name, location, market, price, unit, observed_on, source, source_type, verification_status, verified_by, verified_at, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE),$8,$9,$10,$11,CASE WHEN $10='verified' THEN CURRENT_TIMESTAMP ELSE NULL END,$12,$11)
      ON CONFLICT (product_id, market, unit, observed_on) DO UPDATE SET location=EXCLUDED.location, price=EXCLUDED.price, source=EXCLUDED.source, source_type=EXCLUDED.source_type, verification_status=EXCLUDED.verification_status, verified_by=EXCLUDED.verified_by, verified_at=EXCLUDED.verified_at, notes=EXCLUDED.notes, created_by=EXCLUDED.created_by, created_at=CURRENT_TIMESTAMP
      RETURNING *`, [product.rows[0].id, product.rows[0].name, String(location || "Abuja").trim(), String(market || "Unspecified market").trim(), parsedPrice, String(unit).trim(), observed_on || null, String(source || "Admin market observation").trim(), normalizedSourceType, normalizedVerification, req.user.id, String(notes || "").trim()]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error("CREATE PRICE OBSERVATION ERROR:", err); res.status(500).json({ error: "Failed to save market price observation" }); }
});

router.get("/", async (req, res) => {
  try {
    await ensurePriceIntelligenceTables();
    await snapshotCataloguePrices();
    const [rows, catalog] = await Promise.all([
      pool.query(`SELECT * FROM market_price_observations WHERE verification_status='verified' AND observed_on >= CURRENT_DATE - INTERVAL '1 year' ORDER BY observed_on ASC,id ASC`),
      pool.query("SELECT id,name,price,COALESCE(cost_price,0) AS cost_price,COALESCE(stock_quantity,0)::int AS stock,COALESCE(NULLIF(weight,''),'unit') AS unit FROM products ORDER BY name"),
    ]);
    const grouped = rows.rows.reduce((all, row) => { const key = String(row.product_id); (all[key] ||= []).push(row); return all; }, {});
    const commodities = catalog.rows.map((product) => {
      const observations = grouped[String(product.id)] || [];
      const metrics = observations.length ? calculateMetrics(observations) : null;
      const movement = metrics?.change_30d ?? metrics?.change_7d ?? null;
      const trend = movement == null ? "Unknown" : movement > 0.5 ? "Rising" : movement < -0.5 ? "Falling" : "Stable";
      return {
        product_id: product.id, name: product.name, elohim_price: Number(product.price || 0), cost_price: Number(product.cost_price || 0), stock: product.stock, unit: metrics?.unit || product.unit,
        ...(metrics || { observation_count: 0, verified_observation_count: 0, verified_source_count: 0 }),
        trend,
        forecast: movement == null ? { available: false, direction: "Unknown", method: "Insufficient verified observation history" } : { available: true, direction: trend === "Rising" ? "Upward" : trend === "Falling" ? "Downward" : "Stable", method: "Trend continuation from verified historical observations; this is not a guarantee." },
        evidence: movement == null ? "The available verified observations do not establish a measured period change or a single cause." : `${Math.abs(movement)}% ${movement >= 0 ? "increase" : "decrease"} during the measured period. The available data does not establish a single cause.`,
      };
    });
    const rice = commodities.find((item) => String(item.name).toLowerCase().includes("rice"));
    const maize = commodities.find((item) => String(item.name).toLowerCase().includes("maize"));
    const dates = [...new Set(rows.rows.map((row) => row.observed_on))].sort();
    const priceOnDate = (commodity, date) => commodity ? [...(grouped[String(commodity.product_id)] || [])].filter((row) => row.observed_on <= date).pop()?.price ?? null : null;
    const combinedTrend = dates.map((date) => ({ month: date, rice: priceOnDate(rice, date), maize: priceOnDate(maize, date), predicted: false }));
    const recommendations = [rice, maize].filter(Boolean).map((item) => ({ commodity: item.name, current_price: item.current_price, next_month_price: null, action: item.change_7d == null ? "Collect more observations" : item.change_7d > 3 ? "Review current price" : "Monitor market", confidence: null, reason: item.change_7d == null ? "A 7-day comparison needs an observation at least seven days old." : `Based on recorded ${item.market} observations; 7-day change: ${item.change_7d}%.`, expected_change: item.change_7d }));

    const marketSignals = {
      exchange_rate_pressure: "Medium",
      fuel_cost_pressure: "High",
      harvest_supply: "Moderate",
      model_version: "Elohim observation model v1",
      data_note: "Prices and changes are calculated from recorded market observations. Catalogue snapshots are marked as an Elohim source; no projected prices are shown.",
    };

    res.json({
      updated_at: new Date().toISOString(),
      trends: combinedTrend,
      inflation: [],
      recommendations,
      products: commodities,
      market_signals: marketSignals,
    });
  } catch (err) {
    console.error("PRICE INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Failed to load price insights" });
  }
});

module.exports = router;
