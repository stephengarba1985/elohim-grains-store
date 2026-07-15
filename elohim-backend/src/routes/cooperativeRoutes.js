const express = require("express");
const pool = require("../config/db");

const router = express.Router();

const GROUP_TYPES = ["church", "women_group", "farmers_association", "student_group", "market_group", "other"];
let cooperativeSetupPromise = null;

const ensureCooperativeTables = async () => {
  if (cooperativeSetupPromise) {
    return cooperativeSetupPromise;
  }

  cooperativeSetupPromise = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cooperative_groups (
      id SERIAL PRIMARY KEY,
      creator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      group_type VARCHAR(50) DEFAULT 'other',
      target_amount DECIMAL(10,2) DEFAULT 0,
      delivery_address TEXT,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cooperative_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cooperative_contributions (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
      member_id INTEGER REFERENCES cooperative_members(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      amount DECIMAL(10,2) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cooperative_bulk_requests (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      requested_price DECIMAL(10,2),
      delivery_note TEXT,
      status VARCHAR(30) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  })();

  try {
    await cooperativeSetupPromise;
  } catch (err) {
    cooperativeSetupPromise = null;
    throw err;
  }
};

const parsePositiveNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return null;

  return number;
};

const cooperativeSelect = `
  SELECT
    g.*,
    u.name AS creator_name,
    u.email AS creator_email,
    COALESCE(SUM(c.amount), 0) AS total_contributed,
    COUNT(DISTINCT m.id)::int AS member_count,
    COUNT(DISTINCT br.id)::int AS bulk_request_count
  FROM cooperative_groups g
  LEFT JOIN users u ON g.creator_user_id = u.id
  LEFT JOIN cooperative_members m ON m.group_id = g.id
  LEFT JOIN cooperative_contributions c ON c.group_id = g.id
  LEFT JOIN cooperative_bulk_requests br ON br.group_id = g.id
`;

router.get("/user/:userId", async (req, res) => {
  try {
    await ensureCooperativeTables();

    const groups = await pool.query(
      `${cooperativeSelect}
       WHERE g.creator_user_id=$1 OR m.user_id=$1
       GROUP BY g.id, u.name, u.email
       ORDER BY g.id DESC`,
      [req.params.userId]
    );

    res.json(groups.rows);
  } catch (err) {
    console.error("COOPERATIVE USER FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to load cooperatives" });
  }
});

