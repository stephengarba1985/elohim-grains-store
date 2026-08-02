"use client";

import { useEffect, useState } from "react";
//import API from "../../lib/api";
import API from "@/lib/api";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [stats, setStats] = useState({
    revenue: 0,
    todayRevenue: 0,
    orders: 0,
    todayOrders: 0,
    customers: 0,
    products: 0,
    riders: 0,
    lowStock: 0,
    delivered: 0,
    pending: 0,
    subscriptions: 0,
  });

  const router = useRouter();

  /* ========================= AUTH ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login");
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (!parsedUser.is_admin) {
      toast.error("Access denied");
      router.push("/");
      return;
    }

    fetchOrders();
    fetchRiders();
    fetchStats();

    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ========================= FETCH ========================= */
  const fetchOrders = async () => {
    try {
      const res = await API.get("/orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    }
  };

  const fetchRiders = async () => {
    try {
      const res = await API.get("/riders");
      setRiders(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load riders");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/admin/stats");
      setStats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard statistics");
    }
  };

  /* ========================= ACTIONS ========================= */
  const updateOrderStatus = async (id, status) => {
    try {
      await API.put(`/orders/${id}/status`, { status });
      toast.success("Order updated");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update order");
    }
  };

  const assignRider = async (orderId, riderId) => {
    try {
      await API.put(`/orders/${orderId}/assign-rider`, {
        rider_id: riderId,
      });
      toast.success("Rider assigned");
      fetchOrders();
    } catch (err) {
      console.error(err);
      toast.error("Assignment failed");
    }
  };

  const logout = () => {
    localStorage.clear();
    toast.success("Logged out");
    // Clear any stored auth to prevent 401 errors
    sessionStorage.clear();
    router.push("/login");
  };

  const formatPrice = (price) =>
    `₦${Number(price || 0).toLocaleString()}`;

  /* ========================= CHART DATA ========================= */
  const grouped = {};

  orders.forEach((order) => {
    const date = new Date(order.created_at).toLocaleDateString();

    if (!grouped[date]) {
      grouped[date] = { date, revenue: 0, orders: 0 };
    }

    grouped[date].revenue += Number(order.total_amount || 0);
    grouped[date].orders += 1;
  });

  const chartData = Object.values(grouped).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-lg text-green-700">
          Elohim Inventory & Logistics 🌾🚚
        </h1>

        <div className="flex gap-4 items-center">
          <span className="text-sm">{user?.name}</span>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-6">

        <h1 className="text-3xl font-bold mb-6">Dashboard 📊</h1>

        {/* ========================= STATS ========================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Revenue</p>
            <h2 className="text-2xl font-bold text-green-600">
              {formatPrice(stats.revenue)}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Today's Revenue</p>
            <h2 className="text-xl font-bold">
              {formatPrice(stats.todayRevenue)}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Orders</p>
            <h2 className="text-2xl font-bold">
              {stats.orders}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Today's Orders</p>
            <h2 className="text-2xl font-bold">
              {stats.todayOrders}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Customers</p>
            <h2 className="text-2xl font-bold">
              {stats.customers}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Products</p>
            <h2 className="text-2xl font-bold">
              {stats.products}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Riders</p>
            <h2 className="text-2xl font-bold">
              {stats.riders}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Low Stock</p>
            <h2 className="text-2xl font-bold text-red-600">
              {stats.lowStock}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Delivered</p>
            <h2 className="text-2xl font-bold text-green-600">
              {stats.delivered}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Pending</p>
            <h2 className="text-2xl font-bold text-orange-600">
              {stats.pending}
            </h2>
          </div>

        </div>

        {/* ========================= CHART ========================= */}
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="font-bold mb-3">Sales Overview 📊</h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="revenue" stroke="#16a34a" strokeWidth={3} />
              <Line dataKey="orders" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>

        </div>

        {/* ========================= ORDERS ========================= */}
        <div className="bg-white p-6 rounded shadow">

          <h2 className="font-bold text-lg mb-4">
            Orders Management 📦
          </h2>

          {orders.length === 0 && (
            <p className="text-gray-500">No orders yet</p>
          )}

          {orders.map((order) => (
            <div key={order.id} className="border p-4 mb-3 rounded">

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">Order #{order.id}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                  {/* USER DETAILS */}
                  <p className="text-sm text-gray-600">
                    {order.name ? order.name : "Guest User"}
                  </p>

                  <p className="text-xs text-gray-500">
                    {order.email || "No email provided"}
                  </p>
                  
                  <p>{order.phone}</p>
                  <p>{order.address}</p>
                </div>

                <span className={`px-3 py-1 rounded text-xs ${
                  order.status === "delivered"
                    ? "bg-green-100 text-green-700"
                    : order.status === "in_transit"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="mt-2 flex justify-between items-center">
                <p className="font-semibold">
                  {formatPrice(order.total_amount)}
                </p>

                {order.is_bulk && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded">
                    BULK
                  </span>
                )}
              </div>

              {/* ACTIONS */}
              <div className="mt-3 flex gap-2 items-center">

                <select
                  className="border p-1 rounded text-sm"
                  value={order.rider_id || ""}
                  onChange={(e) => assignRider(order.id, e.target.value)}
                >
                  <option value="">Assign Rider</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <select
                  className="border p-1 rounded text-sm"
                  value={order.status}
                  onChange={(e) =>
                    updateOrderStatus(order.id, e.target.value)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </select>

              </div>

            </div>
          ))}

        </div>

      </div>
    </div>
  );
}
