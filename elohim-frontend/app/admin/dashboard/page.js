"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { toast } from "react-hot-toast";

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [bulkRequests, setBulkRequests] = useState([]);

  /* =========================
     FETCH BULK REQUESTS
  ========================= */
  const fetchBulkRequests = async () => {
    try {
      const res = await API.get("/bulk");

      console.log("📦 ADMIN BULK:", res.data);

      setBulkRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ BULK FETCH ERROR:", err);
      toast.error("Failed to load bulk requests");
    }
  };

  /* =========================
     APPROVE BULK
  ========================= */
  const approveBulk = async (id) => {
    try {
      const price = prompt("Enter approved price:");

      if (!price) return;

      await API.put(`/bulk/${id}`, {
        status: "approved",
        approved_price: price,
      });

      toast.success("Bulk approved 💰");

      fetchBulkRequests();
    } catch (err) {
      console.error("❌ APPROVE ERROR:", err);
      toast.error("Failed to approve");
    }
  };

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    API.get("/admin/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error("❌ STATS ERROR:", err));

    fetchBulkRequests();
  }, []);

  /* =========================
     UI
  ========================= */
  return (
    <div className="p-6">

      {/* =========================
         STATS
      ========================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

        <div className="bg-white p-4 rounded shadow">
          <p>Total Revenue</p>
          <h2>₦{Number(stats.revenue || 0).toLocaleString()}</h2>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p>Orders</p>
          <h2>{stats.orders || 0}</h2>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p>Subscriptions</p>
          <h2>{stats.subscriptions || 0}</h2>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p>Users</p>
          <h2>{stats.users || 0}</h2>
        </div>

      </div>

      {/* =========================
         BULK REQUESTS
      ========================= */}
      <h2 className="text-xl font-bold mt-6 mb-3">
        Bulk Requests 💰
      </h2>

      {bulkRequests.length === 0 && (
        <p>No bulk requests</p>
      )}

      {bulkRequests.map((b) => (
        <div key={b.id} className="bg-white p-4 rounded shadow mb-3">

          <h3 className="font-bold">{b.product_name}</h3>

          <p>User: {b.user_name}</p>

          <p>Quantity: {b.quantity}</p>

          <p>
            Requested: ₦{Number(b.requested_price || 0).toLocaleString()}
          </p>

          <p>Status: {b.status}</p>

          {b.status === "pending" && (
            <button
              onClick={() => approveBulk(b.id)}
              className="bg-green-600 text-white px-3 py-1 rounded mt-2"
            >
              Approve
            </button>
          )}

        </div>
      ))}

    </div>
  );
}