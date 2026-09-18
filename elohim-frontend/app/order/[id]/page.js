"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import API from "../../../lib/api";
import toast from "react-hot-toast";

export default function OrderDetails() {
  const { id } = useParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);

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

  if (!order) return <p className="p-6">Loading...</p>;

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

        <div className="bg-white p-5 rounded-xl shadow mt-4">
          <h2 className="text-lg font-black text-slate-900">Status</h2>
          <div className="mt-4 space-y-3 text-sm font-semibold">
            <p className="text-emerald-700">🟢 Payment confirmed</p>
            <p className="text-amber-700">🟡 Processing</p>
            <p className="text-slate-400">⚪ Out for delivery</p>
            <p className="text-slate-400">⚪ Delivered</p>
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
            href={`https://wa.me/2348039688939?text=${encodeURIComponent(`Hello Elohim Grains, I need help with order ${orderReference}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl shadow font-bold"
          >
            CHAT ON WHATSAPP
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
