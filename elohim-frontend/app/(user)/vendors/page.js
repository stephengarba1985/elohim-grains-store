"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const normalizeImagePath = (imageUrl) => {
  if (!imageUrl) return "/grains/Rice.jpg";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  return `/grains/${imageUrl}`;
};

export default function VendorMarketplacePage() {
  const [user, setUser] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [myVendor, setMyVendor] = useState(null);
  const [myProducts, setMyProducts] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    business_name: "",
    phone: "",
    location: "",
    description: "",
  });
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    weight: "",
    image_url: "",
  });
  const [orderForm, setOrderForm] = useState({
    vendor_product_id: "",
    quantity: 1,
    delivery_address: "",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error(err);
      }
    }

    fetchMarketplace();
    fetchMyVendor();
  }, []);

  const verifiedVendors = useMemo(
    () => vendors.filter((vendor) => vendor.verification_status === "verified"),
    [vendors]
  );

  const fetchMarketplace = async () => {
    try {
      setLoading(true);
      const res = await API.get("/vendors");
      setVendors(Array.isArray(res.data?.vendors) ? res.data.vendors : []);
      setProducts(Array.isArray(res.data?.products) ? res.data.products : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load vendor marketplace");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyVendor = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await API.get("/vendors/me");
      setMyVendor(res.data?.vendor || null);
      setMyProducts(Array.isArray(res.data?.products) ? res.data.products : []);
      setMyOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
    } catch (err) {
      console.error(err);
    }
  };

  const registerVendor = async (event) => {
    event.preventDefault();

    if (!user) {
      return toast.error("Please login to register as a vendor");
    }

    try {
      await API.post("/vendors/register", vendorForm);
      toast.success("Vendor profile submitted for verification");
      setVendorForm({ business_name: "", phone: "", location: "", description: "" });
      fetchMyVendor();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Vendor registration failed");
    }
  };

  const createVendorProduct = async (event) => {
    event.preventDefault();

    try {
      await API.post("/vendors/products", productForm);
      toast.success("Vendor product added");
      setProductForm({ name: "", price: "", stock_quantity: "", weight: "", image_url: "" });
      fetchMyVendor();
      fetchMarketplace();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Product creation failed");
    }
  };

  const createVendorOrder = async (event) => {
    event.preventDefault();

    if (!user) {
      return toast.error("Please login to order from a vendor");
    }

    try {
      await API.post("/vendors/orders", orderForm);
      toast.success("Vendor order created");
      setOrderForm({ vendor_product_id: "", quantity: 1, delivery_address: "" });
      fetchMarketplace();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Vendor order failed");
    }
  };

  const rateVendor = async (vendorId, rating) => {
    if (!user) {
      return toast.error("Please login to rate a vendor");
    }

    try {
      await API.post("/vendors/ratings", {
        vendor_id: vendorId,
        rating,
        comment: "Customer marketplace rating",
      });
      toast.success("Vendor rated");
      fetchMarketplace();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Rating failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-green-200">
            Vendor Marketplace
          </p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="text-3xl font-black md:text-5xl">
                The Jumia of grains for verified sellers.
              </h1>
              <p className="mt-4 max-w-3xl text-slate-300">
                Grain sellers can register, list products, receive ratings, and
                manage delivery while Elohim tracks commission and verification.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-4">
                <p className="text-2xl font-black">{verifiedVendors.length}</p>
                <p className="text-sm text-slate-300">Verified vendors</p>
              </div>
              <div className="rounded-lg bg-white/10 p-4">
                <p className="text-2xl font-black">{products.length}</p>
                <p className="text-sm text-slate-300">Vendor products</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Vendor products
                </h2>
                <p className="text-sm text-slate-500">
                  Buy grains from marketplace sellers with platform delivery oversight.
                </p>
              </div>
              <button
                onClick={fetchMarketplace}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white disabled:text-slate-400"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-bold text-slate-950">No vendor products yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Verified vendor products will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  >
                    <img
                      src={normalizeImagePath(product.image_url)}
                      alt={product.name}
                      className="h-40 w-full object-cover"
                    />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-slate-950">{product.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.weight || "Standard"} by {product.business_name}
                          </p>
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                          Verified
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-lg font-black text-green-700">
                          {formatPrice(product.price)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.stock_quantity} in stock
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setOrderForm({
                            ...orderForm,
                            vendor_product_id: product.id,
                          })
                        }
                        className="mt-4 w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800"
                      >
                        Select for order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <form
              onSubmit={createVendorOrder}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-black text-slate-950">Order from vendor</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a marketplace order for delivery management.
              </p>
              <div className="mt-4 space-y-3">
                <select
                  value={orderForm.vendor_product_id}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, vendor_product_id: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-3"
                  required
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.business_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, quantity: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Quantity"
                  required
                />
                <textarea
                  value={orderForm.delivery_address}
                  onChange={(event) =>
                    setOrderForm({ ...orderForm, delivery_address: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Delivery address"
                  rows={3}
                />
                <button className="w-full rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800">
                  Create Vendor Order
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Verified sellers
              </h2>
              <div className="mt-4 space-y-3">
                {verifiedVendors.slice(0, 5).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {vendor.business_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vendor.location || "Location pending"} • {vendor.product_count} products
                        </p>
                      </div>
                      <p className="text-sm font-black text-amber-600">
                        {Number(vendor.rating_avg || 0).toFixed(1)}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => rateVendor(vendor.id, rating)}
                          className="rounded bg-amber-50 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {verifiedVendors.length === 0 && (
                  <p className="text-sm text-slate-500">No verified vendors yet.</p>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={registerVendor}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Seller onboarding
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Register as a grain vendor
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={vendorForm.business_name}
                onChange={(event) =>
                  setVendorForm({ ...vendorForm, business_name: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Business name"
                required
              />
              <input
                value={vendorForm.phone}
                onChange={(event) =>
                  setVendorForm({ ...vendorForm, phone: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Phone"
              />
              <input
                value={vendorForm.location}
                onChange={(event) =>
                  setVendorForm({ ...vendorForm, location: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Market or location"
              />
              <input
                value={vendorForm.description}
                onChange={(event) =>
                  setVendorForm({ ...vendorForm, description: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="What do you sell?"
              />
            </div>
            <button className="mt-4 rounded-lg bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800">
              Submit for Verification
            </button>
          </form>

          <form
            onSubmit={createVendorProduct}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                  Vendor tools
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Add seller product
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {myVendor?.verification_status || "Not registered"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={productForm.name}
                onChange={(event) =>
                  setProductForm({ ...productForm, name: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Product name"
                required
              />
              <input
                type="number"
                value={productForm.price}
                onChange={(event) =>
                  setProductForm({ ...productForm, price: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Price"
                required
              />
              <input
                value={productForm.weight}
                onChange={(event) =>
                  setProductForm({ ...productForm, weight: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Weight e.g. 25kg"
              />
              <input
                type="number"
                value={productForm.stock_quantity}
                onChange={(event) =>
                  setProductForm({ ...productForm, stock_quantity: event.target.value })
                }
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Stock"
              />
            </div>
            <input
              value={productForm.image_url}
              onChange={(event) =>
                setProductForm({ ...productForm, image_url: event.target.value })
              }
              className="mt-3 w-full rounded-lg border border-slate-300 p-3"
              placeholder="Image file e.g. Rice.jpg"
            />
            <button className="mt-4 rounded-lg bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">
              Add Product
            </button>
          </form>
        </section>

        {myVendor && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">My vendor dashboard</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-sm text-green-700">Verification</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {myVendor.verification_status}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-4">
                <p className="text-sm text-slate-500">Products</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {myProducts.length}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Orders</p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {myOrders.length}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
