"use client";
import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
const money = (v) => `₦${Number(v || 0).toLocaleString()}`;
const date = (v) => v ? new Date(v).toLocaleString() : "To be confirmed";

export default function VendorDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("Overview");
  const load = () => API.get("/vendors/dashboard").then((r) => setData(r.data)).catch((e) => toast.error(e.response?.data?.error || "Vendor dashboard unavailable"));
  useEffect(() => { load(); }, []);
  const advance = async (order, status) => { try { await API.patch(`/vendors/orders/${order.id}/fulfilment`, { status }); toast.success(status === "accepted" ? "Order accepted" : `Order marked ${status}`); load(); } catch (e) { toast.error(e.response?.data?.error || "Could not update order"); } };
  if (!data) return <div className="p-6">Loading vendor dashboard…</div>;
  const stats = data.stats || {};
  const tabs = ["Overview", "Products", "Orders", "Inventory", "Payouts", "Reviews", "Profile"];
  const next = { new: ["accepted", "ACCEPT ORDER"], accepted: ["preparing", "START PREPARING"], preparing: ["ready", "MARK READY"] };
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Verified Vendor</p><h1 className="mt-1 text-3xl font-black">{data.vendor.business_name}</h1>
    <div className="mt-6 flex flex-wrap gap-2">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 font-bold ${tab === item ? "bg-emerald-700 text-white" : "bg-white"}`}>{item}</button>)}</div>
    {tab === "Overview" && <><h2 className="mt-7 text-xl font-black">Today</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Sales", money(stats.sales)], ["Orders", stats.orders], ["Products", stats.products], ["Pending fulfilment", stats.pending_fulfilment], ["Available payout", money(stats.available_payout)], ["SLA attention", stats.overdue_orders]].map(([l, v]) => <div key={l} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-xl font-black">{v}</p></div>)}</div></>}
    {["Products", "Inventory"].includes(tab) && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Products & inventory</h2>{data.products.map((p) => <div key={p.id} className="mt-3 flex justify-between border-b pb-3"><span><b>{p.name}</b> · {p.weight || "Standard"}</span><span>{p.stock_quantity} in stock · {money(p.price)}</span></div>)}</section>}
    {tab === "Orders" && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Order fulfilment</h2><p className="mt-1 text-sm text-slate-500">Accept → Preparing → Ready for collection/delivery. Meet each deadline to protect your vendor standing.</p>{data.orders.map((o) => { const action = next[o.vendor_fulfilment_status]; return <div key={o.id} className="mt-4 rounded border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{o.order_reference || `Vendor order #${o.id}`}</p><p>{o.product_name} × {o.quantity}</p><p className="mt-1 text-sm text-slate-500">Fulfilment deadline: {date(o.fulfilment_deadline)}</p><p className="mt-1 text-sm capitalize text-slate-500">Status: {o.vendor_fulfilment_status || "new"} · Payment: {o.payment_status}</p></div><div className="text-right"><p className="font-bold text-emerald-700">{money(o.total_amount)}</p>{action && <button onClick={() => advance(o, action[0])} className="mt-3 rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{action[1]}</button>}</div></div></div>; })}</section>}
    {tab === "Payouts" && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Payouts</h2><p className="mt-3">Available after successful paid deliveries: <b className="text-emerald-700">{money(stats.available_payout)}</b></p><p className="mt-2 text-sm text-slate-500">Payout settlement is handled by Elohim after delivery and commission review.</p></section>}
    {tab === "Reviews" && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Reviews</h2>{data.reviews.length ? data.reviews.map((r) => <p key={r.id} className="mt-3 border-b pb-3">{r.rating}/5 — {r.comment || "No comment"}</p>) : <p className="mt-3 text-slate-500">No reviews yet.</p>}</section>}
    {tab === "Profile" && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Profile</h2><p className="mt-3">{data.vendor.location}</p><p>{data.vendor.phone}</p><p className="mt-2 text-slate-500">{data.vendor.description}</p></section>}
  </div></main>;
}
