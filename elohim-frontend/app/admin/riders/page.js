"use client";

import { useEffect, useState } from "react";
import API from "../../../lib/api";
import toast from "react-hot-toast";

export default function RidersPage() {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchRiders();
  }, []);

  /* ========================= FETCH ========================= */
  const fetchRiders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/riders");
      setRiders(Array.isArray(res.data) ? res.data : []);
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
        });

        toast.success("Rider updated ✏️");
      } else {
        // CREATE
        await API.post("/riders", {
          name: form.name,
          phone: form.phone,
        });

        toast.success("Rider added 🚀");
      }

      setForm({ name: "", phone: "" });
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
    setForm({ name: "", phone: "" });
  };

  const getOrderCount = (value) => Number(value || 0);

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Riders Management 🛵
      </h1>

      {/* ========================= FORM ========================= */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 rounded shadow mb-6"
      >
        <h2 className="font-semibold mb-3">
          {editingId ? "Edit Rider" : "Add Rider"}
        </h2>

        <div className="flex gap-3">
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
      </form>

      {/* ========================= LIST ========================= */}
      {loading && <p>Loading riders...</p>}

      <div className="grid gap-4">
        {riders.map((r) => (
          <div
            key={r.id}
            className="bg-white p-4 rounded shadow"
          >
            <div className="flex justify-between items-start gap-4">

              {/* LEFT */}
              <div>
                <h2 className="font-bold text-lg">{r.name}</h2>
                <p className="text-sm text-gray-600">{r.phone}</p>

                <span
                  className={`text-xs px-2 py-1 rounded ${
                    r.status === "available"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2">
                <button
                  onClick={() => editRider(r)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteRider(r.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* ================= PERFORMANCE ================= */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-100 p-2 rounded">
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-bold">{getOrderCount(r.total_orders)}</p>
              </div>

              <div className="bg-green-100 p-2 rounded">
                <p className="text-xs text-green-600">Delivered</p>
                <p className="font-bold text-green-700">
                  {getOrderCount(r.delivered_orders)}
                </p>
              </div>

              <div className="bg-yellow-100 p-2 rounded">
                <p className="text-xs text-yellow-600">Pending</p>
                <p className="font-bold text-yellow-700">
                  {getOrderCount(r.pending_orders)}
                </p>
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
                        ? (getOrderCount(r.delivered_orders) / getOrderCount(r.total_orders)) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>

              <p className="text-xs mt-1">
                {getOrderCount(r.total_orders)
                  ? Math.round(
                      (getOrderCount(r.delivered_orders) / getOrderCount(r.total_orders)) * 100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
