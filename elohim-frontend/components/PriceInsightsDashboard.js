"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const tooltipFormatter = (value, name) => {
  if (name === "food" || name === "headline") {
    return [formatPercent(value), name === "food" ? "Food inflation" : "Headline inflation"];
  }

  return [formatPrice(value), name === "rice" ? "Rice" : "Maize"];
};

export default function PriceInsightsDashboard({ admin = false }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [inventorySignals, setInventorySignals] = useState([]);
  const [observation, setObservation] = useState({ product_id: "", location: "Abuja", market: "", price: "", unit: "", observed_on: new Date().toISOString().slice(0, 10), source: "Admin market observation", source_type: "market_visit", verification_status: "verified" });
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    setMounted(true);
    fetchInsights();
    if (admin) API.get("/price-insights/admin/inventory-signals").then((res) => setInventorySignals(res.data?.signals || [])).catch(() => {});
  }, []);

  const recommendations = insights?.recommendations || [];
  const trends = insights?.trends || [];
  const inflation = insights?.inflation || [];
  const signals = insights?.market_signals || {};
  const observedProducts = insights?.products || [];
  const selectedProduct = observedProducts.find((item) => String(item.product_id) === String(selectedProductId)) || observedProducts.find((item) => String(item.name || "").toLowerCase().includes("rice")) || observedProducts[0] || null;

  const summary = useMemo(() => {
    const riceMetric = observedProducts.find((item) => String(item.name || "").toLowerCase().includes("rice")) || {};
    const maizeMetric = observedProducts.find((item) => String(item.name || "").toLowerCase().includes("maize")) || {};
    const foodInflation = inflation[8]?.food || inflation[inflation.length - 1]?.food || 0;

    return {
      rice: riceMetric.current_price || 0,
      maize: maizeMetric.current_price || 0,
      foodInflation,
      riceChange: riceMetric.change_7d,
      maizeChange: maizeMetric.change_7d,
    };
  }, [observedProducts, inflation]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await API.get("/price-insights");
      setInsights(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load price insights");
    } finally {
      setLoading(false);
    }
  };

  const saveObservation = async (event) => {
    event.preventDefault();
    try {
      await API.post("/price-insights/admin/observations", observation);
      toast.success("Market observation saved");
      setObservation((current) => ({ ...current, price: "" }));
      fetchInsights();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not save market observation");
    }
  };

  const setPriceAlert = async () => {
    if (!selectedProduct?.product_id) return;
    try { await API.post("/price-insights/follow", { product_id: selectedProduct.product_id, threshold_percent: 3 }); toast.success("Price alert set at 3%"); }
    catch (error) { toast.error(error.response?.data?.error || "Please sign in to set a price alert"); }
  };

  const chartFallback = (
    <div className="h-full w-full rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-sm text-slate-500">
      Loading chart...
    </div>
  );

  return (
    <div className={admin ? "space-y-6" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      <div className={admin ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Price intelligence
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Recorded market intelligence
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Compare Elohim selling prices with verified market observations and clearly labelled trend estimates.
            </p>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh market data"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Rice Price</p>
            <p className="text-xl font-bold text-slate-950">{formatPrice(summary.rice)}</p>
            <p className={summary.riceChange >= 0 ? "text-xs text-green-700" : "text-xs text-red-600"}>
              {summary.riceChange >= 0 ? "+" : ""}
              {summary.riceChange == null ? "Need 7 days of observations" : `${summary.riceChange >= 0 ? "+" : ""}${formatPercent(summary.riceChange)} over 7 days`}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Market estimate · {observedProducts.find((item) => String(item.name || "").toLowerCase().includes("rice"))?.verified_observation_count || 0} verified observations</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Maize Price</p>
            <p className="text-xl font-bold text-slate-950">{formatPrice(summary.maize)}</p>
            <p className={summary.maizeChange >= 0 ? "text-xs text-green-700" : "text-xs text-red-600"}>
              {summary.maizeChange >= 0 ? "+" : ""}
              {summary.maizeChange == null ? "Need 7 days of observations" : `${summary.maizeChange >= 0 ? "+" : ""}${formatPercent(summary.maizeChange)} over 7 days`}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Market estimate · {observedProducts.find((item) => String(item.name || "").toLowerCase().includes("maize"))?.verified_observation_count || 0} verified observations</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Recorded products</p>
            <p className="text-xl font-bold text-orange-600">{observedProducts.length}</p>
            <p className="text-xs text-slate-500">with market observations</p>
          </div>
          <div className="bg-slate-950 text-white rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-300">Model</p>
            <p className="text-lg font-bold">{signals.model_version || "Observation model"}</p>
            <p className="text-xs text-slate-300">recorded-price calculations</p>
          </div>
        </div>

        {selectedProduct && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Market estimate</p><h2 className="mt-1 text-2xl font-black">{selectedProduct.name} — {selectedProduct.unit}</h2><p className="mt-1 text-sm text-slate-500">Updated: {selectedProduct.observed_on || "No verified observation yet"}</p></div><select value={selectedProduct.product_id} onChange={(event) => setSelectedProductId(event.target.value)} className="rounded-lg border p-3">{observedProducts.map((item) => <option key={item.product_id} value={item.product_id}>{item.name}</option>)}</select></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-lg bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">Elohim price</p><p className="mt-1 text-xl font-black">{formatPrice(selectedProduct.elohim_price)}</p><p className="text-xs text-emerald-700">Amount customer pays</p></div><div className="rounded-lg bg-sky-50 p-4"><p className="text-xs font-bold text-sky-800">Market range</p><p className="mt-1 text-xl font-black">{selectedProduct.market_range_low == null ? "Not enough verified data" : `${formatPrice(selectedProduct.market_range_low)}–${formatPrice(selectedProduct.market_range_high)}`}</p><p className="text-xs text-sky-700">{selectedProduct.verified_observation_count || 0} verified observations</p></div><div className="rounded-lg bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Forecast</p><p className="mt-1 text-xl font-black">{selectedProduct.forecast?.direction}</p><p className="text-xs text-amber-700">{selectedProduct.forecast?.method}</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1"><b>30-day movement:</b> {selectedProduct.change_30d == null ? "Not enough history" : `${selectedProduct.change_30d >= 0 ? "+" : ""}${formatPercent(selectedProduct.change_30d)}`}</span><span className="rounded-full bg-slate-100 px-3 py-1"><b>Trend:</b> {selectedProduct.trend}</span></div><div className="mt-4 rounded-lg border p-4"><h3 className="font-bold">Market insight</h3><p className="mt-1 text-sm text-slate-600">{selectedProduct.evidence}</p></div><div className="mt-4 flex flex-wrap gap-3"><Link href={`/products/${selectedProduct.product_id}`} className="rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white">BUY NOW</Link><Link href={`/plans?product_id=${selectedProduct.product_id}`} className="rounded-lg border border-emerald-700 px-4 py-3 font-bold text-emerald-800">SAVE FOR THIS PRODUCT</Link><button onClick={setPriceAlert} className="rounded-lg border px-4 py-3 font-bold">SET PRICE ALERT</button></div></section>}

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-950">Rice vs Maize Price Trend</h2>
              <span className="text-xs text-slate-500">recorded observations only</span>
            </div>
            <div className="h-80">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => Number(value / 1000).toFixed(0)} />
                    <Tooltip formatter={tooltipFormatter} />
                    <Area type="monotone" dataKey="rice" stroke="#15803d" fill="#bbf7d0" strokeWidth={3} />
                    <Area type="monotone" dataKey="maize" stroke="#ca8a04" fill="#fef3c7" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : chartFallback}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-950 mb-4">Best Time To Buy</h2>
            <div className="space-y-3">
              {recommendations.map((item) => (
                <div key={item.commodity} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase">
                        {item.commodity}
                      </p>
                      <h3 className="font-bold text-slate-950 mt-1">{item.action}</h3>
                    </div>
                    {item.confidence != null && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">{item.confidence}% confidence</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-3">{item.reason}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Current</p>
                      <p className="font-bold">{formatPrice(item.current_price)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">7-day change</p>
                      <p className="font-bold">{item.expected_change == null ? "Not enough history" : formatPercent(item.expected_change)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-950 mb-4">Inflation Tracking</h2>
            <div className="h-72">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={inflation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={tooltipFormatter} />
                    <Line type="monotone" dataKey="food" stroke="#dc2626" strokeWidth={3} />
                    <Line type="monotone" dataKey="headline" stroke="#2563eb" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              ) : chartFallback}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-950 mb-4">Market Pressure Signals</h2>
            <div className="h-72">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Exchange", value: signals.exchange_rate_pressure === "High" ? 85 : signals.exchange_rate_pressure === "Medium" ? 58 : 32 },
                      { name: "Fuel", value: signals.fuel_cost_pressure === "High" ? 88 : signals.fuel_cost_pressure === "Medium" ? 55 : 30 },
                      { name: "Supply", value: signals.harvest_supply === "High" ? 32 : signals.harvest_supply === "Moderate" ? 52 : 82 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#15803d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : chartFallback}
            </div>
            <p className="text-sm text-slate-500 mt-3">{signals.data_note}</p>
          </section>
        </div>

        {admin && <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-950">Record a market price</h2><p className="mt-1 text-sm text-slate-500">One observation per product, market, unit and date. Saving the same combination updates the observation instead of duplicating it.</p>
          <form onSubmit={saveObservation} className="mt-4 grid gap-3 md:grid-cols-3"><select required value={observation.product_id} onChange={(event) => { const item = observedProducts.find((product) => String(product.product_id || product.id) === event.target.value); setObservation({ ...observation, product_id: event.target.value, unit: item?.unit || observation.unit }); }} className="rounded border p-3"><option value="">Choose product</option>{observedProducts.map((product) => <option key={product.product_id || product.id} value={product.product_id || product.id}>{product.name}</option>)}</select><input required type="number" min="1" value={observation.price} onChange={(event) => setObservation({ ...observation, price: event.target.value })} className="rounded border p-3" placeholder="Observed price"/><input required value={observation.unit} onChange={(event) => setObservation({ ...observation, unit: event.target.value })} className="rounded border p-3" placeholder="Unit, e.g. 50kg"/><input required value={observation.location} onChange={(event) => setObservation({ ...observation, location: event.target.value })} className="rounded border p-3" placeholder="Location, e.g. Abuja"/><input required value={observation.market} onChange={(event) => setObservation({ ...observation, market: event.target.value })} className="rounded border p-3" placeholder="Market/source location"/><input type="date" required value={observation.observed_on} onChange={(event) => setObservation({ ...observation, observed_on: event.target.value })} className="rounded border p-3"/><select value={observation.source_type} onChange={(event) => setObservation({ ...observation, source_type: event.target.value })} className="rounded border p-3"><option value="market_visit">Market visit</option><option value="supplier_quote">Supplier quote</option><option value="official_feed">Official feed</option><option value="catalogue_snapshot">Catalogue snapshot</option></select><select value={observation.verification_status} onChange={(event) => setObservation({ ...observation, verification_status: event.target.value })} className="rounded border p-3"><option value="verified">Verified</option><option value="pending">Pending review</option></select><button className="rounded bg-emerald-700 px-4 py-3 font-bold text-white">Save observation</button></form>
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-950">Price AI + Inventory Signals</h2><p className="text-sm text-slate-500">Advisory restocking guidance from stock and the last 30 days of sales. No purchase is made automatically.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{inventorySignals.map((item) => {
            const trend = item.name?.toLowerCase().includes("rice") ? summary.riceChange : item.name?.toLowerCase().includes("maize") ? summary.maizeChange : 0;
            return <div key={item.id} className="rounded-lg border border-slate-200 p-4"><h3 className="font-bold">{item.name}</h3><p className="mt-2 text-sm">Stock: <b className={item.stock <= 20 ? "text-amber-700" : "text-emerald-700"}>{item.stock <= 0 ? "Out" : item.stock <= 20 ? "Low" : "Good"} ({item.stock})</b></p><p className="text-sm">Price trend: <b>{trend >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(trend))}</b></p><p className="text-sm">Sales velocity: <b>{item.velocity}</b></p><p className="mt-3 rounded bg-emerald-50 p-2 text-sm font-bold text-emerald-800">Suggested action: {item.action}</p></div>;
          })}</div>
        </section>}
      </div>
    </div>
  );
}
