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
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const assignedOrders = orders.filter((o) => o.status === "assigned").length;
  const transitOrders = orders.filter((o) => o.status === "in_transit").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const availableRiders = riders.filter((r) => r.status === "available").length;
  const busyRiders = riders.filter((r) => r.status === "busy").length;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.email?.toLowerCase().includes(search.toLowerCase()) ||
      String(order.id).includes(search);

    const matchesStatus = statusTab === "all" ? true : order.status === statusTab;

    const orderDateRaw = order.created_at || order.createdAt || order.order_date;
    const orderDate = orderDateRaw ? new Date(orderDateRaw) : null;

    const startBoundary = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const endBoundary = endDate ? new Date(`${endDate}T23:59:59`) : null;

    const matchesDate =
      !orderDate || Number.isNaN(orderDate.getTime())
        ? !startBoundary && !endBoundary
        : (!startBoundary || orderDate >= startBoundary) &&
          (!endBoundary || orderDate <= endBoundary);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusBadgeClass = (status) => {
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "assigned") return "bg-orange-100 text-orange-700";
    if (status === "in_transit") return "bg-blue-100 text-blue-700";
    if (status === "delivered") return "bg-green-100 text-green-700";
    return "bg-gray-200 text-gray-700";
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Logistics Dashboard 🚚
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Pending</p>
          <h2 className="text-3xl font-bold text-yellow-600">
            {pendingOrders}
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Assigned</p>
          <h2 className="text-3xl font-bold text-orange-600">
            {assignedOrders}
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">In Transit</p>
          <h2 className="text-3xl font-bold text-blue-600">
            {transitOrders}
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Delivered</p>
          <h2 className="text-3xl font-bold text-green-600">
            {deliveredOrders}
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Available Riders</p>
          <h2 className="text-3xl font-bold text-green-700">
            {availableRiders}
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Busy Riders</p>
          <h2 className="text-3xl font-bold text-red-600">
            {busyRiders}
          </h2>
        </div>

      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Search order, customer, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setStatusTab("all")}
          className={`px-3 py-2 rounded text-sm ${
            statusTab === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          All ({orders.length})
        </button>
        <button
          onClick={() => setStatusTab("pending")}
          className={`px-3 py-2 rounded text-sm ${
            statusTab === "pending" ? "bg-yellow-600 text-white" : "bg-yellow-100 text-yellow-700"
          }`}
        >
          Pending ({pendingOrders})
        </button>
        <button
          onClick={() => setStatusTab("assigned")}
          className={`px-3 py-2 rounded text-sm ${
            statusTab === "assigned" ? "bg-orange-600 text-white" : "bg-orange-100 text-orange-700"
          }`}
        >
          Assigned ({assignedOrders})
        </button>
        <button
          onClick={() => setStatusTab("in_transit")}
          className={`px-3 py-2 rounded text-sm ${
            statusTab === "in_transit" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
          }`}
        >
          In Transit ({transitOrders})
        </button>
        <button
          onClick={() => setStatusTab("delivered")}
          className={`px-3 py-2 rounded text-sm ${
            statusTab === "delivered" ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
          }`}
        >
          Delivered ({deliveredOrders})
        </button>
      </div>

      {/* 🔥 LIVE MAP */}
      <div className="mb-6">
        <RiderMap riders={riders} />
      </div>

      {/* ORDERS */}
      <div className="grid gap-4">
        {filteredOrders.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600">
            No orders match your search or status filter.
          </div>
        )}

        {filteredOrders.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-lg shadow">

            {/* HEADER */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-bold">
                  Order #{order.id}
                </h2>
                <p>{order.name} ({order.email})</p>
                <p className="text-sm text-gray-600">
                  Phone: {order.phone || "-"}
                </p>
                <p className="text-sm text-gray-600">
                  Address: {order.address || "-"}
                </p>
                <p className="text-sm font-semibold text-green-700">
                  ₦{Number(order.total_amount || 0).toLocaleString()}
                </p>
                {order.rider_name && (
                  <p className="text-sm text-blue-600">
                    Rider: {order.rider_name}
                  </p>
                )}
              </div>

              <span className={`text-sm px-2 py-1 rounded ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
            </div>

            {/* RIDER ASSIGN */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <select
                value={selectedRiders[order.id] || ""}
                onChange={(e) =>
                  setSelectedRiders({
                    ...selectedRiders,
                    [order.id]: e.target.value,
                  })
                }
                className="border p-2 rounded w-full"
              >
                <option value="">Select Rider</option>

                {riders
                  .filter((r) => r.status === "available")
                  .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone})
                  </option>
                ))}
              </select>

              <button
                onClick={() => assignRider(order.id)}
                className="bg-purple-600 text-white px-3 py-2 rounded"
              >
                Assign
              </button>
            </div>

            <div className="mt-3 grid gap-2 grid-cols-1 md:grid-cols-[150px_auto_150px_auto_auto]">
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
                className="bg-slate-800 text-white px-3 py-2 rounded"
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
                className="bg-green-700 text-white px-3 py-2 rounded"
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
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                onClick={() => updateStatus(order.id, "assigned")}
                className="bg-yellow-500 text-white px-2 py-2 rounded text-xs"
              >
                Assigned
              </button>

              <button
                onClick={() => updateStatus(order.id, "in_transit")}
                className="bg-blue-500 text-white px-2 py-2 rounded text-xs"
              >
                Transit
              </button>

              <button
                onClick={() => updateStatus(order.id, "delivered")}
                className="bg-green-600 text-white px-2 py-2 rounded text-xs"
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
