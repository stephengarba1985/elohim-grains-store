"use client";

import { useEffect, useState } from "react";
import API from "../../../lib/api";
import toast from "react-hot-toast";

const DELIVERY_FEE = 2500;

export default function RidersPage() {
  const [riders, setRiders] = useState([]);
  const [riderStats, setRiderStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedRider, setSelectedRider] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle_type: "",
    plate_number: "",
    license_number: "",
    avatar: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
    status: "available",
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchRiders();
  }, []);

  /* ========================= FETCH ========================= */
  const fetchRiders = async () => {
    try {
      setLoading(true);
      const [ridersRes, statsRes] = await Promise.all([
        API.get("/riders"),
        API.get("/riders/stats/summary").catch(() => null),
      ]);

      const ridersData = Array.isArray(ridersRes.data) ? ridersRes.data : [];
      setRiders(ridersData);
      setRiderStats(statsRes?.data || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load riders");
    } finally {
      setLoading(false);
    }
  };

  /* ========================= ADD / UPDATE ========================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.phone) {
      return toast.error("Name and phone required");
    }

    try {
      if (editingId) {
        // UPDATE
        await API.put(`/riders/${editingId}`, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          vehicle_type: form.vehicle_type,
          plate_number: form.plate_number,
          license_number: form.license_number,
          avatar: form.avatar,
          address: form.address,
          emergency_contact: form.emergency_contact,
          emergency_phone: form.emergency_phone,
          status: form.status || "available",
        });

        toast.success("Rider updated ✏️");
      } else {
        // CREATE
        await API.post("/riders", {
          name: form.name,
          phone: form.phone,
          email: form.email,
          vehicle_type: form.vehicle_type,
          plate_number: form.plate_number,
          license_number: form.license_number,
          avatar: form.avatar,
          address: form.address,
          emergency_contact: form.emergency_contact,
          emergency_phone: form.emergency_phone,
        });

        toast.success("Rider added 🚀");
      }

      setForm({
        name: "",
        phone: "",
        email: "",
        vehicle_type: "",
        plate_number: "",
        license_number: "",
        avatar: "",
        address: "",
        emergency_contact: "",
        emergency_phone: "",
        status: "available",
      });
      setEditingId(null);
      fetchRiders();

    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Operation failed");
    }
  };

  /* ========================= EDIT ========================= */
  const editRider = (rider) => {
    setEditingId(rider.id);
    setForm({
      name: rider.name || "",
      phone: rider.phone || "",
      email: rider.email || "",
      vehicle_type: rider.vehicle_type || "",
      plate_number: rider.plate_number || "",
      license_number: rider.license_number || "",
      avatar: rider.avatar || "",
      address: rider.address || "",
      emergency_contact: rider.emergency_contact || "",
      emergency_phone: rider.emergency_phone || "",
      status: rider.status || "available",
    });
  };

  /* ========================= DELETE ========================= */
  const deleteRider = async (id) => {
    if (!confirm("Delete this rider?")) return;

    try {
      await API.delete(`/riders/${id}`);
      toast.success("Rider removed ❌");
      fetchRiders();
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Failed to delete rider");
    }
  };

  /* ========================= CANCEL EDIT ========================= */
  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      vehicle_type: "",
      plate_number: "",
      license_number: "",
      avatar: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      status: "available",
    });
  };

  const getOrderCount = (value) => Number(value || 0);
  const getCompleted = (rider) => Number(rider.completed_deliveries || rider.delivered_orders || 0);
  const getCancelled = (rider) => Number(rider.cancelled_deliveries || 0);
  const getRating = (rider) => Number(rider.rating || 5);
  const getEarnings = (rider) => {
    const fromRevenue = Number(rider.revenue_generated || 0);
    if (fromRevenue > 0) return fromRevenue;

    const raw = Number(rider.earnings || 0);
    if (raw > 0) return raw;
    return getCompleted(rider) * DELIVERY_FEE;
  };

  const getNormalizedStatus = (rider) => {
    const status = String(rider.status || "").toLowerCase();

    if (status === "offline" || rider.online === false) return "offline";
    if (["assigned", "picking_up", "in_transit", "near_customer", "busy"].includes(status)) {
      return status;
    }

    return "available";
  };

  const isBusy = (status) => ["assigned", "picking_up", "in_transit", "near_customer", "busy"].includes(status);

  const getStatusView = (rider) => {
    const status = getNormalizedStatus(rider);

    if (status === "available") {
      return {
        label: "🟢 Available",
        className: "bg-green-100 text-green-700",
      };
    }

    if (status === "assigned") {
      return {
        label: "🟡 Assigned",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    if (status === "picking_up") {
      return {
        label: "🟠 Picking Up",
        className: "bg-orange-100 text-orange-700",
      };
    }

    if (status === "in_transit" || status === "busy") {
      return {
        label: "🔵 In Transit",
        className: "bg-blue-100 text-blue-700",
      };
    }

    if (status === "near_customer") {
      return {
        label: "🟣 Near Customer",
        className: "bg-purple-100 text-purple-700",
      };
    }

    return {
      label: "⚫ Offline",
      className: "bg-gray-200 text-gray-700",
    };
  };

  const formatMoney = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

  const formatLastSeen = (value) => {
    if (!value) return "Not available";

    const last = new Date(value);
    if (Number.isNaN(last.getTime())) return "Not available";

    const diffMinutes = Math.max(0, Math.floor((Date.now() - last.getTime()) / 60000));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} minute(s) ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day(s) ago`;
  };

  const filteredRiders = riders.filter((rider) => {
    const keyword = search.toLowerCase();
    const status = getNormalizedStatus(rider);

    const matchesSearch =
      String(rider.name || "").toLowerCase().includes(keyword) ||
      String(rider.phone || "").toLowerCase().includes(keyword) ||
      String(rider.plate_number || "").toLowerCase().includes(keyword);

    let matchesStatus = true;

    if (statusFilter === "available") {
      matchesStatus = status === "available";
    } else if (statusFilter === "busy") {
      matchesStatus = isBusy(status);
    } else if (statusFilter === "offline") {
      matchesStatus = status === "offline";
    }

    return matchesSearch && matchesStatus;
  });

  const derivedSummary = {
    totalRiders: riders.length,
    available: riders.filter((r) => getNormalizedStatus(r) === "available").length,
    busy: riders.filter((r) => isBusy(getNormalizedStatus(r))).length,
    offline: riders.filter((r) => getNormalizedStatus(r) === "offline").length,
    deliveriesToday: riders.reduce((sum, rider) => sum + Number(rider.deliveries_today || 0), 0),
    totalEarnings: riders.reduce((sum, rider) => sum + getEarnings(rider), 0),
  };

  const summary = {
    totalRiders: Number(riderStats?.total ?? derivedSummary.totalRiders),
    available: Number(riderStats?.available ?? derivedSummary.available),
    busy: Number(riderStats?.busy ?? derivedSummary.busy),
    offline: Math.max(
      0,
      Number(riderStats?.total ?? derivedSummary.totalRiders) -
        Number(riderStats?.available ?? derivedSummary.available) -
        Number(riderStats?.busy ?? derivedSummary.busy)
    ),
    deliveriesToday: derivedSummary.deliveriesToday,
    totalEarnings: Number(riderStats?.earnings ?? derivedSummary.totalEarnings),
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const ids = filteredRiders.map((r) => r.id);

    if (ids.length > 0 && ids.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) {
      return toast.error("Select at least one rider");
    }

    if (!confirm(`Delete ${selectedIds.length} rider(s)?`)) return;

    try {
      await Promise.all(selectedIds.map((id) => API.delete(`/riders/${id}`)));
      toast.success("Selected riders removed");
      setSelectedIds([]);
      fetchRiders();
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Bulk delete failed");
    }
  };

  const bulkSetStatus = async (mode) => {
    if (selectedIds.length === 0) {
      return toast.error("Select at least one rider");
    }

    const status = mode === "activate" ? "available" : "offline";
    const online = mode === "activate";

    try {
      await Promise.all(
        selectedIds.map((id) =>
          API.put(`/riders/${id}/status`, { status, online })
        )
      );

      toast.success(mode === "activate" ? "Riders activated" : "Riders suspended");
      fetchRiders();
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Bulk status update failed");
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Riders Management 🛵
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total Riders</p>
          <p className="text-2xl font-bold">{summary.totalRiders}</p>
        </div>
        <div className="bg-green-50 p-4 rounded shadow">
          <p className="text-xs text-green-700">Available</p>
          <p className="text-2xl font-bold text-green-700">{summary.available}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded shadow">
          <p className="text-xs text-blue-700">Busy</p>
          <p className="text-2xl font-bold text-blue-700">{summary.busy}</p>
        </div>
        <div className="bg-gray-100 p-4 rounded shadow">
          <p className="text-xs text-gray-700">Offline</p>
          <p className="text-2xl font-bold text-gray-700">{summary.offline}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded shadow">
          <p className="text-xs text-amber-700">Deliveries Today</p>
          <p className="text-2xl font-bold text-amber-700">{summary.deliveriesToday}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded shadow">
          <p className="text-xs text-emerald-700">Total Earnings</p>
          <p className="text-2xl font-bold text-emerald-700">{formatMoney(summary.totalEarnings)}</p>
        </div>
      </div>

      {/* ========================= FORM ========================= */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 rounded shadow mb-6"
      >
        <h2 className="font-semibold mb-3">
          {editingId ? "Edit Rider" : "Add Rider"}
        </h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            placeholder="Rider name"
            className="border p-2 rounded flex-1"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <input
            placeholder="Phone number"
            className="border p-2 rounded flex-1"
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value })
            }
          />

          <input
            placeholder="Email"
            type="email"
            className="border p-2 rounded flex-1"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            placeholder="Vehicle type"
            className="border p-2 rounded flex-1"
            value={form.vehicle_type}
            onChange={(e) =>
              setForm({ ...form, vehicle_type: e.target.value })
            }
          />

          <input
            placeholder="Plate number"
            className="border p-2 rounded flex-1"
            value={form.plate_number}
            onChange={(e) =>
              setForm({ ...form, plate_number: e.target.value })
            }
          />

          <input
            placeholder="Driver license"
            className="border p-2 rounded flex-1"
            value={form.license_number}
            onChange={(e) =>
              setForm({ ...form, license_number: e.target.value })
            }
          />

          <input
            placeholder="Address"
            className="border p-2 rounded flex-1"
            value={form.address}
            onChange={(e) =>
              setForm({ ...form, address: e.target.value })
            }
          />

          <input
            placeholder="Emergency contact"
            className="border p-2 rounded flex-1"
            value={form.emergency_contact}
            onChange={(e) =>
              setForm({ ...form, emergency_contact: e.target.value })
            }
          />

          <input
            placeholder="Emergency phone"
            className="border p-2 rounded flex-1"
            value={form.emergency_phone}
            onChange={(e) =>
              setForm({ ...form, emergency_phone: e.target.value })
            }
          />

          <input
            placeholder="Avatar URL (optional)"
            className="border p-2 rounded flex-1"
            value={form.avatar}
            onChange={(e) =>
              setForm({ ...form, avatar: e.target.value })
            }
          />

          {editingId && (
            <select
              className="border p-2 rounded"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
            </select>
          )}

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              {editingId ? "Update" : "Add"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ========================= LIST ========================= */}
      {loading && <p>Loading riders...</p>}

      <div className="bg-white p-4 rounded shadow mb-6 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            placeholder="Search Rider..."
            className="border p-2 rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border p-2 rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Riders</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>

          <button
            onClick={toggleSelectAll}
            className="bg-gray-800 text-white px-4 py-2 rounded"
          >
            Select Visible
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => bulkSetStatus("activate")}
            className="bg-green-600 text-white px-3 py-2 rounded text-sm"
          >
            Activate
          </button>

          <button
            onClick={() => bulkSetStatus("suspend")}
            className="bg-yellow-600 text-white px-3 py-2 rounded text-sm"
          >
            Suspend
          </button>

          <button
            onClick={bulkDelete}
            className="bg-red-600 text-white px-3 py-2 rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRiders.map((r) => (
          <div
            key={r.id}
            className="bg-white p-4 rounded shadow cursor-pointer"
            onClick={() => setSelectedRider(r)}
          >
            <div className="flex justify-between items-start gap-4">

              {/* LEFT */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-gray-500">Select</span>
                </div>
                <h2 className="font-bold text-lg">{r.name}</h2>
                <p className="text-sm text-gray-600">{r.phone}</p>
                {r.plate_number && (
                  <p className="text-xs text-gray-500">Plate: {r.plate_number}</p>
                )}

                <span
                  className={`text-xs px-2 py-1 rounded ${getStatusView(r).className}`}
                >
                  {getStatusView(r).label}
                </span>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editRider(r);
                  }}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRider(r.id);
                  }}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRider(r);
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  View
                </button>
              </div>
            </div>

            {/* ================= PERFORMANCE ================= */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
              <div className="bg-gray-100 p-2 rounded">
                <p className="text-xs text-gray-500">Deliveries</p>
                <p className="font-bold">{getOrderCount(r.total_orders)}</p>
              </div>

              <div className="bg-green-100 p-2 rounded">
                <p className="text-xs text-green-600">Completed</p>
                <p className="font-bold text-green-700">
                  {getCompleted(r)}
                </p>
              </div>

              <div className="bg-red-100 p-2 rounded">
                <p className="text-xs text-red-600">Cancelled</p>
                <p className="font-bold text-red-700">
                  {getCancelled(r)}
                </p>
              </div>

              <div className="bg-amber-100 p-2 rounded">
                <p className="text-xs text-amber-700">Rate</p>
                <p className="font-bold text-amber-700">{getRating(r).toFixed(1)}★</p>
              </div>

              <div className="bg-blue-100 p-2 rounded">
                <p className="text-xs text-blue-700">Completion</p>
                <p className="font-bold text-blue-700">
                  {getOrderCount(r.total_orders)
                    ? Math.round((getCompleted(r) / getOrderCount(r.total_orders)) * 100)
                    : 0}%
                </p>
              </div>

              <div className="bg-emerald-100 p-2 rounded">
                <p className="text-xs text-emerald-700">Revenue</p>
                <p className="font-bold text-emerald-700">{formatMoney(getEarnings(r))}</p>
              </div>
            </div>

            {/* COMPLETION RATE */}
            <div className="mt-2">
              <p className="text-xs text-gray-500">Completion Rate</p>

              <div className="w-full bg-gray-200 rounded h-2 mt-1">
                <div
                  className="bg-green-600 h-2 rounded"
                  style={{
                    width: `${
                      getOrderCount(r.total_orders)
                        ? (getCompleted(r) / getOrderCount(r.total_orders)) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>

              <p className="text-xs mt-1">
                {getOrderCount(r.total_orders)
                  ? Math.round(
                      (getCompleted(r) / getOrderCount(r.total_orders)) * 100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        ))}
      </div>

      {selectedRider && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedRider.name || "Rider"}</h2>
                <p className="text-amber-600">{"★".repeat(Math.round(getRating(selectedRider)))} ({getRating(selectedRider).toFixed(1)})</p>
              </div>
              <button
                onClick={() => setSelectedRider(null)}
                className="bg-gray-700 text-white px-3 py-2 rounded"
              >
                Close
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1">
                <p><b>Phone:</b> {selectedRider.phone || "-"}</p>
                <p><b>Email:</b> {selectedRider.email || "-"}</p>
                <p><b>Vehicle:</b> {selectedRider.vehicle_type || "-"}</p>
                <p><b>Plate:</b> {selectedRider.plate_number || "-"}</p>
                <p><b>License:</b> {selectedRider.license_number || "-"}</p>
                <p><b>Status:</b> {getStatusView(selectedRider).label}</p>
              </div>

              <div className="space-y-1">
                <p><b>Completed:</b> {getCompleted(selectedRider)}</p>
                <p><b>Cancelled:</b> {getCancelled(selectedRider)}</p>
                <p><b>Rating:</b> {getRating(selectedRider).toFixed(1)}★</p>
                <p><b>Orders:</b> {getOrderCount(selectedRider.total_orders)}</p>
                <p><b>Assigned Orders:</b> {getOrderCount(selectedRider.pending_orders)}</p>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 rounded p-4">
              <h3 className="font-semibold mb-2">Current Location</h3>
              <p><b>Lat:</b> {selectedRider.current_location?.latitude ?? "-"}</p>
              <p><b>Lng:</b> {selectedRider.current_location?.longitude ?? "-"}</p>
              <p><b>Last Seen:</b> {formatLastSeen(selectedRider.current_location?.updated_at || selectedRider.current_location?.timestamp)}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
              <div className="bg-gray-100 rounded p-2">
                <p className="text-xs text-gray-500">Deliveries</p>
                <p className="font-bold">{getOrderCount(selectedRider.total_orders)}</p>
              </div>
              <div className="bg-green-100 rounded p-2">
                <p className="text-xs text-green-700">Completed</p>
                <p className="font-bold text-green-700">{getCompleted(selectedRider)}</p>
              </div>
              <div className="bg-red-100 rounded p-2">
                <p className="text-xs text-red-700">Cancelled</p>
                <p className="font-bold text-red-700">{getCancelled(selectedRider)}</p>
              </div>
              <div className="bg-blue-100 rounded p-2">
                <p className="text-xs text-blue-700">Completion Rate</p>
                <p className="font-bold text-blue-700">
                  {getOrderCount(selectedRider.total_orders)
                    ? Math.round((getCompleted(selectedRider) / getOrderCount(selectedRider.total_orders)) * 100)
                    : 0}%
                </p>
              </div>
              <div className="bg-amber-100 rounded p-2">
                <p className="text-xs text-amber-700">Rating</p>
                <p className="font-bold text-amber-700">{getRating(selectedRider).toFixed(1)}★</p>
              </div>
              <div className="bg-emerald-100 rounded p-2">
                <p className="text-xs text-emerald-700">Revenue</p>
                <p className="font-bold text-emerald-700">{formatMoney(getEarnings(selectedRider))}</p>
              </div>
            </div>

            <div className="mt-6 bg-emerald-50 rounded p-4">
              <h3 className="font-semibold mb-2">Earnings</h3>
              <p><b>Delivery Fee:</b> {formatMoney(DELIVERY_FEE)}</p>
              <p><b>Completed:</b> {getCompleted(selectedRider)}</p>
              <p><b>Total Earnings:</b> {formatMoney(getEarnings(selectedRider))}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
