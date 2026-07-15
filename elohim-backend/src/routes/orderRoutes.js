const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { ensureEscrowTables } = require("./escrowRoutes");
const { ensurePaymentGatewayTables } = require("./paymentGatewayRoutes");
const {
  ensureDeliveryForOrder,
  addDeliveryEvent,
} = require("./trackingRoutes");

const { verifyToken, isAdmin } = require("../middleware/auth");

/* =========================
   CREATE ORDER (USER ONLY)
========================= */
router.post("/create", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { reference, user_id } = req.body;
    await ensurePaymentGatewayTables();

    console.log("ORDER BODY:", req.body);
    console.log("ORDER REQUEST:", { reference, user_id });

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const roleColumnRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'role'
    `);
    const hasRoleColumn = roleColumnRes.rows.length > 0;

    const bulkPriceColumnRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND column_name = 'bulk_price'
    `);
    const hasBulkPriceColumn = bulkPriceColumnRes.rows.length > 0;

    const isBulkColumnRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name = 'is_bulk'
    `);
    const hasIsBulkColumn = isBulkColumnRes.rows.length > 0;

    const userRoleRes = hasRoleColumn
      ? await client.query("SELECT role FROM users WHERE id = $1", [user_id])
      : { rows: [] };
    const isBulk = userRoleRes.rows[0]?.role === "bulk";

    if (reference) {
      const existingOrder = await client.query(
        `SELECT * FROM orders WHERE reference = $1`,
        [reference]
      );

      if (existingOrder.rows.length > 0) {
        return res.json({
          message: "Order already exists",
          orderId: existingOrder.rows[0].id,
          totalAmount: existingOrder.rows[0].total_amount,
        });
      }
    }

    const cartSelect = `
      SELECT
        cart.*,
        products.price AS product_price,
        ${hasBulkPriceColumn ? "products.bulk_price AS product_bulk_price," : ""}
        products.stock_quantity AS product_stock,
        product_variants.price AS variant_price,
        product_variants.stock AS variant_stock
      FROM cart
      JOIN products ON cart.product_id = products.id
      LEFT JOIN product_variants ON cart.variant_id = product_variants.id
      WHERE cart.user_id = $1
    `;

    const cartRes = await client.query(cartSelect, [user_id]);

    if (cartRes.rows.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const items = cartRes.rows;
    let totalAmount = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      const productPrice = Number(item.product_price || 0);
      const productBulkPrice = Number(item.product_bulk_price || 0);
      const variantPrice =
        item.variant_price != null ? Number(item.variant_price) : null;
      const baseProductPrice =
        isBulk && productBulkPrice > 0 ? productBulkPrice : productPrice;
      const price = variantPrice !== null ? variantPrice : baseProductPrice;

      if (!price || price <= 0) {
        throw new Error("Invalid product price for order item");
      }

      if (item.variant_id) {
        if (item.variant_stock === null) {
          throw new Error("Variant stock missing");
        }

        if (Number(item.variant_stock) < quantity) {
          throw new Error("Not enough stock available for variant");
        }
      } else {
        if (item.product_stock == null) {
          throw new Error("Product stock missing");
        }

        if (Number(item.product_stock) < quantity) {
          throw new Error("Not enough stock available");
        }
      }

      totalAmount += price * quantity;
    }

    const referenceColumnRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name = 'reference'
    `);
    const hasReferenceColumn = referenceColumnRes.rows.length > 0;
    const paymentTx = reference
      ? await client.query(
          "SELECT * FROM payment_transactions WHERE reference=$1 AND user_id=$2 AND status='verified'",
          [reference, user_id]
        )
      : { rows: [] };
    const verifiedPayment = paymentTx.rows[0];

    await client.query("BEGIN");

    const orderRes = hasReferenceColumn
      ? hasIsBulkColumn
        ? await client.query(
            `INSERT INTO orders (user_id, total_amount, status, reference, is_bulk)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [user_id, totalAmount, verifiedPayment ? "paid" : "pending", reference || null, isBulk]
          )
        : await client.query(
            `INSERT INTO orders (user_id, total_amount, status, reference)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [user_id, totalAmount, verifiedPayment ? "paid" : "pending", reference || null]
          )
      : hasIsBulkColumn
        ? await client.query(
            `INSERT INTO orders (user_id, total_amount, status, is_bulk)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [user_id, totalAmount, verifiedPayment ? "paid" : "pending", isBulk]
          )
        : await client.query(
            `INSERT INTO orders (user_id, total_amount, status)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [user_id, totalAmount, verifiedPayment ? "paid" : "pending"]
          );

    const orderId = orderRes.rows[0].id;

    console.log("ORDER CREATED:", orderId);

    for (const item of items) {
      const quantity = Number(item.quantity);
      const productPrice = Number(item.product_price || 0);
      const productBulkPrice = Number(item.product_bulk_price || 0);
      const variantPrice =
        item.variant_price != null ? Number(item.variant_price) : null;
      const baseProductPrice =
        isBulk && productBulkPrice > 0 ? productBulkPrice : productPrice;
      const price = variantPrice !== null ? variantPrice : baseProductPrice;

      if (item.variant_id) {
        await client.query(
          `UPDATE product_variants
           SET stock = stock - $1
           WHERE id = $2`,
          [quantity, item.variant_id]
        );
      } else {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $1
           WHERE id = $2`,
          [quantity, item.product_id]
        );
      }

      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, variant_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.variant_id || null, quantity, price]
      );
    }

    await client.query(`DELETE FROM cart WHERE user_id = $1`, [user_id]);

    if (verifiedPayment) {
      await client.query(
        `UPDATE orders
         SET payment_gateway=$1, payment_channel=$2, payment_status='verified'
         WHERE id=$3`,
        [verifiedPayment.provider, verifiedPayment.channel, orderId]
      );

      await client.query(
        "UPDATE payment_transactions SET order_id=$1 WHERE id=$2",
        [orderId, verifiedPayment.id]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "Order created successfully",
      orderId,
      totalAmount,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("ORDER ERROR:", err.message);

    res.status(500).json({
      error: err.message || "Order failed",
    });
  } finally {
    client.release();
  }
});

/* =========================
   GET ALL ORDERS (ADMIN ONLY)
========================= */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    await ensureEscrowTables();

    const userColumnsRes = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
    `);

    const userColumns = new Set(userColumnsRes.rows.map((row) => row.column_name));
    const nameSelect = userColumns.has("name") ? "u.name" : "NULL AS name";
    const emailSelect = userColumns.has("email") ? "u.email" : "NULL AS email";
    const phoneSelect = userColumns.has("phone") ? "u.phone" : "NULL AS phone";
    const addressSelect = userColumns.has("address")
      ? "u.address"
      : "NULL AS address";

    const result = await pool.query(`
      SELECT 
        o.*,
        ep.id AS escrow_payment_id,
        ep.amount AS escrow_amount,
        ep.status AS escrow_payment_status,
        ${nameSelect},
        ${emailSelect},
        ${phoneSelect},
        ${addressSelect}
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN escrow_payments ep ON ep.order_id = o.id AND ep.status = 'held'
      ORDER BY o.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =========================
   GET USER ORDERS
========================= */
router.get("/user/:user_id", verifyToken, async (req, res) => {
  try {
    await ensureEscrowTables();

    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH USER ORDERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE ORDER DETAILS
========================= */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    await ensureEscrowTables();

    const { id } = req.params;

    const orderRes = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const itemsRes = await pool.query(
      `SELECT
         order_items.*,
         products.name,
         COALESCE(product_variants.weight, products.weight) AS weight,
         COALESCE(product_variants.price, products.price) AS price
       FROM order_items
       JOIN products ON order_items.product_id = products.id
       LEFT JOIN product_variants
         ON order_items.variant_id = product_variants.id
       WHERE order_items.order_id = $1`,
      [id]
    );

    res.json({
      order: orderRes.rows[0],
      items: itemsRes.rows,
    });
  } catch (err) {
    console.error("FETCH ORDER DETAILS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/invoice", async (req, res) => {
  try {
    let PDFDocument;

    try {
      PDFDocument = require("pdfkit");
    } catch (err) {
      return res.status(500).json({
        error: "Install pdfkit: npm install pdfkit",
      });
    }

    const orderId = req.params.id;

    /* =========================
       GET ORDER
    ========================= */
    const orderRes = await pool.query(
      "SELECT * FROM orders WHERE id = $1",
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];

    /* =========================
       GET ITEMS (VERY IMPORTANT)
    ========================= */
    const itemsRes = await pool.query(
      `SELECT 
        oi.*,
        p.name,
        COALESCE(pv.weight, p.weight) AS weight
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    const items = itemsRes.rows;

    if (items.length === 0) {
      return res.status(400).send("No items found for this order");
    }

    /* =========================
       CREATE PDF
    ========================= */
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.id}.pdf`
    );

    doc.pipe(res);

    /* =========================
       HEADER
    ========================= */
    doc.fontSize(20).text("Elohim Grains Invoice", {
      align: "center",
    });

    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Order ID: ${order.id}`);
    doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Status: ${order.status}`);

    doc.moveDown();

    /* =========================
       ITEMS TABLE
    ========================= */
    doc.fontSize(14).text("Items:", { underline: true });
    doc.moveDown();

    let total = 0;

    items.forEach((item, index) => {
      const lineTotal = Number(item.price) * Number(item.quantity);
      total += lineTotal;

      doc.fontSize(12).text(
        `${index + 1}. ${item.name} (${item.weight || "N/A"})`
      );
      doc.text(
        `   ₦${Number(item.price).toLocaleString()} × ${item.quantity} = ₦${lineTotal.toLocaleString()}`
      );
      doc.moveDown(0.5);
    });

    doc.moveDown();

    /* =========================
       TOTAL
    ========================= */
    doc.fontSize(14).text(
      `Total: ₦${Number(order.total_amount || total).toLocaleString()}`,
      { align: "right" }
    );

    doc.moveDown();
    doc.fontSize(10).text("Thank you for your purchase!", {
      align: "center",
    });

    doc.end();

  } catch (err) {
    console.error("❌ INVOICE ERROR:", err);

    res.status(500).json({
      error: "Failed to generate invoice",
    });
  }
});
/* =========================
   UPDATE ORDER STATUS (ADMIN ONLY)
========================= */
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      "pending",
      "processing",
      "paid",
      "assigned",
      "in_transit",
      "delivered",
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const existingOrderRes = await pool.query(
      `SELECT rider_id FROM orders WHERE id = $1`,
      [id]
    );

    if (existingOrderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = existingOrderRes.rows[0];
    const delivery = await ensureDeliveryForOrder(id, order.rider_id, status);

    const result = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    await pool.query(
      `UPDATE deliveries
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2`,
      [status, id]
    );

    await addDeliveryEvent(id, delivery.id, status, `Order status updated to ${status}`);

    if (status === "delivered" && order.rider_id) {
      await pool.query(
        `UPDATE riders
         SET status = 'available',
             current_orders = GREATEST(COALESCE(current_orders, 0) - 1, 0)
         WHERE id = $1`,
        [order.rider_id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE ORDER STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   ASSIGN RIDER (ADMIN ONLY)
========================= */
router.put("/:id/assign-rider", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rider_id } = req.body;

    const result = await pool.query(
      `UPDATE orders
       SET rider_id = $1, status = 'assigned'
       WHERE id = $2
       RETURNING *`,
      [rider_id, id]
    );

    const delivery = await ensureDeliveryForOrder(id, rider_id, "assigned");

    await pool.query(
      `UPDATE riders
       SET status = 'busy',
           current_orders = COALESCE(current_orders, 0) + 1
       WHERE id = $1`,
      [rider_id]
    );

    await addDeliveryEvent(id, delivery.id, "assigned", `Rider assigned to order #${id}`);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("ASSIGN RIDER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
