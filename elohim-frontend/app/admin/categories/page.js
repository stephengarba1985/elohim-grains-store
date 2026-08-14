"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", image: "", status: true });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await API.get("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load categories");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = String(form.name ?? "").trim();
    if (!trimmedName) {
      toast.error("Category name is required");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...form,
        name: trimmedName,
        description: String(form.description ?? "").trim(),
        image: String(form.image ?? "").trim(),
        status: form.status === undefined ? true : form.status,
      };

      if (editingId) {
        await API.put(`/categories/${editingId}`, payload);
        toast.success("Category updated");
      } else {
        await API.post("/categories", payload);
        toast.success("Category added");
      }

      setForm({ name: "", description: "", image: "", status: true });
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Category save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this category?")) return;

    try {
      await API.delete(`/categories/${id}`);
      toast.success("Category deleted");
      fetchCategories();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">Manage grains, flour, spices, and more.</p>
        </div>
        <button
          onClick={() => setEditingId(null)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700"
        >
          + Add Category
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Category name"
            className="border rounded px-3 py-2"
          />
          <input
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            placeholder="Image URL"
            className="border rounded px-3 py-2"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {loading ? "Saving..." : editingId ? "Update Category" : "Save Category"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", description: "", image: "", status: true });
              }}
              className="bg-gray-300 px-4 py-2 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-t">
                <td className="px-4 py-3">
                  {category.image ? (
                    <img src={category.image} alt={category.name} className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">IMG</div>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">{category.name}</td>
                <td className="px-4 py-3">0</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${category.status === false ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {category.status === false ? "Inactive" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => {
                      setEditingId(category.id);
                      setForm({
                        name: category.name || "",
                        description: category.description || "",
                        image: category.image || "",
                        status: category.status ?? true,
                      });
                    }}
                    className="bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
