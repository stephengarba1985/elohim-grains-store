"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [variantForm, setVariantForm] = useState({});

  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    weight: "",
    image_url: "",
  });

  const [newProduct, setNewProduct] = useState({
    name: "",
    image_url: "",
    variants: []
  });

  /* ========================= AUTH ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login");
      return router.push("/login");
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (!parsedUser.is_admin) {
      toast.error("Access denied");
      return router.push("/");
    }

    fetchProducts();
  }, []);

  /* ========================= FETCH ========================= */
  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      const products = res.data;
      setProducts(products);
      setFiltered(products);
    } catch (err) {
      console.error("Fetch products error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to load products");
    }
  };

  /* ========================= SEARCH ========================= */
  useEffect(() => {
    const result = products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, products]);

  /* ========================= UPDATE ========================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingId) return;

    try {
      setLoading(true);

      await API.put(`/products/${editingId}`, {
        name: form.name,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        weight: form.weight || "",
        image_url: form.image_url || "",
      });

      toast.success("Product updated");
      setEditingId(null);
      setShowEditModal(false);
      fetchProducts();

    } catch (err) {
      console.error("Update error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      price: Number(product.price) || 0,
      stock_quantity: Number(product.stock_quantity) || 0,
      weight: product.weight || "",
      image_url: product.image_url || "",
    });
    setShowEditModal(true);
  };

  const formatPrice = (price) =>
    `₦${Number(price || 0).toLocaleString()}`;

  const normalizeImagePath = (imageUrl) => {
    if (!imageUrl) return "";
    if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;

    const cleaned = imageUrl.replace(/^grains[\\/]/i, "");
    const hasExtension = /\.[a-z0-9]+$/i.test(cleaned);

    return `/grains/${hasExtension ? cleaned : `${cleaned}.jpg`}`;
  };

  const getTotalStock = (product) => {
    const variantStock = (product.variants || []).reduce(
      (sum, variant) => sum + Number(variant.stock || 0),
      0
    );

    return Math.max(Number(product.stock_quantity || 0), variantStock);
  };

  /* ========================= STOCK UPDATE ========================= */
  const updateStock = async (product, value) => {
    try {
      const val = Number(value);

      if (!val || val <= 0) {
        return toast.error("Enter valid stock");
      }

      const newStock = Number(product.stock_quantity) + val;

      await API.put(`/products/${product.id}`, {
        name: product.name,
        price: Number(product.price),
        stock_quantity: newStock,
        weight: product.weight || "",
        image_url: product.image_url || "",
      });

      toast.success("Stock updated");
      fetchProducts();

    } catch (err) {
      console.error("Stock error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Stock update failed");
    }
  };

  /* ========================= VARIANT STOCK UPDATE ========================= */
  const updateVariantStock = async (productId, variant, value) => {
    try {
      const val = Number(value);

      if (!val || val <= 0) {
        return toast.error("Enter valid stock");
      }

      const newStock = Number(variant.stock) + val;

      await API.put(`/products/variants/${variant.id}`, {
        weight: variant.weight,
        price: Number(variant.price),
        stock: newStock,
      });

      toast.success("Variant stock updated");
      fetchProducts();

    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Failed to update variant stock");
    }
  };

  /* ========================= HISTORY ========================= */
  const openHistory = async (product) => {
    try {
      setHistoryLoading(true);
      setShowModal(true);
      setSelectedProduct(product);

      const res = await API.get(`/products/history/${product.id}`);
      setHistory(res.data);

    } catch (err) {
      console.error("History error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ========================= VARIANTS ========================= */
  const addVariant = async (productId) => {
    try {
      const form = variantForm[productId];

      if (!form?.weight || !form?.price || !form?.stock) {
        return toast.error("Fill all variant fields");
      }

      await API.post(`/products/${productId}/variants`, {
        weight: form.weight,
        price: Number(form.price),
        stock: Number(form.stock),
      });

      toast.success("Variant added");
      setVariantForm({ ...variantForm, [productId]: {} });
      fetchProducts();

    } catch (err) {
      console.error("Variant error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to add variant");
    }
  };

  const deleteVariant = async (productId, variantId) => {
    try {
      await API.delete(`/products/${productId}/variants/${variantId}`);
      toast.success("Variant deleted");
      fetchProducts();
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error("Failed to delete variant");
    }
  };

  /* ========================= ADD PRODUCT ========================= */
  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (!newProduct.name || !newProduct.image_url) {
      return toast.error("Name and image are required");
    }

    try {
      setLoading(true);

      await API.post("/products", {
        name: newProduct.name,
        image_url: newProduct.image_url,
        price: 0,
        stock_quantity: 0,
      });

      toast.success("Product added");
      setNewProduct({ name: "", image_url: "", variants: [] });
      fetchProducts();

    } catch (err) {
      console.error("Add product error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📦 Inventory Management</h1>

      {/* ADD NEW PRODUCT */}
      <form onSubmit={handleAddProduct} className="bg-white p-4 rounded shadow mb-6">
        <h2 className="font-semibold mb-3">Add New Product</h2>
        <div className="flex gap-3">
          <input
            placeholder="Product name"
            className="border p-2 rounded flex-1"
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
          />
          <input
            placeholder="Image URL"
            className="border p-2 rounded flex-1"
            value={newProduct.image_url}
            onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Add Product
          </button>
        </div>
      </form>

      {/* SEARCH */}
      <input
        placeholder="Search products..."
        className="border p-2 w-full mb-4 rounded"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* PRODUCT LIST */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition duration-300 overflow-hidden"
          >

            {/* IMAGE */}
            <div className="w-full h-48 overflow-hidden bg-gray-100">
              <img
                src={
                  product.image_url
                    ? normalizeImagePath(product.image_url)
                    : "/placeholder.jpg"
                }
                alt={product.name}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "/placeholder.jpg";
                }}
                className="w-full h-full object-cover hover:scale-105 transition duration-300"
              />
            </div>

            {/* CONTENT */}
            <div className="p-4">

              {/* PRODUCT NAME */}
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                {product.name}
              </h3>

              {/* PRICE */}
              <p className="text-green-600 font-bold text-lg">
                ₦{Number(product.price || 0).toLocaleString()}
              </p>

              {/* STOCK STATUS */}
              <p
                className={`text-xs mt-1 ${
                  getTotalStock(product) > 10
                    ? "text-green-600"
                    : getTotalStock(product) > 0
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {getTotalStock(product) > 10
                  ? "In Stock"
                  : getTotalStock(product) > 0
                  ? "Low Stock"
                  : "Out of Stock"}
              </p>

              <p className="text-xs text-gray-500">
                Total Stock: {getTotalStock(product)}
              </p>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => editProduct(product)}
                  className="flex-1 bg-yellow-500 text-white py-1 rounded text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={() => openHistory(product)}
                  className="flex-1 bg-gray-500 text-white py-1 rounded text-sm"
                >
                  History
                </button>
              </div>

              {/* VARIANTS TABLE */}
              <div className="mt-4 border-t pt-3">
                <p className="text-sm font-semibold mb-2">Variants</p>

                {/* TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border text-left">Weight</th>
                        <th className="p-2 border text-left">Price</th>
                        <th className="p-2 border text-left">Stock</th>
                        <th className="p-2 border text-center">Action</th>
                      </tr>
                    </thead>

                    <tbody>

                      {/* EXISTING VARIANTS */}
                      {Array.isArray(product.variants) && product.variants.length > 0 ? (
                        product.variants.map((v) => (
                          <tr key={v.id}>
                            <td className="p-2 border">{v.weight}</td>

                            <td className="p-2 border">
                              {formatPrice(v.price)}
                            </td>

                            <td className="p-2 border">
                              <div className="flex items-center gap-2">

                                {/* CURRENT STOCK */}
                                <span>{v.stock}</span>

                                {/* ADD STOCK INPUT */}
                                <input
                                  type="number"
                                  placeholder="+"
                                  className="w-12 border p-1 rounded text-xs"
                                  id={`variant-${v.id}`}
                                />

                                {/* ADD BUTTON */}
                                <button
                                  onClick={() => {
                                    const input = document.getElementById(`variant-${v.id}`);
                                    const val = input.value;
                                    updateVariantStock(product.id, v, val);
                                    input.value = '';
                                  }}
                                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                                >
                                  +
                                </button>

                              </div>
                            </td>

                            <td className="p-2 border text-center">
                              <button
                                onClick={() => deleteVariant(product.id, v.id)}
                                className="text-red-500 font-bold"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center p-2 text-gray-400">
                            No variants yet
                          </td>
                        </tr>
                      )}

                      {/* ADD NEW VARIANT ROW */}
                      <tr className="bg-green-50">
                        <td className="p-1 border">
                          <input
                            placeholder="Weight"
                            className="w-full p-1 border rounded text-sm"
                            value={variantForm[product.id]?.weight || ""}
                            onChange={(e) =>
                              setVariantForm({
                                ...variantForm,
                                [product.id]: {
                                  ...variantForm[product.id],
                                  weight: e.target.value,
                                },
                              })
                            }
                          />
                        </td>

                        <td className="p-1 border">
                          <input
                            type="number"
                            placeholder="Price"
                            className="w-full p-1 border rounded text-sm"
                            value={variantForm[product.id]?.price || ""}
                            onChange={(e) =>
                              setVariantForm({
                                ...variantForm,
                                [product.id]: {
                                  ...variantForm[product.id],
                                  price: e.target.value,
                                },
                              })
                            }
                          />
                        </td>

                        <td className="p-1 border">
                          <input
                            type="number"
                            placeholder="Stock"
                            className="w-full p-1 border rounded text-sm"
                            value={variantForm[product.id]?.stock || ""}
                            onChange={(e) =>
                              setVariantForm({
                                ...variantForm,
                                [product.id]: {
                                  ...variantForm[product.id],
                                  stock: e.target.value,
                                },
                              })
                            }
                          />
                        </td>

                        <td className="p-1 border text-center">
                          <button
                            onClick={() => addVariant(product.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div> 

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Product</h2>
            <form onSubmit={handleSubmit}>
              <input
                placeholder="Name"
                className="border p-2 w-full mb-2 rounded"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="number"
                placeholder="Price"
                className="border p-2 w-full mb-2 rounded"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <input
                type="number"
                placeholder="Stock"
                className="border p-2 w-full mb-2 rounded"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              />
              <input
                placeholder="Weight"
                className="border p-2 w-full mb-2 rounded"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
              <input
                placeholder="Image URL"
                className="border p-2 w-full mb-4 rounded"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Stock History - {selectedProduct?.name}
            </h2>
            {historyLoading ? (
              <p>Loading...</p>
            ) : history.length === 0 ? (
              <p>No history</p>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="border-b py-2">
                    <p className="text-sm">
                      {h.change > 0 ? "+" : ""}{h.change} units
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(h.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 bg-gray-500 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
