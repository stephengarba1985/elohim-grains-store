"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";

const money = (value) => `\u20A6${Number(value || 0).toLocaleString()}`;

export default function AdminDashboard() {
  const [data, setData] = useState({ stats: {}, orders: [], products: [], bulk: [], bnpl: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      API.get("/admin/stats"), API.get("/orders"), API.get("/products"),
      API.get("/bulk"), API.get("/bnpl/admin/overview"),
    ]).then(([stats, orders, products, bulk, bnpl]) => {
      setData({
        stats: stats.status === "fulfilled" ? stats.value.data || {} : {},
        orders: orders.status === "fulfilled" ? orders.value.data || [] : [],
        products: products.status === "fulfilled" ? products.value.data || [] : [],
        bulk: bulk.status === "fulfilled" ? bulk.value.data || [] : [],
        bnpl: bnpl.status === "fulfilled" ? bnpl.value.data?.reminders || [] : [],
      });
      setLoading(false);
    });
  }, []);

  const metrics = useMemo(() => {
    const pending = data.orders.filter(({ status }) => ["pending", "paid"].includes(status));
    const deliveries = data.orders.filter(({ status }) =>
      ["assigned", "ready_for_delivery", "in_transit"].includes(status)
    );
    return {
      pending,
      deliveries,
      payments: data.orders.filter(({ payment_status }) => payment_status === "pending"),
      lowStock: data.products.filter((item) => Number(item.stock_quantity) > 0 && Number(item.stock_quantity) <= 10),
      bulk: data.bulk.filter(({ status }) => status === "pending"),
      overdue: data.bnpl.filter(({ overdue }) => overdue),
    };
  }, [data]);

  const topCards = [
    ["Revenue", money(data.stats.todayRevenue), "/admin/payments"],
    ["Orders", data.stats.todayOrders || 0, "/admin/orders"],
    ["New Customers", data.stats.newCustomers || 0, "/admin/customers"],
    ["Pending Orders", metrics.pending.length, "/admin/orders"],
    ["Deliveries", metrics.deliveries.length, "/admin/logistics"],
    ["Bulk Requests", metrics.bulk.length, "/admin/bulk"],
  ];
  const attention = [
    [metrics.pending.length, "orders awaiting confirmation", "/admin/orders"],
    [metrics.payments.length, "payments awaiting verification", "/admin/payments"],
    [metrics.lowStock.length || data.stats.lowStock || 0, "products low in stock", "/admin/inventory"],
    [metrics.deliveries.length, "deliveries not completed", "/admin/logistics"],
    [metrics.bulk.length, "new bulk requests", "/admin/bulk"],
    [metrics.overdue.length, "BNPL payments overdue", "/admin/bnpl"],
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Elohim operations</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">What needs my attention today?</h1>
        <p className="mt-2 text-slate-600">Live priorities for orders, payments, stock and deliveries.</p>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {topCards.map(([label, value, href]) => (
            <Link key={label} href={href} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-400">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{loading ? "\u2014" : value}</p>
              <span className="mt-3 block text-xs font-bold text-emerald-700">View details &rarr;</span>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-black text-slate-950">&#9888; Requires Attention</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map(([count, label, href]) => (
              <Link key={label} href={href} className="rounded-xl bg-white p-4 shadow-sm transition hover:bg-amber-100">
                <b className="text-2xl text-amber-700">{loading ? "\u2014" : count}</b>
                <span className="ml-2 font-semibold text-slate-800">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
