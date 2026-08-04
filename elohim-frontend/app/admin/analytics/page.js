"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    revenue: 0,
    todayRevenue: 0,
    orders: 0,
    todayOrders: 0,
    delivered: 0,
    pending: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [ordersRes, statsRes] = await Promise.all([
          API.get("/orders"),
          API.get("/admin/stats"),
        ]);

        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
        setStats((prev) => ({ ...prev, ...(statsRes.data || {}) }));
      } catch (err) {
        console.error("Analytics load error:", err.response?.data || err.message);
        toast.error("Failed to load sales analytics");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const chartData = useMemo(() => {
    const grouped = {};

    orders.forEach((order) => {
      const date = new Date(order.created_at).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = { date, revenue: 0, orders: 0, delivered: 0 };
      }

      grouped[date].orders += 1;

      if (["paid", "delivered"].includes(String(order.status || "").toLowerCase())) {
        grouped[date].revenue += Number(order.total_amount || 0);
      }

      if (String(order.status || "").toLowerCase() === "delivered") {
        grouped[date].delivered += 1;
      }
    });

    return Object.values(grouped).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 10), [orders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales Analytics</h1>
        <p className="text-sm text-gray-500">Revenue, order volume, and delivery trends.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Realized Revenue</p>
          <h2 className="text-2xl font-bold text-green-600">{formatPrice(stats.revenue)}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Today's Revenue</p>
          <h2 className="text-2xl font-bold text-green-600">{formatPrice(stats.todayRevenue)}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Total Orders</p>
          <h2 className="text-2xl font-bold">{Number(stats.orders || 0)}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Delivered</p>
          <h2 className="text-2xl font-bold text-blue-600">{Number(stats.delivered || 0)}</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-3">Revenue and Orders Over Time</h2>
        <ResponsiveContainer width="100%" height={320}>
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

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-3">Delivered Orders Trend</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="delivered" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-3">Recent Orders</h2>
        {loading ? (
          <p className="text-gray-500">Loading analytics...</p>
        ) : recentOrders.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Order</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">#{order.id}</td>
                    <td className="py-2">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="py-2">{order.status}</td>
                    <td className="py-2 text-right">{formatPrice(order.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
