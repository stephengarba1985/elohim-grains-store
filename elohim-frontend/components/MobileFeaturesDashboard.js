"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const platformOptions = ["android", "ios", "web"];

const formatDate = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MobileFeaturesDashboard({ admin = false }) {
  const [notifications, setNotifications] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState("android");
  const [pushToken, setPushToken] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const notificationRes = await API.get("/mobile/notifications");
      setNotifications(Array.isArray(notificationRes.data) ? notificationRes.data : []);

      if (admin) {
        const overviewRes = await API.get("/mobile/admin/overview");
        setOverview(overviewRes.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load mobile features");
    } finally {
      setLoading(false);
    }
  };

  const registerDevice = async (event) => {
    event.preventDefault();

    if (!pushToken.trim()) {
      return toast.error("Enter a push token");
    }

    try {
      await API.post("/mobile/devices", {
        platform,
        push_token: pushToken.trim(),
        app_version: "future-native-1.0",
        device_name: `${platform.toUpperCase()} test device`,
      });
      toast.success("Device registered");
      setPushToken("");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Device registration failed");
    }
  };

  const sendTestAlert = async () => {
    try {
      await API.post("/mobile/test-alert", {
        title: "Mobile app ready",
        body: "Push notification pipeline is connected to your account.",
      });
      toast.success("Test alert queued");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to queue test alert");
    }
  };

  const markRead = async (id) => {
    try {
      await API.patch(`/mobile/notifications/${id}/read`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark notification");
    }
  };

  const runPaymentReminders = async () => {
    try {
      const res = await API.post("/mobile/payment-reminders/run");
      toast.success(`${res.data.count || 0} reminders queued`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to run reminders");
    }
  };

  const stats = overview?.devices || {};
  const notificationStats = overview?.notifications || {};

  return (
    <div className={admin ? "space-y-6" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      <div className={admin ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Mobile App Features
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Android and iOS readiness
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Prepare push notifications, wallet alerts, and payment reminders for the future native apps.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={sendTestAlert}
              disabled={loading}
              className="border border-slate-300 text-slate-700 hover:bg-white disabled:text-slate-400 px-5 py-3 rounded-lg font-semibold"
            >
              Queue Test Alert
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Android App</p>
            <p className="text-xl font-bold text-slate-950">Future</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">iOS App</p>
            <p className="text-xl font-bold text-slate-950">Future</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Unread Alerts</p>
            <p className="text-xl font-bold text-green-700">{unreadCount}</p>
          </div>
          <div className="bg-slate-950 text-white rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-300">Push Provider</p>
            <p className="text-lg font-bold capitalize">
              {overview?.native_apps?.push_provider?.replace(/_/g, " ") || "Pending provider key"}
            </p>
          </div>
        </div>

        {admin && (
          <div className="grid lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Registered Devices</p>
              <p className="text-xl font-bold text-slate-950">{stats.total || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Android</p>
              <p className="text-xl font-bold text-slate-950">{stats.android || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">iOS</p>
              <p className="text-xl font-bold text-slate-950">{stats.ios || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Payment Reminders</p>
              <p className="text-xl font-bold text-amber-600">{notificationStats.payment_reminders || 0}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 h-fit">
            <h2 className="text-lg font-bold text-slate-950">Register Test Device</h2>
            <form onSubmit={registerDevice} className="mt-4 space-y-3">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3"
              >
                {platformOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
              <input
                value={pushToken}
                onChange={(event) => setPushToken(event.target.value)}
                placeholder="Paste Expo/FCM/APNs token"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
              />
              <button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800 text-white px-4 py-3 rounded-lg font-semibold"
              >
                Register Device
              </button>
            </form>

            {admin && (
              <button
                onClick={runPaymentReminders}
                className="mt-4 w-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-4 py-3 rounded-lg font-semibold"
              >
                Run Payment Reminders
              </button>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-slate-950">Notification Inbox</h2>
              <span className="text-sm text-slate-500">{notifications.length} alerts</span>
            </div>

            {notifications.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center">
                <p className="font-semibold text-slate-950">No mobile alerts yet</p>
                <p className="text-sm text-slate-500 mt-2">
                  Queue a test alert or trigger a wallet/payment action.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      item.read_at ? "border-slate-200 bg-white" : "border-green-200 bg-green-50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase">
                          {String(item.type || "general").replace(/_/g, " ")}
                        </p>
                        <h3 className="font-bold text-slate-950 mt-1">{item.title}</h3>
                        <p className="text-sm text-slate-600 mt-2">{item.body}</p>
                        <p className="text-xs text-slate-500 mt-3">
                          {formatDate(item.created_at)}
                        </p>
                      </div>

                      {!item.read_at && (
                        <button
                          onClick={() => markRead(item.id)}
                          className="border border-slate-300 text-slate-700 hover:bg-white px-3 py-2 rounded-lg text-sm font-semibold"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
