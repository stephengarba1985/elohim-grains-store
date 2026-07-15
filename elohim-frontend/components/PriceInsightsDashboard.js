"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    setMounted(true);
    fetchInsights();
  }, []);

  const recommendations = insights?.recommendations || [];
  const trends = insights?.trends || [];
  const inflation = insights?.inflation || [];
  const signals = insights?.market_signals || {};

  const summary = useMemo(() => {
    const latest = trends[8] || trends[trends.length - 1] || {};
    const next = trends[9] || {};
    const foodInflation = inflation[8]?.food || inflation[inflation.length - 1]?.food || 0;
    const riceChange = latest.rice ? ((Number(next.rice || 0) - Number(latest.rice || 0)) / latest.rice) * 100 : 0;
    const maizeChange = latest.maize ? ((Number(next.maize || 0) - Number(latest.maize || 0)) / latest.maize) * 100 : 0;

    return {
      rice: latest.rice || 0,
      maize: latest.maize || 0,
      foodInflation,
      riceChange,
      maizeChange,
    };
  }, [trends, inflation]);

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
              AI Price Prediction
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Grain market intelligence
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Track rice and maize price movement, food inflation pressure, and the best time to buy.
            </p>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh Predictions"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Rice Price</p>
            <p className="text-xl font-bold text-slate-950">{formatPrice(summary.rice)}</p>
            <p className={summary.riceChange >= 0 ? "text-xs text-green-700" : "text-xs text-red-600"}>
              {summary.riceChange >= 0 ? "+" : ""}
              {formatPercent(summary.riceChange)} next month
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Maize Price</p>
            <p className="text-xl font-bold text-slate-950">{formatPrice(summary.maize)}</p>
            <p className={summary.maizeChange >= 0 ? "text-xs text-green-700" : "text-xs text-red-600"}>
              {summary.maizeChange >= 0 ? "+" : ""}
              {formatPercent(summary.maizeChange)} next month
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Food Inflation</p>
            <p className="text-xl font-bold text-orange-600">{formatPercent(summary.foodInflation)}</p>
            <p className="text-xs text-slate-500">modeled index</p>
          </div>
          <div className="bg-slate-950 text-white rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-300">Model</p>
            <p className="text-lg font-bold">{signals.model_version || "Local market model"}</p>
            <p className="text-xs text-slate-300">market-ready API</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-950">Rice vs Maize Price Trend</h2>
              <span className="text-xs text-slate-500">dotted area indicates forecast window</span>
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
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                      {item.confidence}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3">{item.reason}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Current</p>
                      <p className="font-bold">{formatPrice(item.current_price)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Next Month</p>
                      <p className="font-bold">{formatPrice(item.next_month_price)}</p>
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
      </div>
    </div>
  );
}
