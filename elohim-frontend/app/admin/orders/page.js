"use client";

import { useEffect, useState } from "react";
import API from "../../../lib/api";
import toast from "react-hot-toast";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);

  const [riders, setRiders] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getBackendRootUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return apiUrl.replace(/\/api\/?$/, "");
  };

  const today = new Date().toDateString();

  const todayOrders = orders.filter(
    (o) => new Date(o.created_at).toDateString() === today
  );

  const pendingOrders = orders.filter(
    (o) => o.status === "pending"
  );

  const processingOrders = orders.filter(
    (o) => o.status === "processing"
  );

  const deliveredOrders = orders.filter(
    (o) => o.status === "delivered"
  );

  const cancelledOrders = orders.filter(
    (o) => o.status === "cancelled"
  );

  const todayRevenue = todayOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const formatPrice = (amount) =>
    `₦${Number(amount || 0).toLocaleString()}`;

  useEffect(() => {
    fetchOrders();
    fetchRiders();
  }, []);

  /* ========================= FETCH ORDERS ========================= */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/orders");

      console.log("📦 ORDERS:", res.data);

      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  /* ========================= FETCH RIDERS ========================= */
  const fetchRiders = async () => {
    try {
      const res = await API.get("/riders");
      setRiders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load riders");
    }
  };

  /* ========================= VIEW DETAILS ========================= */
  const viewDetails = async (id) => {
    try {
      const res = await API.get(`/orders/${id}`);
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setSelected(id);
    } catch {
      toast.error("Failed to load details");
    }
  };

  /* ========================= UPDATE STATUS ========================= */
  const updateStatus = async (id, status) => {
    try {
      await API.put(`/orders/${id}/status`, { status });
      toast.success("Status updated");
      fetchOrders();
    } catch (err) {
      console.error("FULL ERROR:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  /* ========================= ASSIGN RIDER ========================= */
  const assignRider = async (deliveryId) => {
    const rider_id = selectedRiders[deliveryId];

    if (!rider_id) {
      toast.error("Select a rider first");
      return;
    }

    try {
      await API.put(`/orders/${deliveryId}/assign-rider`, { rider_id });

      toast.success("Rider assigned 🚚");

      fetchOrders();
      fetchRiders();
    } catch (err) {
      console.error(err);
      toast.error("Assignment failed");
    }
  };

  const releaseEscrow = async (order) => {
    if (!order.escrow_payment_id) {
      return toast.error("No held escrow payment found");
    }

    try {
      await API.post(`/escrow/${order.escrow_payment_id}/release`, {
        note: "Delivery confirmed from orders dashboard",
      });
      toast.success("Escrow released");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Escrow release failed");
    }
  };

  const printInvoice = (orderId) => {
    const invoiceUrl = `${getBackendRootUrl()}/api/orders/${orderId}/invoice`;
    window.open(invoiceUrl, "_blank", "noopener,noreferrer");
  };

  const copyReference = async (reference) => {
    if (!reference) {
      return toast.error("No payment reference available");
    }

    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Reference copied");
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy reference");
    }
  };

  const notifyCustomer = async (orderId) => {
    try {
      await API.post(`/orders/${orderId}/notify-customer`);
      toast.success("Customer notified");
    } catch (err) {
      console.error(err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to notify customer");
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">
        Logistics Dashboard 🚚
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Today's Orders</p>
          <h2 className="text-2xl font-bold">
            {todayOrders.length}
          </h2>
        </div>

        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <p className="text-yellow-700 text-sm">Pending</p>
          <h2 className="text-2xl font-bold">
            {pendingOrders.length}
          </h2>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-blue-700 text-sm">Processing</p>
          <h2 className="text-2xl font-bold">
            {processingOrders.length}
          </h2>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-green-700 text-sm">Delivered</p>
          <h2 className="text-2xl font-bold">
            {deliveredOrders.length}
          </h2>
        </div>

        <div className="bg-red-50 rounded-lg shadow p-4">
          <p className="text-red-700 text-sm">Cancelled</p>
          <h2 className="text-2xl font-bold">
            {cancelledOrders.length}
          </h2>
        </div>

        <div className="bg-emerald-50 rounded-lg shadow p-4">
          <p className="text-emerald-700 text-sm">
            Today's Revenue
          </p>
          <h2 className="text-xl font-bold">
            {formatPrice(todayRevenue)}
          </h2>
        </div>

      </div>

      {/* DEBUG PANEL */}
      <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
        <p><b>Orders:</b> {orders.length}</p>
        <p><b>Riders:</b> {riders.length}</p>
      </div>

      {loading && <p>Loading orders...</p>}

      <div className="flex flex-col md:flex-row gap-3 mb-5">

        <input
          type="text"
          placeholder="Search Order, Customer, Email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded-lg p-3"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg p-3"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="assigned">Assigned</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>

      </div>

      <div className="grid gap-4">
        {orders
          .filter((order) => {
            const keyword = search.toLowerCase();

            const matchesSearch = (
              String(order.id).includes(keyword) ||
              order.name?.toLowerCase().includes(keyword) ||
              order.email?.toLowerCase().includes(keyword) ||
              order.phone?.includes(keyword)
            );

            const matchesStatus =
              statusFilter === "all" || order.status === statusFilter;

            return matchesSearch && matchesStatus;
          })
          .map((order) => (
          <div
            key={order.id}
            className={`p-4 rounded shadow ${
              order.is_bulk ? "bg-indigo-50 border border-indigo-200" : "bg-white"
            }`}
          >

            {/* HEADER */}
            <div className="flex justify-between">
              <div>

                {/* ORDER TITLE + BADGES */}
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">
                    Order #{order.id}
                  </h2>

                  {/* SUBSCRIPTION BADGE */}
                  {order.is_subscription && (
                    <span className="bg-purple-100 text-purple-600 px-2 py-1 text-xs rounded">
                      Subscription
                    </span>
                  )}

                  {/* BULK BADGE */}
                  {order.is_bulk && (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 text-xs rounded font-semibold">
                      BULK ORDER
                    </span>
                  )}

                  {order.is_escrow && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 text-xs rounded font-semibold">
                      ESCROW {order.escrow_status}
                    </span>
                  )}
                </div>

                <p>
                  {order.name || "Unknown"} ({order.email || "No email"})
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-green-700">
                    {formatPrice(order.total_amount)}
                </p>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold
                    ${
                      order.status === "pending"
                        ? "bg-yellow-100 text-yellow-700"
                      : order.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                      : order.status === "assigned"
                        ? "bg-purple-100 text-purple-700"
                      : order.status === "in_transit"
                        ? "bg-orange-100 text-orange-700"
                      : order.status === "delivered"
                        ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                    }`}
                >
                  {order.status.replace("_", " ").toUpperCase()}
                </span>

                <div className="mt-2 flex gap-2 flex-wrap">

                  {order.payment_status === "paid" && (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                      PAID
                    </span>
                  )}

                  {order.payment_status === "pending" && (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
                      PENDING PAYMENT
                    </span>
                  )}

                  {order.payment_gateway && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                      {order.payment_gateway.toUpperCase()}
                    </span>
                  )}

                </div>

              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => viewDetails(order.id)}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                View
              </button>

              <button
                onClick={() => updateStatus(order.id, "processing")}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                Processing
              </button>

              <button
                onClick={() => updateStatus(order.id, "delivered")}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Delivered
              </button>

              {order.escrow_status === "held" && (
                <button
                  onClick={() => releaseEscrow(order)}
                  className="bg-emerald-700 text-white px-3 py-1 rounded"
                >
                  Release Escrow
                </button>
              )}
            </div>

            {/* NO RIDERS */}
            {riders.length === 0 && (
              <p className="text-red-500 text-sm mt-2">
                ⚠️ No riders found (check backend)
              </p>
            )}

            {/* RIDER ASSIGNMENT */}
            {riders.length > 0 && (
              <div className="mt-3 flex gap-2 items-center">

                <select
                  value={selectedRiders[order.id] || ""}
                  onChange={(e) =>
                    setSelectedRiders({
                      ...selectedRiders,
                      [order.id]: e.target.value,
                    })
                  }
                  className="border p-2 rounded text-sm"
                >
                  <option value="">Select Rider</option>

                  {riders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.name} ({rider.phone})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => assignRider(order.id)}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
                >
                  Assign Rider
                </button>

              </div>
            )}

            {/* ORDER DETAILS */}
            {selected === order.id && (
              <div className="mt-4 border-t pt-4 bg-gray-50 rounded-lg p-4">

                <div className="grid md:grid-cols-2 gap-6">

                  {/* CUSTOMER */}
                  <div>
                    <h3 className="font-bold mb-2">
                      Customer Information
                    </h3>

                    <p><b>Name:</b> {order.name}</p>

                    <p><b>Email:</b> {order.email}</p>

                    <p><b>Phone:</b> {order.phone || "-"}</p>

                    <p><b>Address:</b> {order.address || "-"}</p>
                  </div>

                  {/* PAYMENT */}
                  <div>
                    <h3 className="font-bold mb-2">
                      Payment
                    </h3>

                    <p>
                      <b>Status:</b> {order.payment_status || "Pending"}
                    </p>

                    <p>
                      <b>Gateway:</b> {order.payment_gateway || "-"}
                    </p>

                    <p>
                      <b>Reference:</b> {order.reference || "-"}
                    </p>

                    <p>
                      <b>Total:</b> ₦{Number(order.total_amount || 0).toLocaleString()}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-5">

                      <button
                        onClick={() => printInvoice(order.id)}
                        className="bg-green-600 text-white px-3 py-2 rounded"
                      >
                        Print Invoice
                      </button>

                      <button
                        onClick={() => copyReference(order.reference)}
                        className="bg-blue-600 text-white px-3 py-2 rounded"
                      >
                        Copy Reference
                      </button>

                      <button
                        onClick={() => notifyCustomer(order.id)}
                        className="bg-purple-600 text-white px-3 py-2 rounded"
                      >
                        Notify Customer
                      </button>

                    </div>
                  </div>

                </div>

                <div className="mt-6">

                  <h3 className="font-bold mb-3">
                    Ordered Items
                  </h3>

                  <table className="w-full border">

                    <thead className="bg-gray-200">

                      <tr>

                        <th className="p-2 border text-left">
                          Product
                        </th>

                        <th className="p-2 border">
                          Qty
                        </th>

                        <th className="p-2 border">
                          Price
                        </th>

                        <th className="p-2 border">
                          Total
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {items.map((item) => (

                        <tr key={item.id}>

                          <td className="border p-2">
                            {item.name}
                          </td>

                          <td className="border p-2 text-center">
                            {item.quantity}
                          </td>

                          <td className="border p-2 text-center">
                            ₦{Number(item.price).toLocaleString()}
                          </td>

                          <td className="border p-2 text-center">
                            ₦{(
                              Number(item.price) *
                              Number(item.quantity)
                            ).toLocaleString()}
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                  {items.length === 0 && <p className="mt-3">No items</p>}

                </div>

                <div className="mt-6">

                  <h3 className="font-bold mb-3">
                    Order Progress
                  </h3>

                  <div className="space-y-2">

                    <div>✅ Order Created</div>

                    {order.payment_status === "paid" &&
                      <div>✅ Payment Received</div>}

                    {(order.status === "processing" ||
                      order.status === "assigned" ||
                      order.status === "in_transit" ||
                      order.status === "delivered") &&
                      <div>✅ Processing</div>}

                    {(order.status === "assigned" ||
                      order.status === "in_transit" ||
                      order.status === "delivered") &&
                      <div>✅ Rider Assigned</div>}

                    {(order.status === "in_transit" ||
                      order.status === "delivered") &&
                      <div>🚚 Out for Delivery</div>}

                    {order.status === "delivered" &&
                      <div>🎉 Delivered</div>}

                  </div>

                </div>

              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
