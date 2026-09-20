"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import API from "../../../lib/api";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

export default function OrderDetails() {
  const { id } = useParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState("");
  const { addToCart, setUser: setCartUser } = useCartStore();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    fetchOrder();
  }, []);

  const fetchOrder = async () => {
    try {
      const res = await API.get(`/orders/${id}`);
      setOrder(res.data.order);
      setItems(res.data.items);
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Failed to load order");
    }
  };

  const formatPrice = (price) =>
    `₦${Number(price).toLocaleString()}`;

  const productsTotal = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const deliveryFee = Number(order?.delivery_fee || 0);
  const total = Number(order?.total_amount || productsTotal + deliveryFee);
  const orderReference = order?.order_number || `EG-${new Date(order?.created_at || Date.now()).getFullYear()}-${String(order?.id || id).padStart(6, "0")}`;
  const statusIndex = {
    pending: 0, paid: 1, confirmed: 1, processing: 2,
    assigned: 3, picked_up: 3, ready_for_delivery: 3,
    in_transit: 4, near_customer: 4, delivered: 5,
  }[String(order?.status || "").toLowerCase()] ?? 0;
  const exceptionalStatus = {
    payment_pending: "Payment Pending", cancelled: "Cancelled", delivery_failed: "Delivery Failed", refunded: "Refunded",
  }[String(order?.status || "").toLowerCase()];
  const customerStatuses = ["Order Received", "Confirmed", "Preparing", "Ready for Delivery", "Out for Delivery", "Delivered"];

  if (!order) return <p className="p-6">Loading...</p>;

  const buyAgain = async () => {
    if (!user) return toast.error("Please login first");
    try {
      setReordering(true);
      setCartUser(user);
      for (const item of items) await addToCart(item.product_id, item.quantity, item.variant_id || null);
      toast.success("Your previous order is back in the cart");
      router.push("/cart");
    } catch (err) {
      toast.error("Could not add all items to your cart");
    } finally { setReordering(false); }
  };

  const scheduleRepeatOrder = async (plan) => {
    if (!user) return toast.error("Please login first");
    try {
      let custom_days;
      if (plan === "custom") { custom_days = Number(window.prompt("Deliver every how many days?", "30")); if (!Number.isInteger(custom_days) || custom_days < 1) return; }
      setSubscribingPlan(plan);
      await API.post("/subscriptions/from-order", { order_id: order.id, plan, custom_days });
      toast.success("Your repeat delivery schedule is active");
    } catch (err) { toast.error("Could not schedule this delivery"); }
    finally { setSubscribingPlan(""); }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">

        {/* SUCCESS BANNER */}
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-4 text-center">
          🎉 Your order was placed successfully!
        </div>

        {/* ORDER HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow mb-4">
          <h1 className="text-2xl font-black mb-2">Order Confirmed</h1>
          <p className="font-black text-emerald-700">Order #{orderReference}</p>
          <p className="mt-2 text-emerald-700">🟢 <b>Payment confirmed</b></p>
          <p className="mt-1 text-slate-600">Status: <b>Order received</b></p>

          <p className="text-gray-500 text-sm">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>

        {/* ITEMS */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow">
              <h2 className="font-bold text-lg">{item.name}</h2>

              <p className="text-sm text-gray-500">
                {item.weight}
              </p>

              <div className="flex justify-between mt-2">
                <span>
                  {formatPrice(item.price)} × {item.quantity}
                </span>

                <span className="font-semibold text-green-700">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* TRANSACTION TOTAL */}
        <div className="bg-white p-5 rounded-xl shadow mt-4">
          <h2 className="text-lg font-bold text-slate-900">Transaction summary</h2>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-gray-600"><span>Products</span><span>{formatPrice(productsTotal)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Delivery</span><span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Confirmed separately for bulk delivery"}</span></div>
            <div className="flex justify-between border-t pt-3 text-xl font-bold text-green-700"><span>Total paid</span><span>{formatPrice(total)}</span></div>
          </div>
        </div>

        {order.delivery_address && (
          <div className="bg-white p-5 rounded-xl shadow mt-4">
            <h2 className="text-lg font-black text-slate-900">Delivery address</h2>
            <p className="mt-2 text-slate-600">{order.delivery_address}</p>
          </div>
        )}

        {order.status === "delivered" && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-900 shadow-sm">
            <h2 className="text-2xl font-black">Your order has been delivered 🎉</h2>
            <p className="mt-2">We hope you enjoyed your purchase.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button onClick={() => toast("Order ratings are coming next—thank you for your feedback!")} className="rounded-xl border border-emerald-300 bg-white px-4 py-3 font-bold">⭐ RATE YOUR ORDER</button>
              <button onClick={buyAgain} disabled={reordering} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:bg-slate-300">{reordering ? "ADDING..." : `BUY AGAIN — ${formatPrice(productsTotal)}`}</button>
            </div>
            <div className="mt-6 border-t border-emerald-200 pt-5">
              <p className="font-black">You buy these items regularly.</p><p className="mt-1 text-sm">Save time by scheduling your next delivery.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">{[["weekly", "Weekly"], ["biweekly", "Every 2 Weeks"], ["monthly", "Monthly"], ["custom", "Custom"]].map(([plan, label]) => <button key={plan} onClick={() => scheduleRepeatOrder(plan)} disabled={Boolean(subscribingPlan)} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold">{subscribingPlan === plan ? "SCHEDULING..." : label}</button>)}</div>
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl shadow mt-4">
          <h2 className="text-lg font-black text-slate-900">Status</h2>
          <div className="mt-4 space-y-3 text-sm font-semibold">
            {exceptionalStatus ? <p className="text-red-700">● {exceptionalStatus}</p> : customerStatuses.map((status, index) => (
              <p key={status} className={index <= statusIndex ? "text-emerald-700" : "text-slate-400"}>{index <= statusIndex ? "●" : "○"} {status}</p>
            ))}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mt-6 flex gap-3">

          <button
            onClick={() => router.push("/")}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl shadow"
          >
            Continue Shopping 🛒
          </button>

          <button
            onClick={() => router.push(`/track/${order.id}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow"
          >
            TRACK MY ORDER
          </button>

          <a
            href={`https://wa.me/2348039688939?text=${encodeURIComponent(`Hello Elohim Grains, I need help with order ${orderReference}. Current status: ${order.status || "Order received"}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl shadow font-bold"
          >
            GET HELP WITH THIS ORDER
          </a>

          <button
            onClick={() => {
              if (user?.is_admin) {
                router.push("/admin");
              } else {
                router.push("/dashboard");
              }
            }}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl shadow"
          >
            Go to Dashboard 📊
          </button>

        </div>

      </div>
    </div>
  );
}
