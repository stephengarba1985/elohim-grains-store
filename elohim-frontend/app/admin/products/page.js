"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const defaultForm = {
  name: "",
  price: "",
  stock_quantity: "",
  weight: "",
  image_url: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const getBackendRootUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return apiUrl.replace(/\/api\/?$/, "");
  };

  const normalizeImagePath = (imageUrl) => {
    if (!imageUrl) return "/grains/rice.jpg";

    const normalizedUrl = String(imageUrl).replace(/\\/g, "/");

    if (normalizedUrl.startsWith("http")) return normalizedUrl;
    if (normalizedUrl.startsWith("/uploads/")) return `${getBackendRootUrl()}${normalizedUrl}`;
    if (normalizedUrl.startsWith("uploads/")) return `${getBackendRootUrl()}/${normalizedUrl}`;
    if (normalizedUrl.startsWith("/grains/")) return normalizedUrl;
    if (normalizedUrl.startsWith("/")) return normalizedUrl;

    return `/grains/${normalizedUrl.replace(/^grains\//i, "")}`;
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: form.name,
      price: Number(form.price || 0),
      stock_quantity: Number(form.stock_quantity || 0),
      weight: form.weight || "",
      image_url: form.image_url || "",
    };

    if (!payload.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await API.put(`/products/${editingId}`, payload);
        toast.success("Product updated");
      } else {
        await API.post("/products", payload);
        toast.success("Product added");
      }

      resetForm();
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Product save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      price: product.price ?? "",
      stock_quantity: product.stock_quantity ?? "",
      weight: product.weight || "",
      image_url: product.image_url || product.image || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;

    try {
      await API.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage catalog products and product families.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700"
        >
          + Add Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? "Edit Product" : "Add Product"}</h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Product name"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Price"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="number"
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              placeholder="Stock quantity"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="Weight"
              className="border rounded-lg px-3 py-2"
            />
            <div className="md:col-span-2">
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="Image URL or uploaded path"
                className="border rounded-lg px-3 py-2 w-full"
              />
            </div>
          </div>

          {form.image_url && (
            <img
              src={normalizeImagePath(form.image_url)}
              alt="Preview"
              className="h-28 w-28 object-cover rounded border"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/grains/rice.jpg";
              }}
            />
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? "Saving..." : editingId ? "Update Product" : "Save Product"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-200 px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Number of Types</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t">
                <td className="px-4 py-3">
                  {product.image || product.image_url ? (
                    <img
                      src={normalizeImagePath(product.image || product.image_url)}
                      alt={product.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/grains/rice.jpg";
                      }}
                      className="h-12 w-12 object-cover rounded"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">IMG</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{product.name}</div>
                </td>
                <td className="px-4 py-3">{product.category || "Uncategorized"}</td>
                <td className="px-4 py-3">{product.types?.length || 0}</td>
                <td className="px-4 py-3">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Active</span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
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
