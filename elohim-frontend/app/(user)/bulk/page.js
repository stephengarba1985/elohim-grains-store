"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const statusStyles = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  accepted: "bg-blue-100 text-blue-700",
};

const emptyForm = {
  product_id: "",
  quantity: "",
  requested_price: "",
};

export default function BulkDashboard() {
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Login required");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchAll(parsedUser.id);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((product) => String(product.id) === String(formData.product_id));
  }, [products, formData.product_id]);

  const quantity = Number(formData.quantity || 0);
  const requestedPrice = Number(formData.requested_price || 0);
  const requestTotal = quantity * requestedPrice;

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedDeals = requests.filter((request) => request.status === "approved");
  const acceptedDeals = requests.filter((request) => request.status === "accepted");

  const summary = useMemo(
    () => ({
      requests: requests.length,
      pending: pendingRequests.length,
      approved: approvedDeals.length,
      orders: orders.length,
    }),
    [requests.length, pendingRequests.length, approvedDeals.length, orders.length]
  );

  const updateForm = (updates) => {
    setFormData((current) => ({ ...current, ...updates }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
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

  const fetchAll = async (userId) => {
    setLoading(true);

    try {
      await Promise.all([fetchOrders(userId), fetchRequests(userId)]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (userId) => {
    try {
      const res = await API.get(`/orders/user/${userId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setOrders(data.filter((order) => order.is_bulk));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    }
  };

  const fetchRequests = async (userId) => {
    try {
      const res = await API.get("/bulk");
      const data = Array.isArray(res.data) ? res.data : [];
      setRequests(data.filter((request) => Number(request.user_id) === Number(userId)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bulk requests");
    }
  };

  const submitBulkRequest = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      return toast.error("Please log in first");
    }

    if (!formData.product_id || !formData.quantity || !formData.requested_price) {
      return toast.error("Select a product, quantity, and target price");
    }

    if (quantity <= 0 || requestedPrice <= 0) {
      return toast.error("Quantity and target price must be greater than zero");
    }

    try {
      setSubmitting(true);

      await API.post("/bulk", {
        user_id: user.id,
        product_id: Number(formData.product_id),
        quantity,
        requested_price: requestedPrice,
      });

      toast.success("Bulk request submitted");
      resetForm();
      fetchAll(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const acceptDeal = async (id) => {
    try {
      setProcessingId(id);
      await API.post(`/bulk/${id}/accept`);
      toast.success("Order created successfully");
      fetchAll(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to accept deal");
    } finally {
      setProcessingId(null);
    }
  };

 const openInvoice = (orderId) => {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  window.open(`${baseUrl}/orders/${orderId}/invoice`, "_blank");
};

  const RequestCard = ({ request, action }) => {
    const approvedTotal = Number(request.approved_price || 0) * Number(request.quantity || 0);
    const requestedTotal =
      Number(request.requested_price || 0) * Number(request.quantity || 0);
    const statusClass = statusStyles[request.status] || "bg-slate-100 text-slate-700";

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Bulk request
            </p>
            <h3 className="text-lg font-bold text-slate-950 mt-1">
              {request.product_name || "Selected product"}
            </h3>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
            {request.status}
          </span>
        </div>

        <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Quantity</p>
            <p className="font-bold text-slate-950">{request.quantity}</p>
          </div>
          <div>
            <p className="text-slate-500">Requested Price</p>
            <p className="font-bold text-slate-950">
              {formatPrice(request.requested_price)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Requested Total</p>
            <p className="font-bold text-slate-950">{formatPrice(requestedTotal)}</p>
          </div>
        </div>

        {request.approved_price && (
          <div className="mt-4 border border-green-200 bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-700">Approved offer</p>
            <p className="text-xl font-bold text-green-800">
              {formatPrice(request.approved_price)} per unit
            </p>
            <p className="text-sm text-green-700 mt-1">
              Total: {formatPrice(approvedTotal)}
            </p>
          </div>
        )}

        {action}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Bulk Orders
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Request and manage bulk grain deals
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Submit target pricing, review approved offers, and turn accepted deals into
              trackable bulk orders.
            </p>
          </div>

          <button
            onClick={() => user?.id && fetchAll(user.id)}
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Requests</p>
            <p className="text-xl font-bold text-slate-950">{summary.requests}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Pending</p>
            <p className="text-xl font-bold text-amber-600">{summary.pending}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Approved</p>
            <p className="text-xl font-bold text-green-700">{summary.approved}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Bulk Orders</p>
            <p className="text-xl font-bold text-slate-950">{summary.orders}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-green-700 px-5 py-4 text-white">
            <h2 className="text-lg font-bold">New Bulk Request</h2>
            <p className="text-sm text-green-50 mt-1">
              Choose the grain, enter your quantity, and propose a target unit price.
            </p>
          </div>

          <form onSubmit={submitBulkRequest} className="p-5">
            <div className="grid md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Product</span>
                <select
                  value={formData.product_id}
                  onChange={(event) => updateForm({ product_id: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Quantity</span>
                <input
                  value={formData.quantity}
                  onChange={(event) => updateForm({ quantity: event.target.value })}
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Target Unit Price
                </span>
                <input
                  value={formData.requested_price}
                  onChange={(event) => updateForm({ requested_price: event.target.value })}
                  type="number"
                  min="1"
                  placeholder="Price per unit"
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </label>
            </div>

            <div className="mt-5 grid md:grid-cols-3 gap-4 text-sm">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Selected Product</p>
                <p className="text-xl font-bold text-slate-950 mt-1">
                  {selectedProduct?.name || "None"}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Target Unit Price</p>
                <p className="text-xl font-bold text-slate-950 mt-1">
                  {formatPrice(requestedPrice)}
                </p>
              </div>
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <p className="text-green-700">Estimated Request Total</p>
                <p className="text-xl font-bold text-green-800 mt-1">
                  {formatPrice(requestTotal)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-slate-500">
                Admin will review your target price and send back an approved offer.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-3 rounded-lg font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>
          </form>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-slate-950">Approved Deals</h2>
            <span className="text-sm text-slate-500">{approvedDeals.length} ready</span>
          </div>

          {approvedDeals.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No approved deals yet</p>
              <p className="text-slate-500 mt-2">
                Approved offers from admin will appear here for confirmation.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {approvedDeals.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  action={
                    <button
                      disabled={processingId === request.id}
                      onClick={() => acceptDeal(request.id)}
                      className="mt-5 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-3 rounded-lg font-semibold"
                    >
                      {processingId === request.id
                        ? "Creating Order..."
                        : "Accept Deal & Create Order"}
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-slate-950">Pending Requests</h2>
              <span className="text-sm text-slate-500">{pendingRequests.length} open</span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
                <p className="text-lg font-semibold text-slate-950">No pending requests</p>
                <p className="text-slate-500 mt-2">
                  New submissions awaiting review will be listed here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-slate-950">Accepted Deals</h2>
              <span className="text-sm text-slate-500">{acceptedDeals.length} complete</span>
            </div>

            {acceptedDeals.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
                <p className="text-lg font-semibold text-slate-950">No accepted deals yet</p>
                <p className="text-slate-500 mt-2">
                  Accepted offers will appear here after an order is created.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedDeals.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-slate-950">Bulk Orders</h2>
            <span className="text-sm text-slate-500">{orders.length} orders</span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No bulk orders yet</p>
              <p className="text-slate-500 mt-2">
                Orders created from accepted deals will show up here.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        Bulk order
                      </p>
                      <h3 className="text-lg font-bold text-slate-950 mt-1">
                        Order #{order.id}
                      </h3>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {order.status || "pending"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Total</p>
                      <p className="font-bold text-slate-950">
                        {formatPrice(order.total_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Type</p>
                      <p className="font-bold text-green-700">Bulk</p>
                    </div>
                  </div>

                  <button
                    onClick={() => openInvoice(order.id)}
                    className="mt-5 bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
                  >
                    Download Invoice
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
