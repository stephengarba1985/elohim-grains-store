"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const health = (stock) => {
  const value = Number(stock || 0);
  if (value <= 0) return ["Out", "bg-slate-200 text-slate-700"];
  if (value <= 5) return ["Critical", "bg-red-100 text-red-700"];
  if (value <= 20) return ["Low", "bg-amber-100 text-amber-700"];
  return ["Good", "bg-emerald-100 text-emerald-700"];
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ action: "add", quantity: "", target_stock: "", reason: "Supplier delivery", note: "", reference: "" });

  const load = async () => {
    try {
      const response = await API.get("/products");
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Could not load inventory");
    }
  };
  useEffect(() => { load(); }, []);

  const openHistory = async (product) => {
    setActive(product);
    try {
      const response = await API.get(`/products/history/${product.id}`);
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Could not load stock history");
    }
  };

  const saveMovement = async (event) => {
    event.preventDefault();
    if (!active) return;
    try {
      await API.post(`/products/stock/${active.id}/movement`, {
        ...form,
        quantity: Number(form.quantity),
        target_stock: Number(form.target_stock),
      });
      toast.success("Stock movement recorded");
      setForm({ action: "add", quantity: "", target_stock: "", reason: "Supplier delivery", note: "", reference: "" });
      await load();
      await openHistory(active);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not update stock");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-black text-slate-950">Inventory Control</h1>
        <p className="mt-2 text-slate-600">Every change is recorded with a reason, reference and administrator.</p>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-4">Product</th><th className="p-4">Stock</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
            <tbody>{products.map((product) => {
              const [label, style] = health(product.stock_quantity);
              return <tr key={product.id} className="border-b last:border-0"><td className="p-4 font-bold text-slate-900">{product.name}{product.weight ? ` — ${product.weight}` : ""}</td><td className="p-4 font-black">{Number(product.stock_quantity || 0).toLocaleString()}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${style}`}>{label}</span></td><td className="p-4 text-right"><button onClick={() => { setActive(product); setHistory([]); }} className="mr-2 rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">Update Stock</button><button onClick={() => openHistory(product)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-700">View History</button></td></tr>;
            })}</tbody>
          </table>
        </div>

        {active && <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveMovement} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black">Update {active.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["add", "Add Stock"], ["remove", "Remove Stock"], ["adjust", "Adjust"]].map(([value, label]) => <button type="button" onClick={() => setForm({ ...form, action: value })} className={`rounded-lg p-3 font-bold ${form.action === value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`} key={value}>{label}</button>)}</div>
            {form.action === "adjust" ? <label className="mt-4 block text-sm font-bold">New stock level<input required min="0" type="number" value={form.target_stock} onChange={(e) => setForm({ ...form, target_stock: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label> : <label className="mt-4 block text-sm font-bold">Quantity<input required min="1" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>}
            <label className="mt-3 block text-sm font-bold">Reason<input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full rounded-lg border p-3" placeholder="Supplier delivery, damaged stock, returned order..." /></label>
            <label className="mt-3 block text-sm font-bold">Order or supplier reference (optional)<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="mt-1 w-full rounded-lg border p-3" placeholder="EG-2026-001245" /></label>
            <label className="mt-3 block text-sm font-bold">Notes (optional)<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border p-3" rows="2" /></label>
            <button className="mt-5 rounded-lg bg-slate-950 px-5 py-3 font-black text-white">Record movement</button>
          </form>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-black">Movement history</h2>{history.length === 0 ? <p className="mt-4 text-slate-500">Select View History to see this product’s audit trail.</p> : <div className="mt-4 space-y-3">{history.map((row) => <div key={row.id} className="border-b pb-3"><b className={Number(row.change) >= 0 ? "text-emerald-700" : "text-red-700"}>{Number(row.change) >= 0 ? "+" : ""}{row.change}</b><span className="ml-2 font-semibold">{row.reason}</span>{row.reference && <span className="ml-2 text-slate-500">— {row.reference}</span>}<p className="text-sm text-slate-500">{row.previous_stock} → {row.new_stock} · {row.name || "Administrator"} · {new Date(row.created_at).toLocaleString()}</p>{row.note && <p className="text-sm text-slate-600">{row.note}</p>}</div>)}</div>}</section>
        </section>}
      </div>
    </main>
  );
}
