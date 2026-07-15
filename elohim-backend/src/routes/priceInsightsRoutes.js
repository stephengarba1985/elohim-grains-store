const express = require("express");
const pool = require("../config/db");

const router = express.Router();

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

router.get("/", async (req, res) => {
  try {
    const productRes = await pool.query(`
      SELECT
        p.id,
        p.name,
        COALESCE(AVG(NULLIF(v.price, 0)), NULLIF(p.price, 0), 0) AS market_price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id, p.name, p.price
    `);

    const products = productRes.rows;
    const fallbackPrice =
      products.reduce((sum, item) => sum + Number(item.market_price || 0), 0) /
      Math.max(products.length, 1);
    const ricePrice = getBasePrice(products, "rice", fallbackPrice || 75000);
    const maizePrice = getBasePrice(products, "maize", fallbackPrice || 42000);
    const riceTrend = generateTrend(ricePrice, "Rice", 0.011, 0.025);
    const maizeTrend = generateTrend(maizePrice, "Maize", 0.007, 0.035);
    const inflation = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(new Date().getFullYear(), new Date().getMonth() + index - 8, 1);
      const food = 29 + Math.sin(index * 0.8) * 2.2 + index * 0.18;
      const headline = 24 + Math.cos(index * 0.65) * 1.6 + index * 0.12;

      return {
        month: `${monthLabels[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
        food: Number(food.toFixed(1)),
        headline: Number(headline.toFixed(1)),
        predicted: index >= 9,
      };
    });

    const recommendations = [
      {
        commodity: "Rice",
        current_price: riceTrend[8].price,
        next_month_price: riceTrend[9].price,
        ...getRecommendation(riceTrend),
      },
      {
        commodity: "Maize",
        current_price: maizeTrend[8].price,
        next_month_price: maizeTrend[9].price,
        ...getRecommendation(maizeTrend),
      },
    ];

    const combinedTrend = riceTrend.map((point, index) => ({
      month: point.month,
      rice: point.price,
      maize: maizeTrend[index].price,
      predicted: point.predicted,
    }));

    const marketSignals = {
      exchange_rate_pressure: "Medium",
      fuel_cost_pressure: "High",
      harvest_supply: "Moderate",
      model_version: "Elohim local market model v1",
      data_note:
        "Uses current product prices and modeled market pressure. Ready for live market, exchange rate, and commodity feeds.",
    };

    res.json({
      updated_at: new Date().toISOString(),
      trends: combinedTrend,
      inflation,
      recommendations,
      market_signals: marketSignals,
    });
  } catch (err) {
    console.error("PRICE INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Failed to load price insights" });
  }
});

module.exports = router;
