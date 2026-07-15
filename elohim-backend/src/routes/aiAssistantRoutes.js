const express = require("express");
const pool = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const { ensureWalletTables, getWalletBalance } = require("./walletRoutes");
const { ensureDeliveryTrackingTables } = require("./trackingRoutes");

const router = express.Router();

const formatMoney = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const detectIntent = (message) => {
  const text = normalizeText(message);

  if (/\b(track|delivery|deliver|dispatch|rider|eta|order)\b/.test(text)) {
    return "delivery";
  }

  if (/\b(save|savings|plan|budget|wallet|afford|contribution|financial)\b/.test(text)) {
    return "savings";
  }

  if (/\b(predict|prediction|forecast|market|trend|rise|fall|buy now|wait)\b/.test(text)) {
    return "prediction";
  }

  if (/\b(price|cost|rate|how much|grain|rice|maize|beans|wheat|sorghum|millet|garri)\b/.test(text)) {
    return "price";
  }

  return "general";
};

const extractOrderId = (message) => {
  const match = String(message || "").match(/(?:order\s*#?|#)\s*(\d+)|\b(\d{2,})\b/i);
  return match ? Number(match[1] || match[2]) : null;
};

const getProducts = async () => {
  const result = await pool.query(`
    SELECT
      p.id,
      p.name,
      p.price,
      p.stock_quantity,
      p.weight,
      COALESCE(
        json_agg(
          json_build_object(
            'id', v.id,
            'weight', v.weight,
            'price', v.price,
            'stock', v.stock
          )
        ) FILTER (WHERE v.id IS NOT NULL),
        '[]'
      ) AS variants
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT 20
  `);

  return result.rows;
};

const findMentionedProducts = (message, products) => {
  const text = normalizeText(message);
  const matches = products.filter((product) => {
    const name = normalizeText(product.name);
    return name && (text.includes(name) || name.split(/\s+/).some((part) => part.length > 3 && text.includes(part)));
  });

  return matches.length > 0 ? matches : products.slice(0, 5);
};

const buildTrend = (basePrice, commodity, slope, volatility) => {
  const now = new Date();

  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    const wave = Math.sin((index + commodity.length) * 0.9) * volatility;
    const pressure = 1 + index * slope + wave;

    return {
      month: `${monthLabels[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
      price: Math.max(0, Math.round(Number(basePrice || 0) * pressure)),
    };
  });
};

const getMarketSummary = async () => {
  const products = await getProducts();
  const averagePrice =
    products.reduce((sum, product) => sum + Number(product.price || 0), 0) /
    Math.max(products.length, 1);
  const rice = products.find((product) => normalizeText(product.name).includes("rice"));
  const maize = products.find((product) => normalizeText(product.name).includes("maize"));
  const riceTrend = buildTrend(Number(rice?.price || averagePrice || 75000), "Rice", 0.011, 0.025);
  const maizeTrend = buildTrend(Number(maize?.price || averagePrice || 42000), "Maize", 0.007, 0.035);

  return { products, riceTrend, maizeTrend };
};

const answerPrice = async (message) => {
  const products = await getProducts();
  const selected = findMentionedProducts(message, products);
  const lines = selected.map((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variantText = variants
      .slice(0, 3)
      .map((variant) => `${variant.weight || "variant"} at ${formatMoney(variant.price)}`)
      .join(", ");

    return `${product.name}: ${formatMoney(product.price)}${product.weight ? ` per ${product.weight}` : ""}${
      variantText ? `. Options: ${variantText}` : ""
    }`;
  });

  return {
    intent: "price",
    answer: lines.length
      ? `Here are the current grain prices I found:\n\n${lines.join("\n")}`
      : "I could not find product prices yet. Add products and variants, then ask again.",
    suggestions: ["Should I buy rice now?", "Show maize price trend", "Help me plan savings"],
  };
};

const answerPrediction = async () => {
  const { riceTrend, maizeTrend } = await getMarketSummary();
  const summarize = (name, trend) => {
    const current = trend[0];
    const future = trend[3];
    const change = current.price ? ((future.price - current.price) / current.price) * 100 : 0;
    const advice = change >= 6 ? "buy earlier" : change <= -3 ? "wait a little" : "buy gradually";

    return `${name}: ${formatMoney(current.price)} now, projected around ${formatMoney(future.price)} by ${
      future.month
    }. That suggests you should ${advice}.`;
  };

  return {
    intent: "prediction",
    answer: `Based on current catalog prices and the local market model:\n\n${summarize("Rice", riceTrend)}\n${summarize(
      "Maize",
      maizeTrend
    )}\n\nThis is a planning estimate, not a guaranteed market quote.`,
    suggestions: ["What are today's grain prices?", "Help me save for rice", "Track order #"],
  };
};

const answerSavings = async (userId) => {
  await ensureWalletTables();

  const balance = await getWalletBalance(userId);
  const planRes = await pool.query(
    `SELECT gp.*, p.name AS product_name
     FROM grain_plans gp
     LEFT JOIN products p ON p.id = gp.product_id
     WHERE gp.user_id = $1
     ORDER BY gp.id DESC
     LIMIT 5`,
    [userId]
  );
  const plans = planRes.rows;
  const activePlans = plans.filter((plan) => normalizeText(plan.status || "active") !== "completed");
  const totalBalance = activePlans.reduce(
    (sum, plan) => sum + Math.max(Number(plan.total_amount || 0) - Number(plan.amount_paid || 0), 0),
    0
  );
  const monthlyTarget = activePlans.reduce((sum, plan) => {
    const remaining = Math.max(Number(plan.total_amount || 0) - Number(plan.amount_paid || 0), 0);
    const months = Math.max(Number(plan.duration || 1), 1);
    return sum + Math.ceil(remaining / months);
  }, 0);
  const planLines = activePlans
    .map((plan) => {
      const remaining = Math.max(Number(plan.total_amount || 0) - Number(plan.amount_paid || 0), 0);
      return `${plan.product_name || "Grain plan"}: ${formatMoney(remaining)} remaining`;
    })
    .join("\n");

  return {
    intent: "savings",
    answer: `Your wallet balance is ${formatMoney(balance)}. ${
      activePlans.length
        ? `You have ${activePlans.length} active grain plan(s) with ${formatMoney(totalBalance)} remaining.\n\n${planLines}\n\nA practical monthly target is about ${formatMoney(monthlyTarget)}.`
        : "You do not have an active grain savings plan yet. Start with one grain, one target quantity, and a small weekly or monthly contribution."
    }`,
    suggestions: ["Show grain prices", "Predict rice market", "Track my delivery"],
  };
};

const answerDelivery = async (message, user) => {
  await ensureDeliveryTrackingTables();

  const orderId = extractOrderId(message);
  const params = [];
  let where = "";

  if (orderId) {
    params.push(orderId);
    where = "WHERE o.id = $1";
  } else if (!user.is_admin) {
    params.push(user.id);
    where = "WHERE o.user_id = $1";
  }

  const orderRes = await pool.query(
    `SELECT
       o.id,
       o.user_id,
       o.status,
       o.total_amount,
       o.created_at,
       d.status AS delivery_status,
       d.eta_minutes,
       r.name AS rider_name,
       r.phone AS rider_phone
     FROM orders o
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN riders r ON r.id = COALESCE(d.rider_id, o.rider_id)
     ${where}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT 1`,
    params
  );

  const order = orderRes.rows[0];

  if (!order || (!user.is_admin && Number(order.user_id) !== Number(user.id))) {
    return {
      intent: "delivery",
      answer: orderId
        ? `I could not find order #${orderId} for your account.`
        : "I could not find an active delivery for your account yet.",
      suggestions: ["Track order #", "Show grain prices", "Help me save"],
    };
  }

  return {
    intent: "delivery",
    answer: `Order #${order.id} is currently ${order.delivery_status || order.status || "pending"}. ${
      order.eta_minutes ? `Estimated arrival is ${order.eta_minutes} minutes.` : "ETA is not set yet."
    } ${order.rider_name ? `Rider: ${order.rider_name}${order.rider_phone ? ` (${order.rider_phone})` : ""}.` : "A rider has not been assigned yet."}`,
    suggestions: ["What are today's grain prices?", "Should I buy now?", "Savings advice"],
  };
};

router.post("/chat", verifyToken, async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const intent = detectIntent(message);
    let response;

    if (intent === "price") response = await answerPrice(message);
    if (intent === "prediction") response = await answerPrediction(message);
    if (intent === "savings") response = await answerSavings(req.user.id);
    if (intent === "delivery") response = await answerDelivery(message, req.user);

    if (!response) {
      response = {
        intent: "general",
        answer:
          "I can help with grain prices, savings advice, market predictions, and delivery updates. Ask me something like: What is the rice price today?",
        suggestions: ["Show rice prices", "Savings advice", "Track order #"],
      };
    }

    res.json({
      ...response,
      created_at: new Date().toISOString(),
      source: "Elohim local assistant",
    });
  } catch (err) {
    console.error("AI ASSISTANT ERROR:", err);
    res.status(500).json({ error: "AI assistant failed to respond" });
  }
});

module.exports = router;
