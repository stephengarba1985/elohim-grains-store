const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCartPricing, getItemUnitPrice } = require("../src/utils/cartPricing");

test("retail cart uses retail price and delivery fee", () => {
  const items = [{ quantity: 2, product_price: 3000, product_bulk_price: 2500 }];
  assert.deepEqual(calculateCartPricing({ items, isBulk: false }), {
    subtotal: 6000,
    deliveryFee: 5000,
    total: 11000,
  });
});

test("bulk role uses bulk product price and free delivery", () => {
  const items = [{ quantity: 2, product_price: 3000, product_bulk_price: 2500 }];
  assert.deepEqual(calculateCartPricing({ items, isBulk: true }), {
    subtotal: 5000,
    deliveryFee: 0,
    total: 5000,
  });
});

test("quantity threshold receives free delivery", () => {
  const items = [{ quantity: 10, product_price: 1000 }];
  assert.equal(calculateCartPricing({ items, isBulk: false }).total, 10000);
});

test("variant price takes precedence for retail and bulk users", () => {
  const item = { quantity: 2, product_price: 3000, product_bulk_price: 2500, variant_price: 4200 };
  assert.equal(getItemUnitPrice(item, false), 4200);
  assert.equal(getItemUnitPrice(item, true), 4200);
  assert.equal(calculateCartPricing({ items: [item], isBulk: true }).total, 8400);
});
