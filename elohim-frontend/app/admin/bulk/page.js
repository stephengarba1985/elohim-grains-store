"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";

export default function BulkAdmin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  /* =========================
     FETCH DATA
  ========================= */
  const fetchRequests = async () => {
    try {
      setLoading(true);

      const res = await API.get("/bulk");

      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ FETCH ERROR:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const interval = setInterval(() => {
      fetchRequests();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  /* =========================
     ACTIONS
  ========================= */
  const updateStatus = async (id, status) => {
    let approved_price = null;

    if (status === "approved") {
      approved_price = prompt("Enter approved price per unit:");
      if (!approved_price) return;
    }

    try {
      await API.put(`/bulk/${id}`, {
        status,
        approved_price: approved_price ? parseFloat(approved_price) : null,
      });

      fetchRequests();
    } catch (err) {
      console.error("❌ UPDATE ERROR:", err);
    }
  };

  /* =========================
     GROUP DATA
  ========================= */
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const accepted = requests.filter((r) => r.status === "accepted");

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">📦 Bulk Management</h1>

      {/* REFRESH BUTTON */}
      <button
        onClick={fetchRequests}
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        🔄 Refresh
      </button>

      <p className="text-sm text-gray-500 mb-4">
        Total Requests: {requests.length}
      </p>

      {loading && <p>Loading...</p>}

      {/* =========================
         PENDING
      ========================= */}
      <h2 className="text-yellow-600 font-semibold mb-3">
        🟡 Pending Requests ({pending.length})
      </h2>

      {pending.length === 0 && <p>No pending requests</p>}

      {pending.map((r) => (
        <div key={r.id} className="bg-white p-4 mb-3 rounded shadow">
          <p><b>{r.product_name}</b></p>
          <p>User: {r.user_name}</p>
          <p>Qty: {r.quantity}</p>
          <p>Requested: ₦{Number(r.requested_price).toLocaleString()}</p>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => updateStatus(r.id, "approved")}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Approve
            </button>

            <button
              onClick={() => updateStatus(r.id, "rejected")}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* =========================
         APPROVED
      ========================= */}
      <h2 className="text-green-600 font-semibold mt-6 mb-3">
        🟢 Approved Deals ({approved.length})
      </h2>

      {approved.length === 0 && <p>No approved deals</p>}

      {approved.map((r) => (
        <div key={r.id} className="bg-white p-4 mb-3 rounded shadow">
          <p><b>{r.product_name}</b></p>
          <p>User: {r.user_name}</p>
          <p>Qty: {r.quantity}</p>
          <p>Approved: ₦{Number(r.approved_price || 0).toLocaleString()}</p>

          <p className="text-sm text-gray-500 mt-1">
            Waiting for user to accept deal
          </p>
        </div>
      ))}

      {/* =========================
         ACCEPTED (ORDERS)
      ========================= */}
      <h2 className="text-blue-600 font-semibold mt-6 mb-3">
        🔵 Bulk Orders ({accepted.length})
      </h2>

      {accepted.length === 0 && <p>No bulk orders yet</p>}

      {accepted.map((r) => (
        <div key={r.id} className="bg-white p-4 mb-3 rounded shadow">
          <p><b>{r.product_name}</b></p>
          <p>User: {r.user_name}</p>
          <p>Qty: {r.quantity}</p>
          <p>Price: ₦{Number(r.approved_price || 0).toLocaleString()}</p>

          <p className="text-green-700 font-semibold">
            ✔ Converted to Order
          </p>
        </div>
      ))}
    </div>
  );
}
