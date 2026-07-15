"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const statusStyles = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
};

const formatPlan = (value) => {
  if (!value) return "Monthly";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = (date) => {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getDaysUntil = (date) => {
  if (!date) return null;

  const today = new Date();
  const deliveryDate = new Date(date);
  const diff = deliveryDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getNextDeliveryLabel = (date) => {
  const days = getDaysUntil(date);

  if (days === null) return "Delivery date unavailable";
  if (days < 0) return "Delivery due";
  if (days === 0) return "Delivery today";
  if (days === 1) return "Delivery tomorrow";

  return `Delivery in ${days} days`;
};

export default function SubscriptionPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchSubscriptions(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const summary = useMemo(() => {
    return subscriptions.reduce(
      (total, subscription) => {
        total.all += 1;

        if (subscription.status === "active") {
          total.active += 1;
        }

        if (subscription.status === "paused") {
          total.paused += 1;
        }

        const days = getDaysUntil(subscription.next_delivery);
        if (days !== null && days >= 0 && days <= 7) {
          total.upcoming += 1;
        }

        return total;
      },
      { all: 0, active: 0, paused: 0, upcoming: 0 }
    );
  }, [subscriptions]);

  const fetchSubscriptions = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/subscriptions/${userId}`);
      setSubscriptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const runAction = async ({ id, type, request, optimisticUpdate, success, error }) => {
    try {
      setActionKey(`${type}-${id}`);
      await request();
      optimisticUpdate();
      toast.success(success);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || error);
    } finally {
      setActionKey("");
    }
  };

  const pauseSubscription = async (id) => {
    runAction({
      id,
      type: "pause",
      request: () => API.put(`/subscriptions/${id}/pause`),
      optimisticUpdate: () =>
        setSubscriptions((current) =>
          current.map((sub) => (sub.id === id ? { ...sub, status: "paused" } : sub))
        ),
      success: "Subscription paused",
      error: "Failed to pause subscription",
    });
  };

  const resumeSubscription = async (id) => {
    runAction({
      id,
      type: "resume",
      request: () => API.put(`/subscriptions/${id}/resume`),
      optimisticUpdate: () =>
        setSubscriptions((current) =>
          current.map((sub) => (sub.id === id ? { ...sub, status: "active" } : sub))
        ),
      success: "Subscription resumed",
      error: "Failed to resume subscription",
    });
  };

  const skipDelivery = async (subscription) => {
    const intervalDays = subscription.plan === "weekly" ? 7 : 30;

    runAction({
      id: subscription.id,
      type: "skip",
      request: () => API.put(`/subscriptions/${subscription.id}/skip`),
      optimisticUpdate: () =>
        setSubscriptions((current) =>
          current.map((sub) =>
            sub.id === subscription.id
              ? {
                  ...sub,
                  next_delivery: new Date(
                    new Date(sub.next_delivery).getTime() +
                      intervalDays * 24 * 60 * 60 * 1000
                  ),
                }
              : sub
          )
        ),
      success: "Delivery skipped",
      error: "Failed to skip delivery",
    });
  };

  const cancelSubscription = async (subscription) => {
    const confirmed = window.confirm(
      `Cancel ${subscription.product_name || "this subscription"}?`
    );

    if (!confirmed) return;

    runAction({
      id: subscription.id,
      type: "cancel",
      request: () => API.delete(`/subscriptions/${subscription.id}`),
      optimisticUpdate: () =>
        setSubscriptions((current) =>
          current.filter((sub) => sub.id !== subscription.id)
        ),
      success: "Subscription cancelled",
      error: "Failed to cancel subscription",
    });
  };

  const isWorking = (id, type) => actionKey === `${type}-${id}`;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Subscriptions
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Manage recurring grain deliveries
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Track active subscriptions, pause deliveries, skip the next cycle, or
              resume when you are ready.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => fetchSubscriptions(user?.id)}
              disabled={loading}
              className="border border-slate-300 text-slate-700 hover:bg-white disabled:text-slate-400 px-5 py-3 rounded-lg font-semibold"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/"
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm text-center"
            >
              Browse Products
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Subscriptions</p>
            <p className="text-xl font-bold text-slate-950">{summary.all}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Active</p>
            <p className="text-xl font-bold text-green-700">{summary.active}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Paused</p>
            <p className="text-xl font-bold text-amber-600">{summary.paused}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Due This Week</p>
            <p className="text-xl font-bold text-slate-950">{summary.upcoming}</p>
          </div>
        </div>

        {loading && subscriptions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">Loading subscriptions...</p>
            <p className="text-slate-500 mt-2">Fetching your delivery schedule.</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">
              No subscriptions yet
            </p>
            <p className="text-slate-500 mt-2">
              Start from any product page and choose a weekly or monthly subscription.
            </p>
            <Link
              href="/"
              className="inline-flex mt-5 bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {subscriptions.map((subscription) => {
              const statusClass =
                statusStyles[subscription.status] || "bg-slate-100 text-slate-700";
              const deliveryLabel = getNextDeliveryLabel(subscription.next_delivery);

              return (
                <div
                  key={subscription.id}
                  className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        {formatPlan(subscription.plan)} subscription
                      </p>
                      <h3 className="text-lg font-bold text-slate-950 mt-1">
                        {subscription.product_name}
                      </h3>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}
                    >
                      {subscription.status || "active"}
                    </span>
                  </div>

                  <div className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <p className="text-slate-500">Quantity</p>
                      <p className="font-bold text-slate-950">
                        {subscription.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Plan</p>
                      <p className="font-bold text-slate-950">
                        {formatPlan(subscription.plan)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Next Delivery</p>
                      <p className="font-bold text-slate-950">
                        {formatDate(subscription.next_delivery)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Schedule</p>
                      <p className="font-bold text-green-700">{deliveryLabel}</p>
                    </div>
                  </div>

                  <div className="mt-5 border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Delivery control</p>
                    <p className="text-sm text-slate-700 mt-1">
                      Skip moves the next delivery forward by one {subscription.plan || "cycle"}.
                    </p>
                  </div>

                  <div className="mt-5 grid sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => skipDelivery(subscription)}
                      disabled={Boolean(actionKey)}
                      className="border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 px-4 py-3 rounded-lg font-semibold"
                    >
                      {isWorking(subscription.id, "skip") ? "Skipping..." : "Skip"}
                    </button>

                    {subscription.status === "paused" ? (
                      <button
                        onClick={() => resumeSubscription(subscription.id)}
                        disabled={Boolean(actionKey)}
                        className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-4 py-3 rounded-lg font-semibold"
                      >
                        {isWorking(subscription.id, "resume") ? "Resuming..." : "Resume"}
                      </button>
                    ) : (
                      <button
                        onClick={() => pauseSubscription(subscription.id)}
                        disabled={Boolean(actionKey)}
                        className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white px-4 py-3 rounded-lg font-semibold"
                      >
                        {isWorking(subscription.id, "pause") ? "Pausing..." : "Pause"}
                      </button>
                    )}

                    <button
                      onClick={() => cancelSubscription(subscription)}
                      disabled={Boolean(actionKey)}
                      className="sm:col-span-2 border border-red-200 text-red-700 hover:bg-red-50 disabled:bg-slate-100 disabled:text-slate-400 px-4 py-3 rounded-lg font-semibold"
                    >
                      {isWorking(subscription.id, "cancel")
                        ? "Cancelling..."
                        : "Cancel Subscription"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
