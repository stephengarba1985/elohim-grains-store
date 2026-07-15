"use client";

import { useEffect, useState } from "react";
import API from "../../../lib/api";
import toast from "react-hot-toast";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);

  const [riders, setRiders] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchRiders();
  }, []);

  /* ========================= FETCH ORDERS ========================= */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/orders");

      console.log("📦 ORDERS:", res.data);

      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  /* ========================= FETCH RIDERS ========================= */
  const fetchRiders = async () => {
    try {
      const res = await API.get("/riders");
      setRiders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load riders");
    }
  };

  /* ========================= VIEW DETAILS ========================= */
  const viewDetails = async (id) => {
    try {
      const res = await API.get(`/orders/${id}`);
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setSelected(id);
    } catch {
      toast.error("Failed to load details");
    }
  };

  /* ========================= UPDATE STATUS ========================= */
  const updateStatus = async (id, status) => {
    try {
      await API.put(`/orders/${id}/status`, { status });
      toast.success("Status updated");
      fetchOrders();
    } catch (err) {
      console.error("FULL ERROR:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  /* ========================= ASSIGN RIDER ========================= */
  const assignRider = async (deliveryId) => {
    const rider_id = selectedRiders[deliveryId];

    if (!rider_id) {
      toast.error("Select a rider first");
      return;
    }

    try {
      await API.put(`/orders/${deliveryId}/assign-rider`, { rider_id });

      toast.success("Rider assigned 🚚");

      fetchOrders();
      fetchRiders();
    } catch (err) {
      console.error(err);
      toast.error("Assignment failed");
    }
  };

  const releaseEscrow = async (order) => {
    if (!order.escrow_payment_id) {
      return toast.error("No held escrow payment found");
    }

    try {
      await API.post(`/escrow/${order.escrow_payment_id}/release`, {
        note: "Delivery confirmed from orders dashboard",
      });
      toast.success("Escrow released");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Escrow release failed");
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">
        Logistics Dashboard 🚚
      </h1>

      {/* DEBUG PANEL */}
      <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
        <p><b>Orders:</b> {orders.length}</p>
        <p><b>Riders:</b> {riders.length}</p>
      </div>

      {loading && <p>Loading orders...</p>}

      <div className="grid gap-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className={`p-4 rounded shadow ${
              order.is_bulk ? "bg-indigo-50 border border-indigo-200" : "bg-white"
            }`}
          >

            {/* HEADER */}
            <div className="flex justify-between">
              <div>

                {/* ORDER TITLE + BADGES */}
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">
                    Order #{order.id}
                  </h2>

                  {/* SUBSCRIPTION BADGE */}
                  {order.is_subscription && (
                    <span className="bg-purple-100 text-purple-600 px-2 py-1 text-xs rounded">
                      Subscription
                    </span>
                  )}

                  {/* BULK BADGE */}
                  {order.is_bulk && (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 text-xs rounded font-semibold">
                      BULK ORDER
                    </span>
                  )}

                  {order.is_escrow && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 text-xs rounded font-semibold">
                      ESCROW {order.escrow_status}
                    </span>
                  )}
                </div>

                <p>
                  {order.name || "Unknown"} ({order.email || "No email"})
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-green-700">
                  ₦{Number(order.total_amount || 0).toLocaleString()}
                </p>
                <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                  {order.status}
                </span>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => viewDetails(order.id)}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                View
              </button>

              <button
                onClick={() => updateStatus(order.id, "processing")}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                Processing
              </button>

              <button
                onClick={() => updateStatus(order.id, "delivered")}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Delivered
              </button>

              {order.escrow_status === "held" && (
                <button
                  onClick={() => releaseEscrow(order)}
                  className="bg-emerald-700 text-white px-3 py-1 rounded"
                >
                  Release Escrow
                </button>
              )}
            </div>

            {/* NO RIDERS */}
            {riders.length === 0 && (
              <p className="text-red-500 text-sm mt-2">
                ⚠️ No riders found (check backend)
              </p>
            )}

            {/* RIDER ASSIGNMENT */}
            {riders.length > 0 && (
              <div className="mt-3 flex gap-2 items-center">

                <select
                  value={selectedRiders[order.id] || ""}
                  onChange={(e) =>
                    setSelectedRiders({
                      ...selectedRiders,
                      [order.id]: e.target.value,
                    })
                  }
                  className="border p-2 rounded text-sm"
                >
                  <option value="">Select Rider</option>

                  {riders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.name} ({rider.phone})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => assignRider(order.id)}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
                >
                  Assign Rider
                </button>

              </div>
            )}

            {/* ORDER DETAILS */}
            {selected === order.id && (
              <div className="mt-3 border-t pt-3">
                {items.length === 0 && <p>No items</p>}

                {items.map((item) => (
                  <p key={item.id}>
                    {item.name} × {item.quantity}
                  </p>
                ))}
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
