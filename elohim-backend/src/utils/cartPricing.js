const DEFAULT_DELIVERY_FEE = 5000;

const calculateDeliveryFee = ({ isBulk = false, items = [] } = {}) => {
  const hasBulkQuantity = items.some((item) => Number(item.quantity || 0) >= 10);
  return isBulk || hasBulkQuantity ? 0 : DEFAULT_DELIVERY_FEE;
};

const calculateCartPricing = ({ items = [], isBulk = false } = {}) => {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price ?? item.variant_price ?? item.product_price ?? 0);
    return sum + price * quantity;
  }, 0);

  const deliveryFee = subtotal > 0 ? calculateDeliveryFee({ isBulk, items }) : 0;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    total,
  };
};

module.exports = {
  DEFAULT_DELIVERY_FEE,
  calculateDeliveryFee,
  calculateCartPricing,
};
