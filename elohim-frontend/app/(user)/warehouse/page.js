"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not available";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const statusClass = (status) => {
  if (["stored", "sold", "released"].includes(status)) return "bg-green-100 text-green-700";
  if (status === "sale_requested") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

export default function WarehousePage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    quantity_bags: 1,
    warehouse_location: "Elohim Central Warehouse",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login to use smart warehouse");
      fetchProducts();
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchWarehouse(parsedUser.id);
      fetchWallet(parsedUser.id);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const totals = useMemo(
    () => ({
      bags: holdings.reduce((sum, item) => sum + Number(item.quantity_bags || 0), 0),
      purchaseValue: holdings.reduce((sum, item) => sum + Number(item.purchase_value || 0), 0),
      marketValue: holdings.reduce((sum, item) => sum + Number(item.market_value || 0), 0),
      profit: holdings.reduce((sum, item) => sum + Number(item.unrealized_profit || 0), 0),
    }),
    [holdings]
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => String(product.id) === String(form.product_id)
      ),
    [form.product_id, products]
  );

  const selectedPrice = Number(
    selectedProduct?.price || selectedProduct?.variants?.[0]?.price || 0
  );
  const estimatedCost = selectedPrice * Number(form.quantity_bags || 0);
  const hasInsufficientBalance =
    walletBalance !== null && estimatedCost > 0 && walletBalance < estimatedCost;

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWarehouse = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/warehouse/${userId}`);
      setHoldings(Array.isArray(res.data?.holdings) ? res.data.holdings : []);
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load warehouse");
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async (userId = user?.id) => {
    if (!userId) return;

    try {
      const res = await API.get(`/wallet/${userId}`);
      setWalletBalance(Number(res.data?.balance || 0));
    } catch (err) {
      console.error(err);
      setWalletBalance(null);
    }
  };

  const buyAndStore = async (event) => {
    event.preventDefault();

    if (!user) return toast.error("Please login first");
    if (hasInsufficientBalance) {
      return toast.error("Insufficient wallet balance. Fund your wallet first.");
    }

    try {
      await API.post("/warehouse/buy-store", form);
      toast.success("Grains bought and stored in warehouse");
      setForm({
        product_id: "",
        quantity_bags: 1,
        warehouse_location: "Elohim Central Warehouse",
      });
      fetchWarehouse(user.id);
      fetchWallet(user.id);
      fetchProducts();
    } catch (err) {
      console.error(err);
      const apiError = err.response?.data;
      const required = apiError?.required;
      const balance = apiError?.balance;

      if (apiError?.code === "INSUFFICIENT_WALLET_BALANCE") {
        toast.error(
          `Insufficient wallet balance. Required ${formatPrice(required)}, available ${formatPrice(balance)}.`
        );
        setWalletBalance(Number(balance || 0));
        return;
      }

      toast.error(apiError?.error || "Warehouse purchase failed");
    }
  };

  const requestSale = async (holdingId) => {
    try {
      await API.post(`/warehouse/${holdingId}/sell`, {
        note: "User requested sale after market movement",
      });
      toast.success("Sale request submitted");
      fetchWarehouse(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Sale request failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-green-200">
            Smart Warehouse
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Buy grains, store them, and sell when prices rise.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Hold grains in Elohim warehouse storage like a commodity investment
            position, track market value, and request sale later.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Stored Bags</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{totals.bags}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Purchase Value</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatPrice(totals.purchaseValue)}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Market Value</p>
            <p className="mt-1 text-2xl font-black text-green-700">
              {formatPrice(totals.marketValue)}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Unrealized Profit</p>
            <p className={`mt-1 text-2xl font-black ${totals.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
              {formatPrice(totals.profit)}
            </p>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={buyAndStore}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-black text-slate-950">Buy and store</h2>
            <p className="mt-1 text-sm text-slate-500">
              Purchase grains from your wallet without immediate delivery.
            </p>
            <div className="mt-5 space-y-3">
              <select
                value={form.product_id}
                onChange={(event) => setForm({ ...form, product_id: event.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3"
                required
              >
                <option value="">Select grain product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {formatPrice(product.price || product?.variants?.[0]?.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={form.quantity_bags}
                onChange={(event) => setForm({ ...form, quantity_bags: event.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3"
                placeholder="Quantity in bags"
                required
              />
              <input
                value={form.warehouse_location}
                onChange={(event) => setForm({ ...form, warehouse_location: event.target.value })}
                className="w-full rounded-lg border border-slate-300 p-3"
                placeholder="Warehouse location"
              />
              <div className="rounded-lg bg-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-600">
                    Estimated wallet debit
                  </p>
                  <p className="text-lg font-black text-slate-950">
                    {formatPrice(estimatedCost)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-600">
                    Wallet balance
                  </p>
                  <p
                    className={`text-sm font-black ${
                      hasInsufficientBalance ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {walletBalance === null ? "Login required" : formatPrice(walletBalance)}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  The grain stays in warehouse storage after purchase. Admin can
                  update market price, and sale proceeds are credited back to
                  your wallet when sold.
                </p>
                {hasInsufficientBalance && (
                  <Link
                    href="/wallet"
                    className="mt-3 block rounded-lg bg-slate-950 px-4 py-2 text-center text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Fund Wallet
                  </Link>
                )}
              </div>
              <button
                disabled={hasInsufficientBalance}
                className="w-full rounded-lg bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800 disabled:bg-slate-300"
              >
                Buy and Store from Wallet
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">My warehouse holdings</h2>
                <p className="text-sm text-slate-500">
                  Track stored grain positions and sell later.
                </p>
              </div>
              <button
                onClick={() => fetchWarehouse(user?.id)}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:text-slate-400"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {holdings.map((holding) => (
                <div key={holding.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-950">{holding.grain_name}</p>
                      <p className="text-sm text-slate-500">
                        {holding.quantity_bags} bags / {holding.bag_weight} / {holding.warehouse_location}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Stored {formatDate(holding.created_at)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(holding.status)}`}>
                      {String(holding.status).replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-100 p-3">
                      <p className="text-xs text-slate-500">Purchase</p>
                      <p className="font-bold text-slate-950">{formatPrice(holding.purchase_value)}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-xs text-green-700">Market</p>
                      <p className="font-bold text-slate-950">{formatPrice(holding.market_value)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-xs text-amber-700">Profit</p>
                      <p className="font-bold text-slate-950">{formatPrice(holding.unrealized_profit)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => requestSale(holding.id)}
                    disabled={holding.status !== "stored"}
                    className="mt-4 rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    Request Sale
                  </button>
                </div>
              ))}
              {holdings.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                  <p className="font-bold text-slate-950">No stored grains yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Buy grains into warehouse storage to start tracking value.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Warehouse activity</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {transactions.slice(0, 8).map((transaction) => (
              <div key={transaction.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{transaction.grain_name}</p>
                    <p className="text-sm text-slate-500">
                      {String(transaction.type).replace(/_/g, " ")} / {transaction.quantity_bags} bags
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(transaction.created_at)}</p>
                  </div>
                  <p className="font-bold text-green-700">{formatPrice(transaction.amount)}</p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-sm text-slate-500">No warehouse activity yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
