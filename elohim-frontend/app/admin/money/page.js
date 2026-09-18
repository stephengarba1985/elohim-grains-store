"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";
const money = (n) => `\u20A6${Number(n || 0).toLocaleString()}`;

export default function MoneyControlCentre() {
  const [data, setData] = useState(null);
  const load = async () => { try { setData((await API.get("/admin/money-overview")).data); } catch { toast.error("Failed to load financial overview"); } };
  useEffect(() => { load(); }, []);
  const cards = data ? [["Sales today", data.sales_today, "/admin/payments", "Revenue from verified product sales."], ["Wallet funds held", data.wallet_funds_held, "/admin/wallet", "Customer wallet liability — not sales revenue."], ["Savings funds held", data.savings_funds_held, "/admin/plans", "Active customer food-savings balances."], ["Outstanding BNPL", data.outstanding_bnpl, "/admin/bnpl", "Amounts customers still owe under active agreements."], ["Pending refunds", data.pending_refunds, "/admin/payments", "Refunds awaiting handling."]] : [];
  return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Financial controls</p><h1 className="mt-1 text-3xl font-black">Money Control Centre</h1><p className="mt-2 max-w-3xl text-slate-600">Sales revenue, wallet funds and savings are separate balances. This view is for operational oversight, not manual balance editing.</p><section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data ? cards.map(([label,value,href,description]) => <Link key={label} href={href} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-400"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{money(value)}</p><p className="mt-3 text-sm text-slate-600">{description}</p><span className="mt-4 block text-sm font-bold text-emerald-700">Open control centre &rarr;</span></Link>) : <p>Loading financial balances…</p>}</section><section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black">Financial separation rule</h2><p className="mt-2 text-slate-700">Wallet and savings balances belong to customers. Sales only represents completed product revenue; BNPL is receivable exposure; pending refunds are money owed back to customers.</p></section></div></main>;
}
