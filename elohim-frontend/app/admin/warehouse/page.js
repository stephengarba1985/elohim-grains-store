"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const statusClass = (status) => {
  if (["stored", "sold", "released"].includes(status)) return "bg-green-100 text-green-700";
  if (status === "sale_requested") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

export default function AdminWarehousePage() {
  const [totals, setTotals] = useState({});
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState({});

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/warehouse/admin/overview/all");
      setTotals(res.data?.totals || {});
      setHoldings(Array.isArray(res.data?.holdings) ? res.data.holdings : []);
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load warehouse overview");
    } finally {
      setLoading(false);
    }
  };

  const updateHolding = async (holding, payload) => {
    try {
      await API.patch(`/warehouse/admin/${holding.id}`, payload);
      toast.success("Warehouse holding updated");
      setPriceUpdates({ ...priceUpdates, [holding.id]: "" });
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Smart Warehouse</h1>
          <p className="mt-1 text-slate-500">
            Manage stored grain holdings, price updates, sale requests, and commodity inventory value.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:bg-green-300"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Holdings</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.holdings || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Stored Bags</p>
          <h2 className="text-xl font-bold text-slate-950">{Number(totals.total_bags || 0)}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Sale Requests</p>
          <h2 className="text-xl font-bold text-amber-600">{totals.sale_requests || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Purchase Value</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.purchase_value)}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Market Value</p>
          <h2 className="text-xl font-bold text-green-700">
            {formatPrice(totals.market_value)}
          </h2>
        </div>
      </div>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Warehouse holdings</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Grain</th>
                <th className="p-3">Purchase</th>
                <th className="p-3">Market</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.id} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-semibold">{holding.user_name || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{holding.user_email}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{holding.grain_name}</p>
                    <p className="text-xs text-slate-500">
                      {holding.quantity_bags} bags • {holding.bag_weight}
                    </p>
                    <p className="text-xs text-slate-500">{holding.warehouse_location}</p>
                  </td>
                  <td className="p-3">{formatPrice(holding.purchase_value)}</td>
                  <td className="p-3">{formatPrice(holding.market_value)}</td>
                  <td className="p-3 font-semibold text-green-700">
                    {formatPrice(holding.unrealized_profit)}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(holding.status)}`}>
                      {String(holding.status).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="grid min-w-[220px] gap-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={priceUpdates[holding.id] || ""}
                          onChange={(event) =>
                            setPriceUpdates({
                              ...priceUpdates,
                              [holding.id]: event.target.value,
                            })
                          }
                          className="w-full rounded border border-slate-300 p-2"
                          placeholder="Market price"
                        />
                        <button
                          onClick={() =>
                            updateHolding(holding, {
                              current_market_price: priceUpdates[holding.id],
                            })
                          }
                          className="rounded bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                        >
                          Update
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateHolding(holding, { status: "sold" })}
                          className="rounded bg-green-700 px-3 py-2 text-xs font-bold text-white"
                        >
                          Mark Sold
                        </button>
                        <button
                          onClick={() => updateHolding(holding, { status: "released" })}
                          className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Release
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {holdings.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-500">
                    No warehouse holdings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Warehouse transactions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {transactions.slice(0, 12).map((transaction) => (
            <div key={transaction.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{transaction.user_name || "Customer"}</p>
                  <p className="text-sm text-slate-500">
                    {transaction.grain_name} • {String(transaction.type).replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-slate-500">{transaction.quantity_bags} bags</p>
                </div>
                <p className="font-bold text-green-700">{formatPrice(transaction.amount)}</p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-sm text-slate-500">No warehouse transactions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
