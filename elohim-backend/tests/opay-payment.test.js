const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function loadGateway({ duplicate = false, orderStatus = "pending" } = {}) {
  const routes = new Map();
  const calls = [];
  const auth = () => {};
  const router = {};
  for (const method of ["get", "post"]) router[method] = (url, ...handlers) => routes.set(`${method} ${url}`, handlers);
  const query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("INSERT INTO payment_transactions")) return { rows: [{ id: 1, reference: values[3], amount: values[4], status: "pending" }] };
    if (sql.startsWith("SELECT * FROM payment_transactions")) return { rows: [{ id: 1, order_id: 2, provider: "opay", status: "pending", amount: 15000 }] };
    if (sql.startsWith("SELECT id FROM payment_transactions")) return { rows: duplicate ? [{ id: 99 }] : [] };
    if (sql.startsWith("SELECT * FROM orders")) return { rows: [{ id: 2, status: orderStatus, total_amount: 15000 }] };
    return { rows: [] };
  };
  const client = { query, release() {} };
  const pool = { query, connect: async () => client };
  const mocks = {
    express: { Router: () => router },
    "../config/db": pool,
    "./mobileRoutes": { createPaymentReminder: async () => {} },
    "../middleware/auth": { verifyToken: auth, isAdmin: auth, requirePermission: permission => { assert.equal(permission, "payments"); return auth; } },
    "../utils/cartPricing": { getAuthoritativeCartPricing: async () => ({ total: 15000 }) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/routes/paymentGatewayRoutes.js"), "utf8"), { require: (name) => { assert.ok(mocks[name], name); return mocks[name]; }, module: { exports: {} }, console });
  async function request(route, body = {}) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await routes.get(route).at(-1)({ user: { id: 7 }, body }, res);
    return res;
  }
  return { routes, auth, calls, request };
}

test("OPay is the only option and uses the supplied account", async () => {
  const app = loadGateway();
  const res = await app.request("get /options");
  assert.deepEqual(Array.from(res.data.providers, p => p.value), ["opay"]);
  assert.equal(res.data.account.account_number, "8148993001");
  assert.equal(res.data.account.account_name, "Elohim Grains Store");
});

test("rejects old gateways and card channels", async () => {
  const app = loadGateway();
  assert.equal((await app.request("post /initialize", { provider: "paystack", channel: "card" })).code, 400);
  assert.equal((await app.request("post /initialize", { provider: "opay", channel: "card" })).code, 400);
});

test("uses server pricing and leaves initialized transfer pending", async () => {
  const app = loadGateway();
  const res = await app.request("post /initialize", { provider: "opay", channel: "bank_transfer", amount: 1 });
  assert.equal(res.data.instructions.amount, 15000);
  assert.equal(res.data.instructions.account_number, "8148993001");
  assert.equal(res.data.transaction.status, "pending");
  assert.equal(res.data.authorization_url, null);
  assert.equal(app.calls.some(c => c.sql.includes("status='verified'")), false);
});

test("customer verification never marks transfers paid", async () => {
  const app = loadGateway();
  assert.equal((await app.request("post /verify", { reference: "OPAY-1" })).code, 409);
  assert.equal(app.calls.some(c => c.sql.startsWith("UPDATE")), false);
});

test("admin confirmation requires receipt and updates payment and order atomically", async () => {
  const app = loadGateway();
  assert.equal(app.routes.get("post /admin/confirm-transfer")[1], app.auth);
  assert.equal((await app.request("post /admin/confirm-transfer", { reference: "OPAY-1" })).code, 400);
  const res = await app.request("post /admin/confirm-transfer", { reference: "OPAY-1", receipt_reference: "BANK-1" });
  assert.equal(res.code, 200);
  assert.ok(app.calls.some(c => c.sql.includes("confirmed_by") || c.values?.some(v => typeof v === "string" && v.includes('"confirmed_by":7'))));
  assert.ok(app.calls.some(c => c.sql.includes("status='paid'")));
  assert.equal(app.calls.at(-1).sql, "COMMIT");
});

test("duplicate bank receipts and cancelled orders cannot be confirmed", async () => {
  for (const options of [{ duplicate: true }, { orderStatus: "cancelled" }]) {
    const app = loadGateway(options);
    assert.equal((await app.request("post /admin/confirm-transfer", { reference: "OPAY-1", receipt_reference: "BANK-1" })).code, 409);
    assert.equal(app.calls.some(c => c.sql.startsWith("UPDATE")), false);
    assert.equal(app.calls.at(-1).sql, "ROLLBACK");
  }
});

test("pending OPay transfer creates an unpaid order and links its payment", async () => {
  const routes = new Map();
  const calls = [];
  const router = {};
  for (const method of ["get", "post", "put", "delete", "patch"]) router[method] = (url, ...handlers) => routes.set(`${method} ${url}`, handlers);
  const query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("information_schema.columns")) return { rows: [{ column_name: "present" }] };
    if (sql.includes("SELECT role")) return { rows: [{ role: "retail" }] };
    if (sql.includes("FROM cart")) return { rows: [{ product_id: 1, quantity: 1, product_price: 10000, product_stock: 5 }] };
    if (sql.includes("FROM payment_transactions")) return { rows: [{ id: 5, provider: "opay", channel: "bank_transfer", status: "pending", amount: 15000 }] };
    if (sql.includes("INSERT INTO orders") || sql.includes("UPDATE products")) return { rows: [{ id: 2 }] };
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const mocks = {
    express: { Router: () => router }, "../config/db": pool,
    "../utils/mail": { sendOrderConfirmationEmail: async () => {} }, "../utils/sendWhatsApp": () => {},
    "./escrowRoutes": { ensureEscrowTables: async () => {} },
    "./paymentGatewayRoutes": { ensurePaymentGatewayTables: async () => {} },
    "./trackingRoutes": { ensureDeliveryForOrder: async () => {}, addDeliveryEvent: async () => {} },
    "../middleware/auth": { verifyToken: () => {}, isAdmin: () => {} },
    "../utils/cartPricing": require("../src/utils/cartPricing"),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/routes/orderRoutes.js"), "utf8"), { require: name => mocks[name], module: { exports: {} }, console: { log() {}, error() {} } });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await routes.get("post /create").at(-1)({ user: { id: 7 }, body: { reference: "OPAY-1", delivery_address: "Abuja" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.data.orderId, 2);
  assert.equal(calls.find(c => c.sql.includes("INSERT INTO orders")).values[2], "pending");
  const paymentUpdate = calls.find(c => c.sql.includes("SET payment_gateway"));
  assert.equal(paymentUpdate.values[2], "pending");
  assert.ok(calls.some(c => c.sql.includes("UPDATE payment_transactions SET order_id")));
  assert.equal(calls.some(c => c.sql.includes("payment_status='verified'")), false);
});
