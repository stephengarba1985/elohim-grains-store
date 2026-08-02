"use client";

import { useEffect, useState } from "react";
import API from "../../../lib/api";
import toast from "react-hot-toast";

const DELIVERY_FEE = 2500;

export default function RidersPage() {
  const [riders, setRiders] = useState([]);
  const [filteredRiders, setFilteredRiders] = useState([]);
  const [stats, setStats] = useState({});
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
    fetchStats();
  }, []);

  useEffect(() => {
    let list = [...riders];

    if (search) {
      list = list.filter((r) =>
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.phone?.includes(search) ||
        r.plate_number?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    setFilteredRiders(list);
  }, [search, statusFilter, riders]);

  /* ========================= FETCH ========================= */
  const fetchRiders = async () => {
    try {
      setLoading(true);
      const ridersRes = await API.get("/riders");
      const ridersData = Array.isArray(ridersRes.data) ? ridersRes.data : [];
      setRiders(ridersData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load riders");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/riders/stats/summary");
      setStats(res.data || {});
    } catch (err) {
      console.error(err);
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
      fetchStats();

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
      fetchStats();
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

  const derivedStats = {
    total: riders.length,
    available: riders.filter((r) => r.status === "available").length,
    busy: riders.filter((r) => r.status === "busy").length,
    online: riders.filter((r) => r.online === true).length,
    earnings: riders.reduce((sum, rider) => sum + getEarnings(rider), 0),
  };

  const effectiveStats = {
    total: Number(stats?.total ?? derivedStats.total),
    available: Number(stats?.available ?? derivedStats.available),
    busy: Number(stats?.busy ?? derivedStats.busy),
    online: Number(stats?.online ?? derivedStats.online),
    earnings: Number(stats?.earnings ?? derivedStats.earnings),
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
      fetchStats();
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

      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Riders</p>
          <p className="text-3xl font-bold">{effectiveStats.total}</p>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-xs text-green-700">Available</p>
          <p className="text-3xl font-bold text-green-700">{effectiveStats.available}</p>
        </div>

        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <p className="text-xs text-yellow-700">Busy</p>
          <p className="text-3xl font-bold text-yellow-700">{effectiveStats.busy}</p>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-xs text-blue-700">Online</p>
          <p className="text-3xl font-bold text-blue-700">{effectiveStats.online}</p>
        </div>

        <div className="bg-purple-50 rounded-lg shadow p-4">
          <p className="text-sm text-purple-700">Rider Earnings</p>
          <p className="text-2xl font-bold">₦{Number(effectiveStats.earnings || 0).toLocaleString()}</p>
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

      <div className="flex gap-3 mb-5">
        <input
          className="border rounded-lg p-3 flex-1"
          placeholder="Search rider..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-lg p-3"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="bg-gray-800 text-white px-4 py-2 rounded"
          >
            Select Visible
          </button>

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

          <span className="text-xs text-gray-500 ml-auto">
            Showing {filteredRiders.length} of {riders.length} riders
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        {!loading && filteredRiders.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-600">
            No riders match your current search/filter.
          </div>
        )}

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
                <p className="text-xs text-gray-500">Email: {r.email || "-"}</p>
                <p className="text-xs text-gray-500">Vehicle: {r.vehicle_type || "-"}</p>
                {r.plate_number && (
                  <p className="text-xs text-gray-500">Plate: {r.plate_number}</p>
                )}
                <p className="text-xs text-gray-500">Rating ⭐ {Number(r.rating || 0).toFixed(1)}</p>
                <p className="text-xs text-emerald-700 font-medium">
                  Revenue Generated ₦{Number(r.revenue_generated || 0).toLocaleString()}
                </p>

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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{selectedRider.name}</h2>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <p><b>Phone:</b> {selectedRider.phone}</p>
              <p><b>Email:</b> {selectedRider.email}</p>
              <p><b>Vehicle:</b> {selectedRider.vehicle_type}</p>
              <p><b>Plate:</b> {selectedRider.plate_number}</p>
              <p><b>License:</b> {selectedRider.license_number}</p>
              <p><b>Status:</b> {selectedRider.status}</p>
              <p><b>Rating:</b> ⭐ {Number(selectedRider.rating || 0).toFixed(1)}</p>
              <p><b>Earnings:</b> ₦{Number(selectedRider.earnings || 0).toLocaleString()}</p>
              <p><b>Completed:</b> {selectedRider.completed_deliveries || 0}</p>
              <p><b>Cancelled:</b> {selectedRider.cancelled_deliveries || 0}</p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRider(null)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