router.get("/admin/overview", async (req, res) => {
  try {
    await ensureCooperativeTables();

    const groups = await pool.query(
      `${cooperativeSelect}
       GROUP BY g.id, u.name, u.email
       ORDER BY g.id DESC`
    );

    const bulkRequests = await pool.query(`
      SELECT
        br.*,
        g.name AS group_name,
        g.group_type,
        g.delivery_address,
        p.name AS product_name
      FROM cooperative_bulk_requests br
      JOIN cooperative_groups g ON br.group_id = g.id
      LEFT JOIN products p ON br.product_id = p.id
      ORDER BY br.id DESC
      LIMIT 80
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(DISTINCT g.id)::int AS groups,
        COUNT(DISTINCT m.id)::int AS members,
        COALESCE(SUM(c.amount), 0) AS contributions,
        COUNT(DISTINCT br.id)::int AS bulk_requests
      FROM cooperative_groups g
      LEFT JOIN cooperative_members m ON m.group_id = g.id
      LEFT JOIN cooperative_contributions c ON c.group_id = g.id
      LEFT JOIN cooperative_bulk_requests br ON br.group_id = g.id
    `);

    res.json({
      totals: totals.rows[0],
      groups: groups.rows,
      bulk_requests: bulkRequests.rows,
    });
  } catch (err) {
    console.error("COOPERATIVE ADMIN ERROR:", err);
    res.status(500).json({ error: "Failed to load cooperative overview" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    await ensureCooperativeTables();

    const group = await pool.query(
      `${cooperativeSelect}
       WHERE g.id=$1
       GROUP BY g.id, u.name, u.email`,
      [req.params.id]
    );

    if (group.rows.length === 0) {
      return res.status(404).json({ error: "Cooperative not found" });
    }

    const members = await pool.query(
      "SELECT * FROM cooperative_members WHERE group_id=$1 ORDER BY id ASC",
      [req.params.id]
    );
    const contributions = await pool.query(
      `SELECT c.*, m.name AS member_name
       FROM cooperative_contributions c
       LEFT JOIN cooperative_members m ON c.member_id = m.id
       WHERE c.group_id=$1
       ORDER BY c.id DESC
       LIMIT 50`,
      [req.params.id]
    );
    const bulkRequests = await pool.query(
      `SELECT br.*, p.name AS product_name
       FROM cooperative_bulk_requests br
       LEFT JOIN products p ON br.product_id = p.id
       WHERE br.group_id=$1
       ORDER BY br.id DESC`,
      [req.params.id]
    );

    res.json({
      group: group.rows[0],
      members: members.rows,
      contributions: contributions.rows,
      bulk_requests: bulkRequests.rows,
    });
  } catch (err) {
    console.error("COOPERATIVE DETAIL ERROR:", err);
    res.status(500).json({ error: "Failed to load cooperative" });
  }
});

router.post("/", async (req, res) => {
  const {
    creator_user_id,
    name,
    group_type = "other",
    target_amount = 0,
    delivery_address,
    leader_phone,
  } = req.body;
  const normalizedType = GROUP_TYPES.includes(group_type) ? group_type : "other";

  if (!creator_user_id || !name) {
    return res.status(400).json({ error: "Creator and group name are required" });
  }

  const client = await pool.connect();

  try {
    await ensureCooperativeTables();
    await client.query("BEGIN");

    const group = await client.query(
      `INSERT INTO cooperative_groups
        (creator_user_id, name, group_type, target_amount, delivery_address)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [creator_user_id, name, normalizedType, Number(target_amount || 0), delivery_address || null]
    );

    const creator = await client.query("SELECT name, phone FROM users WHERE id=$1", [
      creator_user_id,
    ]);

    await client.query(
      `INSERT INTO cooperative_members (group_id, user_id, name, phone, role)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        group.rows[0].id,
        creator_user_id,
        creator.rows[0]?.name || "Group Leader",
        leader_phone || creator.rows[0]?.phone || null,
        "leader",
      ]
    );

    await client.query("COMMIT");

    res.json(group.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("COOPERATIVE CREATE ERROR:", err);
    res.status(500).json({ error: "Failed to create cooperative" });
  } finally {
    client.release();
  }
});

router.post("/:id/members", async (req, res) => {
  const { name, phone, user_id = null, role = "member" } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Member name is required" });
  }

  try {
    await ensureCooperativeTables();

    const result = await pool.query(
      `INSERT INTO cooperative_members (group_id, user_id, name, phone, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.params.id, user_id, name, phone || null, role]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("COOPERATIVE MEMBER ERROR:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.post("/:id/contributions", async (req, res) => {
  const { amount, member_id = null, user_id = null, note = null } = req.body;
  const parsedAmount = parsePositiveNumber(amount);

  if (!parsedAmount) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    await ensureCooperativeTables();

    const result = await pool.query(
      `INSERT INTO cooperative_contributions (group_id, member_id, user_id, amount, note)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.params.id, member_id, user_id, parsedAmount, note]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("COOPERATIVE CONTRIBUTION ERROR:", err);
    res.status(500).json({ error: "Failed to add contribution" });
  }
});

router.post("/:id/bulk-requests", async (req, res) => {
  const { product_id, quantity, requested_price, delivery_note } = req.body;
  const parsedQuantity = parsePositiveNumber(quantity);

  if (!product_id || !parsedQuantity) {
    return res.status(400).json({ error: "Product and quantity are required" });
  }

  try {
    await ensureCooperativeTables();

    const result = await pool.query(
      `INSERT INTO cooperative_bulk_requests
        (group_id, product_id, quantity, requested_price, delivery_note)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        req.params.id,
        product_id,
        parsedQuantity,
        requested_price ? Number(requested_price) : null,
        delivery_note || null,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("COOPERATIVE BULK ERROR:", err);
    res.status(500).json({ error: "Failed to create cooperative bulk request" });
  }
});

router.put("/bulk-requests/:id", async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    await ensureCooperativeTables();

    const result = await pool.query(
      `UPDATE cooperative_bulk_requests
       SET status=$1
       WHERE id=$2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Bulk request not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("COOPERATIVE BULK UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to update cooperative bulk request" });
  }
});

module.exports = router;
