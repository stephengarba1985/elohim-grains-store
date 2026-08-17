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
        `
        SELECT
          pv.id,
          pv.product_id,
          pv.product_type_id,
          pv.stock,
          pt.product_id AS type_product_id
        FROM product_variants pv
        LEFT JOIN product_types pt
          ON pv.product_type_id = pt.id
        WHERE pv.id = $1
        `,
        [variantId]
      )

      if (variantRes.rows.length === 0) {
        return res.status(404).json({ error: "Variant not found" })
      }

      const variant = variantRes.rows[0]
      stock = Number(variant.stock || 0)

      if (Number(variant.product_id) !== productId) {
        return res.status(400).json({ error: "Variant mismatch" })
      }

      if (
        variant.type_product_id !== null &&
        Number(variant.type_product_id) !== productId
      ) {
        return res.status(400).json({
          error: "Product type does not belong to product",
        })
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
        cart.id,
        cart.product_id,
        cart.user_id,
        cart.variant_id,
        cart.quantity,
        cart.created_at,
        products.name AS product_name,
        products.image_url AS product_image,
        products.category_id,
        categories.name AS category_name,
        product_types.id AS product_type_id,
        product_types.name AS product_type_name,
        product_types.origin AS product_type_origin,
        product_types.brand AS product_type_brand,
        product_types.image AS product_type_image,
        product_variants.weight AS variant_weight,
        product_variants.price AS variant_price,
        product_variants.stock AS variant_stock,
        product_variants.image_url AS variant_image
      FROM cart
      JOIN products ON cart.product_id = products.id
      LEFT JOIN categories ON products.category_id = categories.id
      LEFT JOIN product_types ON product_types.id = (
        SELECT pt.id
        FROM product_types pt
        WHERE pt.product_id = products.id
        ORDER BY pt.id ASC
        LIMIT 1
      )
      LEFT JOIN product_variants ON cart.variant_id = product_variants.id
      WHERE cart.user_id = $1
      ORDER BY cart.created_at DESC
    `, [user_id])

    const cart = result.rows.map((item) => ({
      id: item.id,
      user_id: Number(item.user_id),
      product_id: Number(item.product_id),
      variant_id: item.variant_id ? Number(item.variant_id) : null,
      quantity: Number(item.quantity),
      product: {
        id: item.product_id,
        name: item.product_name,
        image: item.product_image || "",
      },
      category: {
        id: item.category_id,
        name: item.category_name || "",
      },
      product_type: item.product_type_id
        ? {
            id: item.product_type_id,
            name: item.product_type_name,
            origin: item.product_type_origin || "",
            brand: item.product_type_brand || "",
            image: item.product_type_image || "",
          }
        : null,
      variant: item.variant_id
        ? {
            id: item.variant_id,
            weight: item.variant_weight || "",
            price: Number(item.variant_price || 0),
            stock: Number(item.variant_stock || 0),
            image: item.variant_image || "",
          }
        : null,
      price: Number(item.variant_price || 0),
      weight: item.variant_weight || "",
      stock: Number(item.variant_stock || 0),
    }))

    res.json(cart)
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