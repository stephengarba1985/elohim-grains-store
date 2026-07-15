"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const statusClass = (status) => {
  if (status === "verified" || status === "paid" || status === "delivered") {
    return "bg-green-100 text-green-700";
  }
  if (status === "rejected" || status === "cancelled" || status === "failed") {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-700";
};

export default function AdminVendorsPage() {
  const [totals, setTotals] = useState({});
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/vendors/admin/overview");
      setTotals(res.data?.totals || {});
      setVendors(Array.isArray(res.data?.vendors) ? res.data.vendors : []);
      setProducts(Array.isArray(res.data?.products) ? res.data.products : []);
      setOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const updateVerification = async (vendor, status) => {
    try {
      await API.patch(`/vendors/admin/vendors/${vendor.id}/verification`, {
        status,
        commission_rate: vendor.commission_rate,
      });
      toast.success("Vendor verification updated");
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Verification update failed");
    }
  };

  const updateOrder = async (order, field, value) => {
    try {
      await API.patch(`/vendors/admin/orders/${order.id}/delivery`, {
        [field]: value,
      });
      toast.success("Vendor order updated");
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Order update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Vendor Marketplace</h1>
          <p className="mt-1 text-slate-500">
            Verify sellers, track marketplace products, commission, ratings, and delivery.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:bg-green-300"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Vendors</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.vendors || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Products</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.products || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Orders</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.orders || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Gross Sales</p>
          <h2 className="text-xl font-bold text-green-700">
            {formatPrice(totals.gross_sales)}
          </h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Commission</p>
          <h2 className="text-xl font-bold text-amber-600">
            {formatPrice(totals.commission_earned)}
          </h2>
        </div>
      </div>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Vendor verification</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Vendor</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Commission</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-t">
                  <td className="p-3">
                    <p className="font-semibold">{vendor.business_name}</p>
                    <p className="text-xs text-slate-500">{vendor.location || "No location"}</p>
                  </td>
                  <td className="p-3">
                    <p>{vendor.owner_name || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{vendor.owner_email}</p>
                  </td>
                  <td className="p-3">
                    {Number(vendor.rating_avg || 0).toFixed(1)} ({vendor.rating_count || 0})
                  </td>
                  <td className="p-3">{Number(vendor.commission_rate || 0)}%</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(vendor.verification_status)}`}>
                      {vendor.verification_status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateVerification(vendor, "verified")}
                        className="rounded bg-green-700 px-3 py-1 text-xs font-bold text-white"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => updateVerification(vendor, "rejected")}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    No vendors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded bg-white p-4 shadow">
          <h2 className="text-lg font-bold text-slate-950">Vendor products</h2>
          <div className="mt-4 space-y-3">
            {products.slice(0, 8).map((product) => (
              <div key={product.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.business_name} • {product.stock_quantity} in stock
                    </p>
                  </div>
                  <p className="font-bold text-green-700">{formatPrice(product.price)}</p>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-sm text-slate-500">No vendor products yet.</p>
            )}
          </div>
        </div>

        <div className="rounded bg-white p-4 shadow">
          <h2 className="text-lg font-bold text-slate-950">Delivery management</h2>
          <div className="mt-4 space-y-3">
            {orders.slice(0, 8).map((order) => (
              <div key={order.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.product_name || "Vendor product"}</p>
                    <p className="text-xs text-slate-500">
                      {order.business_name} • {order.buyer_name || "Buyer"} • Qty {order.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Commission: {formatPrice(order.commission_amount)}
                    </p>
                  </div>
                  <p className="font-bold text-green-700">{formatPrice(order.total_amount)}</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    value={order.delivery_status}
                    onChange={(event) => updateOrder(order, "delivery_status", event.target.value)}
                    className="rounded border border-slate-300 p-2"
                  >
                    {["pending", "processing", "assigned", "in_transit", "delivered", "cancelled"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    value={order.payment_status}
                    onChange={(event) => updateOrder(order, "payment_status", event.target.value)}
                    className="rounded border border-slate-300 p-2"
                  >
                    {["pending", "paid", "escrow", "failed", "refunded"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-slate-500">No vendor orders yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
