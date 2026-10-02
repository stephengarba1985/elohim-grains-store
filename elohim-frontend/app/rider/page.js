"use client";

import { useCallback, useEffect, useState } from "react";
import API from "../../lib/api";

const RIDER_TOKEN_KEY = "elohim_rider_portal_token";
const RIDER_PROFILE_KEY = "elohim_rider_portal_profile";
const statusLabel = (status) => ({ assigned: "Assigned", pending: "Awaiting start", ready_for_delivery: "Ready for delivery", in_transit: "Out for delivery" }[status] || "Assigned");
const request = (token, config = {}) => ({ ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } });

export default function RiderPage() {
  const [token, setToken] = useState("");
  const [rider, setRider] = useState(null);
  const [credentials, setCredentials] = useState({ rider_id: "", phone: "", pin: "" });
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadDeliveries = useCallback(async (activeToken) => {
    if (!activeToken) return;
    setLoading(true);
    try {
      const response = await API.get("/riders/portal/deliveries", request(activeToken));
      const nextDeliveries = response.data?.deliveries || [];
      setDeliveries(nextDeliveries);
      setSelected((current) => current ? nextDeliveries.find((item) => item.delivery_id === current.delivery_id) || null : null);
    } catch (err) {
      setMessage(err.response?.data?.error || "Could not load your deliveries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem(RIDER_TOKEN_KEY);
    const savedProfile = localStorage.getItem(RIDER_PROFILE_KEY);
    if (!savedToken) return;
    setToken(savedToken);
    if (savedProfile) setRider(JSON.parse(savedProfile));
  }, []);

  useEffect(() => {
    if (!token) return;
    loadDeliveries(token);
    const refresh = setInterval(() => loadDeliveries(token), 60000);
    return () => clearInterval(refresh);
  }, [token, loadDeliveries]);

  useEffect(() => {
    if (!token || !navigator.geolocation) return;
    const sendLocation = () => navigator.geolocation.getCurrentPosition(
      (position) => API.put("/riders/portal/location", { latitude: position.coords.latitude, longitude: position.coords.longitude }, request(token)).catch(() => {}),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    );
    sendLocation();
    const interval = setInterval(sendLocation, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const signIn = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const response = await API.post("/riders/portal/login", credentials);
      localStorage.setItem(RIDER_TOKEN_KEY, response.data.token);
      localStorage.setItem(RIDER_PROFILE_KEY, JSON.stringify(response.data.rider));
      setToken(response.data.token);
      setRider(response.data.rider);
    } catch (err) {
      setMessage(err.response?.data?.error || "Unable to sign in. Check your details.");
    }
  };

  const startDelivery = async (delivery) => {
    setMessage("");
    try {
      await API.put(`/riders/portal/deliveries/${delivery.delivery_id}/start`, {}, request(token));
      setMessage(`${delivery.order_number || `Order #${delivery.order_id}`} is now out for delivery.`);
      await loadDeliveries(token);
    } catch (err) {
      setMessage(err.response?.data?.error || "Could not start this delivery.");
    }
  };

  const confirmDelivery = async () => {
    if (!selected || !pin.trim()) return setMessage("Enter the PIN provided by the customer.");
    setMessage("");
    try {
      await API.post(`/riders/portal/deliveries/${selected.delivery_id}/confirm`, { otp: pin.trim() }, request(token));
      setPin("");
      setSelected(null);
      setMessage("Delivery confirmed successfully.");
      await loadDeliveries(token);
    } catch (err) {
      setMessage(err.response?.data?.error || "The delivery PIN could not be confirmed.");
    }
  };

  const signOut = () => {
    localStorage.removeItem(RIDER_TOKEN_KEY);
    localStorage.removeItem(RIDER_PROFILE_KEY);
    setToken(""); setRider(null); setDeliveries([]); setSelected(null);
  };

  if (!token) return <main className="min-h-screen bg-stone-50 px-4 py-10 text-slate-900"><section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Elohim Grains</p><h1 className="mt-2 text-3xl font-bold">Rider portal</h1><p className="mt-2 text-sm leading-6 text-slate-600">Sign in to see only the deliveries assigned to you.</p><form onSubmit={signIn} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Rider ID<input required inputMode="numeric" value={credentials.rider_id} onChange={(event) => setCredentials({ ...credentials, rider_id: event.target.value })} placeholder="Your rider ID" className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-600" /></label><label className="block text-sm font-semibold">Registered phone number<input required inputMode="tel" value={credentials.phone} onChange={(event) => setCredentials({ ...credentials, phone: event.target.value })} placeholder="080..." className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-600" /></label><label className="block text-sm font-semibold">Portal PIN<input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="current-password" value={credentials.pin} onChange={(event) => setCredentials({ ...credentials, pin: event.target.value.replace(/\\D/g, "").slice(0, 6) })} placeholder="6-digit PIN" className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-600" /></label>{message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-bold text-white">VIEW TODAY&apos;S DELIVERIES</button></form></section></main>;

  const mapUrl = selected?.delivery_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.delivery_address)}` : null;
  return <main className="min-h-screen bg-stone-50 pb-10 text-slate-900"><header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur"><div className="mx-auto flex max-w-xl items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Elohim rider</p><h1 className="text-xl font-bold">Today&apos;s deliveries</h1></div><button onClick={signOut} className="text-sm font-semibold text-slate-600">Sign out</button></div></header><section className="mx-auto max-w-xl px-4 py-5"><div className="rounded-2xl bg-emerald-800 p-5 text-white"><p className="text-sm text-emerald-100">{rider?.name || "Rider"}</p><p className="mt-1 text-3xl font-bold">{deliveries.length} remaining</p><p className="mt-1 text-sm text-emerald-100">Keep location on while delivering so customers can receive updates.</p></div>{message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{loading && <p className="mt-5 text-sm text-slate-500">Refreshing deliveries...</p>}<div className="mt-5 space-y-3">{!loading && deliveries.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-slate-600">No active deliveries assigned to you.</div>}{deliveries.map((delivery) => <article key={delivery.delivery_id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{delivery.order_number || `Order #${delivery.order_id}`}</h2><p className="mt-1 text-sm text-slate-600">{delivery.delivery_address || "Address will be confirmed by operations"}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{statusLabel(delivery.delivery_status)}</span></div><div className="mt-3 flex gap-2">{delivery.delivery_status !== "in_transit" && <button onClick={() => startDelivery(delivery)} className="flex-1 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white">START DELIVERY</button>}<button onClick={() => { setSelected(delivery); setPin(""); }} className="flex-1 rounded-xl border border-emerald-700 px-3 py-3 text-sm font-bold text-emerald-800">VIEW</button></div></article>)}</div></section>{selected && <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-50"><div className="mx-auto min-h-screen max-w-xl px-4 py-5"><button onClick={() => setSelected(null)} className="text-sm font-bold text-emerald-800">← TODAY&apos;S DELIVERIES</button><h2 className="mt-5 text-2xl font-bold">{selected.order_number || `Order #${selected.order_id}`}</h2><div className="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</p><p className="mt-1 font-semibold">{selected.customer_name || "Customer"}</p><a href={`tel:${selected.customer_phone || ""}`} className="text-emerald-700">{selected.customer_phone || "Phone unavailable"}</a></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Address & landmark</p><p className="mt-1 leading-6">{selected.delivery_address || "Address unavailable"}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order</p><ul className="mt-1 space-y-1 text-sm">{(selected.items || []).map((item, index) => <li key={`${item.name}-${index}`}>{item.name} × {item.quantity}</li>)}</ul></div><div className="grid grid-cols-2 gap-3"><a href={`tel:${selected.customer_phone || ""}`} className="rounded-xl bg-slate-900 px-3 py-3 text-center text-sm font-bold text-white">CALL CUSTOMER</a>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-3 text-center text-sm font-bold">OPEN MAP</a> : <span className="rounded-xl border border-stone-200 px-3 py-3 text-center text-sm text-slate-400">MAP UNAVAILABLE</span>}</div></div><div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-bold text-emerald-950">Confirm delivery</p><p className="mt-1 text-sm leading-5 text-emerald-900">Ask the customer for their delivery PIN only after they have received the order.</p><input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" maxLength="10" placeholder="Enter delivery PIN" className="mt-4 w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 outline-none focus:border-emerald-700" /><button onClick={confirmDelivery} className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-bold text-white">CONFIRM DELIVERY</button></div></div></div>}</main>;
}
