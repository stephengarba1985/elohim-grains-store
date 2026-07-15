"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import API from "../../../lib/api";
import toast from "react-hot-toast";

const RiderMap = dynamic(() => import("@/components/RiderMap"), {
  ssr: false,
});

export default function LogisticsPage() {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState({});
  const [selectedEtas, setSelectedEtas] = useState({});
  const [selectedOtps, setSelectedOtps] = useState({});

  /* =========================
     INITIAL LOAD
  ========================= */
  useEffect(() => {
    fetchOrders();
    fetchRiders();
  }, []);

  /* =========================
     LIVE UPDATE (MAP REFRESH)
  ========================= */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRiders();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     FETCH ORDERS
  ========================= */
  const fetchOrders = async () => {
    try {
      const res = await API.get("/orders");
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    }
  };

  /* =========================
     FETCH RIDERS
  ========================= */
  const fetchRiders = async () => {
    try {
      const res = await API.get("/riders");
      setRiders(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load riders");
    }
  };

  /* =========================
     ASSIGN RIDER
  ========================= */
  const assignRider = async (orderId) => {
    const rider_id = selectedRiders[orderId];

    if (!rider_id) {
      toast.error("Select rider");
      return;
    }

    try {
      await API.put(`/orders/${orderId}/assign-rider`, { rider_id });

      toast.success("Rider assigned 🚚");

      fetchOrders();
      fetchRiders();

    } catch (err) {
      console.error(err);
      toast.error("Assignment failed");
    }
  };

  /* =========================
     UPDATE STATUS
  ========================= */
  const updateStatus = async (orderId, status) => {
    try {
      await API.put(`/orders/${orderId}/status`, { status });

      toast.success(`Updated to ${status}`);

      fetchOrders();

    } catch (err) {
      console.error("FULL ERROR:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  const updateEta = async (orderId) => {
    const eta_minutes = selectedEtas[orderId];

    if (!eta_minutes) {
      toast.error("Enter ETA minutes");
      return;
    }

    try {
      await API.patch(`/tracking/order/${orderId}/eta`, { eta_minutes });
      toast.success("ETA updated");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "ETA update failed");
    }
  };

  const confirmDeliveryOtp = async (orderId) => {
    const otp = selectedOtps[orderId];

    if (!otp) {
      toast.error("Enter delivery OTP");
      return;
    }

    try {
      await API.post(`/tracking/order/${orderId}/confirm-otp`, { otp });
      toast.success("Delivery confirmed with OTP");
      setSelectedOtps({ ...selectedOtps, [orderId]: "" });
      fetchOrders();
      fetchRiders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "OTP confirmation failed");
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Logistics Dashboard 🚚
      </h1>

      {/* 🔥 LIVE MAP */}
      <div className="mb-6">
        <RiderMap riders={riders} />
      </div>

      {/* ORDERS */}
      <div className="grid gap-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded shadow">

            {/* HEADER */}
            <div className="flex justify-between">
              <div>
                <h2 className="font-bold">
                  Order #{order.id}
                </h2>
                <p>{order.name} ({order.email})</p>
              </div>

              <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                {order.status}
              </span>
            </div>

            {/* RIDER ASSIGN */}
            <div className="mt-3 flex gap-2">
              <select
                value={selectedRiders[order.id] || ""}
                onChange={(e) =>
                  setSelectedRiders({
                    ...selectedRiders,
                    [order.id]: e.target.value,
                  })
                }
                className="border p-2 rounded"
              >
                <option value="">Select Rider</option>

                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone})
                  </option>
                ))}
              </select>

              <button
                onClick={() => assignRider(order.id)}
                className="bg-purple-600 text-white px-3 py-1 rounded"
              >
                Assign
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[150px_auto_150px_auto_auto]">
              <input
                type="number"
                min="1"
                value={selectedEtas[order.id] || ""}
                onChange={(e) =>
                  setSelectedEtas({
                    ...selectedEtas,
                    [order.id]: e.target.value,
                  })
                }
                className="border p-2 rounded"
                placeholder="ETA mins"
              />
              <button
                onClick={() => updateEta(order.id)}
                className="bg-slate-800 text-white px-3 py-1 rounded"
              >
                Update ETA
              </button>
              <input
                value={selectedOtps[order.id] || ""}
                onChange={(e) =>
                  setSelectedOtps({
                    ...selectedOtps,
                    [order.id]: e.target.value,
                  })
                }
                className="border p-2 rounded"
                placeholder="Delivery OTP"
              />
              <button
                onClick={() => confirmDeliveryOtp(order.id)}
                className="bg-green-700 text-white px-3 py-1 rounded"
              >
                Confirm OTP
              </button>
              <a
                href={`/track/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-300 text-slate-700 px-3 py-2 rounded text-center"
              >
                Track
              </a>
            </div>

            {/* STATUS BUTTONS */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => updateStatus(order.id, "assigned")}
                className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
              >
                Assigned
              </button>

              <button
                onClick={() => updateStatus(order.id, "in_transit")}
                className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
              >
                Transit
              </button>

              <button
                onClick={() => updateStatus(order.id, "delivered")}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs"
              >
                Delivered
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
