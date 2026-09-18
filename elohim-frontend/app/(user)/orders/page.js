"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
const activeStatuses = new Set(["pending", "paid", "confirmed", "processing", "assigned", "picked_up", "ready_for_delivery", "in_transit", "near_customer"]);
const labelForStatus = (status) => ({ pending: "Order Received", paid: "Confirmed", confirmed: "Confirmed", processing: "Preparing", assigned: "Ready for Delivery", picked_up: "Ready for Delivery", ready_for_delivery: "Ready for Delivery", in_transit: "Out for Delivery", near_customer: "Out for Delivery", delivered: "Delivered", cancelled: "Cancelled" }[String(status || "").toLowerCase()] || "Order Received");

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (!user?.id) return;
        const response = await API.get(`/orders/user/${user.id}`);
        const summaries = await Promise.all((response.data || []).map(async (order) => {
          try { const detail = await API.get(`/orders/${order.id}`); return { ...order, items: detail.data.items || [] }; }
          catch { return { ...order, items: [] }; }
        }));
        setOrders(summaries);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (filter === "active") return activeStatuses.has(status);
    return filter === "all" || status === filter;
  }), [orders, filter]);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-6"><div className="mx-auto max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Elohim Grains</p><h1 className="mt-1 text-3xl font-black">My Orders</h1><div className="mt-5 flex flex-wrap gap-2">{[["all", "All"], ["active", "Active"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]].map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === id ? "bg-emerald-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{label}</button>)}</div>{loading ? <p className="mt-8 text-slate-500">Loading your orders...</p> : visibleOrders.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold">No orders found.</p><Link href="/products" className="mt-3 inline-block font-bold text-emerald-700">Shop now</Link></div> : <div className="mt-6 space-y-4">{visibleOrders.map((order) => <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Order #{order.order_number || `EG-${new Date(order.created_at).getFullYear()}-${String(order.id).padStart(6, "0")}`}</h2><p className="mt-1 text-sm text-slate-500">{new Date(order.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">● {labelForStatus(order.status)}</span></div><div className="mt-4 text-sm text-slate-700">{order.items.length ? order.items.map((item) => <p key={item.id}>{item.name} {item.weight || ""} × {item.quantity}</p>) : <p>Order items are being prepared.</p>}</div><p className="mt-4 text-xl font-black">{money(order.total_amount)}</p><div className="mt-4 flex gap-4 text-sm font-black text-emerald-700"><Link href={`/order/${order.id}`}>VIEW ORDER</Link><Link href={`/track/${order.id}`}>TRACK DELIVERY</Link></div></article>)}</div>}</div></main>;
}
