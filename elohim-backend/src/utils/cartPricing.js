const DEFAULT_DELIVERY_FEE = 5000;

const calculateDeliveryFee = ({ isBulk = false, items = [] } = {}) => {
  const hasBulkQuantity = items.some((item) => Number(item.quantity || 0) >= 10);
  return isBulk || hasBulkQuantity ? 0 : DEFAULT_DELIVERY_FEE;
};

const getItemUnitPrice = (item, isBulk = false) => {
  const variantPrice = item.variant_price != null ? Number(item.variant_price) : null;
  if (variantPrice !== null) return variantPrice;

  const productPrice = Number(item.product_price ?? item.price ?? 0);
  const bulkPrice = Number(item.product_bulk_price ?? item.bulk_price ?? 0);
  return isBulk && bulkPrice > 0 ? bulkPrice : productPrice;
};

const calculateCartPricing = ({ items = [], isBulk = false } = {}) => {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    return sum + getItemUnitPrice(item, isBulk) * quantity;
  }, 0);

  const deliveryFee = subtotal > 0 ? calculateDeliveryFee({ isBulk, items }) : 0;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    total,
  };
};

const getAuthoritativeCartPricing = async (client, userId) => {
  const roleColumn = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='role'
  `);
  const bulkPriceColumn = await client.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name='products' AND column_name='bulk_price'
  `);
  const hasRole = roleColumn.rows.length > 0;
  const hasBulkPrice = bulkPriceColumn.rows.length > 0;
  const roleResult = hasRole
    ? await client.query("SELECT role FROM users WHERE id=$1", [userId])
    : { rows: [] };
  const isBulk = String(roleResult.rows[0]?.role || "").toLowerCase() === "bulk";

  const items = await client.query(
    `SELECT c.product_id, c.variant_id, c.quantity,
            p.price AS product_price,
            ${hasBulkPrice ? "p.bulk_price AS product_bulk_price," : "NULL::numeric AS product_bulk_price,"}
            pv.price AS variant_price
     FROM cart c
     JOIN products p ON p.id=c.product_id
     LEFT JOIN product_variants pv ON pv.id=c.variant_id
     WHERE c.user_id=$1`,
    [userId]
  );

  return {
    items: items.rows,
    isBulk,
    ...calculateCartPricing({ items: items.rows, isBulk }),
  };
};

module.exports = {
  DEFAULT_DELIVERY_FEE,
  calculateDeliveryFee,
  getItemUnitPrice,
  calculateCartPricing,
  getAuthoritativeCartPricing,
};
