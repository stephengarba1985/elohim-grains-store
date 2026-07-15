const express = require('express')
const router = express.Router()
const pool = require('../config/db')

/* =========================
   ADD TO CART (CLEAN + SAFE)
========================= */
router.post('/', async (req, res) => {
  try {
    const { product_id, quantity, user_id, variant_id } = req.body

    const productId = Number(product_id)
    const qty = Number(quantity)
    const userId = Number(user_id)
    const variantId = variant_id ? Number(variant_id) : null

    if (!productId || !userId || qty <= 0) {
      return res.status(400).json({ error: "Invalid cart payload" })
    }

    // 🔥 GET STOCK
    let stock = 0

    if (variantId) {
      const variantRes = await pool.query(
        'SELECT * FROM product_variants WHERE id = $1',
        [variantId]
      )

      if (variantRes.rows.length === 0) {
        return res.status(404).json({ error: "Variant not found" })
      }

      stock = Number(variantRes.rows[0].stock)

      if (Number(variantRes.rows[0].product_id) !== productId) {
        return res.status(400).json({ error: "Variant mismatch" })
      }

    } else {
      const productRes = await pool.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [productId]
      )

      if (productRes.rows.length === 0) {
        return res.status(404).json({ error: "Product not found" })
      }

      stock = Number(productRes.rows[0].stock_quantity)
    }

    // 🔥 CHECK EXISTING
    const existing = await pool.query(
      variantId
        ? 'SELECT * FROM cart WHERE product_id = $1 AND user_id = $2 AND variant_id = $3'
        : 'SELECT * FROM cart WHERE product_id = $1 AND user_id = $2',
      variantId
        ? [productId, userId, variantId]
        : [productId, userId]
    )

    if (existing.rows.length > 0) {
      const newQty = Number(existing.rows[0].quantity) + qty

      if (newQty > stock) {
        return res.status(400).json({ error: "Not enough stock" })
      }

      const updated = await pool.query(
        variantId
          ? 'UPDATE cart SET quantity = $1 WHERE product_id = $2 AND user_id = $3 AND variant_id = $4 RETURNING *'
          : 'UPDATE cart SET quantity = $1 WHERE product_id = $2 AND user_id = $3 RETURNING *',
        variantId
          ? [newQty, productId, userId, variantId]
          : [newQty, productId, userId]
      )

      return res.json(updated.rows[0])
    }

    if (qty > stock) {
      return res.status(400).json({ error: "Not enough stock" })
    }

    const result = await pool.query(
      variantId
        ? 'INSERT INTO cart (product_id, quantity, user_id, variant_id) VALUES ($1,$2,$3,$4) RETURNING *'
        : 'INSERT INTO cart (product_id, quantity, user_id) VALUES ($1,$2,$3) RETURNING *',
      variantId
        ? [productId, qty, userId, variantId]
        : [productId, qty, userId]
    )

    res.json(result.rows[0])

  } catch (err) {
    console.error("ADD CART ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   GET CART
========================= */
router.get('/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params

    const result = await pool.query(`
      SELECT 
        cart.*,
        products.name,
        products.image_url,
        COALESCE(product_variants.weight, products.weight) AS weight,
        COALESCE(product_variants.price, products.price) AS price
      FROM cart
      JOIN products ON cart.product_id = products.id
      LEFT JOIN product_variants ON cart.variant_id = product_variants.id
      WHERE cart.user_id = $1
      ORDER BY cart.created_at DESC
    `, [user_id])

    res.json(result.rows)

  } catch (err) {
    console.error("FETCH CART ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   CLEAR CART
========================= */
router.delete('/clear/:user_id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart WHERE user_id = $1',
      [req.params.user_id]
    )

    res.json({ message: "Cart cleared" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/* =========================
   REMOVE ITEM
========================= */
router.delete('/:id/:user_id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart WHERE id = $1 AND user_id = $2',
      [req.params.id, req.params.user_id]
    )

    res.json({ message: "Item removed" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router