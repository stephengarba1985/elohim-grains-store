"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";
import UserProfileCard from "@/components/UserProfileCard";

const steps = ["Placed", "Processing", "Shipping", "Delivered"];

const statusStyles = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  bnpl_active: "bg-amber-100 text-amber-700",
  assigned: "bg-indigo-100 text-indigo-700",
  in_transit: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  escrow_held: "bg-amber-100 text-amber-700",
  refunded: "bg-red-100 text-red-700",
};

const quickActions = [
  {
    label: "Grain Savings",
    title: "Manage plans and payments",
    href: "/user/plans",
    action: "Open Plans",
  },
  {
    label: "Wallet",
    title: "Fund, transfer, and auto-save",
    href: "/user/wallet",
    action: "Open Wallet",
  },
  {
    label: "BNPL",
    title: "Collect grains, pay later",
    href: "/user/bnpl",
    action: "Open BNPL",
  },
  {
    label: "Cooperatives",
    title: "Save and buy as a group",
    href: "/user/cooperatives",
    action: "Open Groups",
  },
  {
    label: "Price AI",
    title: "Know the best time to buy",
    href: "/user/price-insights",
    action: "View Insights",
  },
  {
    label: "AI Assistant",
    title: "Chat about prices, savings, and deliveries",
    href: "/user/ai-assistant",
    action: "Open Assistant",
  },
  {
    label: "Mobile App",
    title: "Manage alerts and app notifications",
    href: "/user/mobile",
    action: "Open Mobile",
  },
  {
    label: "Financial Analytics",
    title: "Track savings, spending, and grain returns",
    href: "/user/financial-analytics",
    action: "View Analytics",
  },
  {
    label: "Smart Warehouse",
    title: "Store grains and sell later",
    href: "/user/warehouse",
    action: "Open Warehouse",
  },
  {
    label: "KYC Verification",
    title: "Verify identity and trust",
    href: "/user/kyc",
    action: "Open KYC",
  },
  {
    label: "Bulk Orders",
    title: "Request and accept bulk deals",
    href: "/bulk",
    action: "Open Bulk",
  },
  {
    label: "Subscriptions",
    title: "Control recurring deliveries",
    href: "/subscriptions",
    action: "Open Subscriptions",
  },
  {
    label: "Cart",
    title: "Review items before checkout",
    href: "/cart",
    action: "View Cart",
  },
];

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const normalizeStatus = (status) =>
  String(status || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const formatStatus = (status) => {
  const value = normalizeStatus(status).replace(/_/g, " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = (date) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusStep = (status) => {
  switch (normalizeStatus(status)) {
    case "processing":
    case "paid":
      return 1;
    case "assigned":
    case "out_for_delivery":
    case "in_transit":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
};

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login first");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchOrders(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const summary = useMemo(() => {
    return orders.reduce(
      (total, order) => {
        const status = normalizeStatus(order.status);

        total.spent += Number(order.total_amount || 0);

        if (status !== "delivered") {
          total.active += 1;
        }

        if (order.is_bulk) {
          total.bulk += 1;
        }

        if (order.is_subscription) {
          total.subscription += 1;
        }

        if (order.is_bnpl) {
          total.bnpl += 1;
        }

        return total;
      },
      { spent: 0, active: 0, bulk: 0, subscription: 0, bnpl: 0 }
    );
  }, [orders]);

  const fetchOrders = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/orders/user/${userId}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const reorder = async (order) => {
    if (!user?.id) {
      return toast.error("Please login first");
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      return toast.error("This order has no items to reorder");
    }

    try {
      setReorderingId(order.id);

      for (const item of order.items) {
        await API.post("/cart", {
          product_id: item.product_id,
          quantity: item.quantity,
          user_id: user.id,
        });
      }

      toast.success("Items added back to cart");
      window.dispatchEvent(new Event("cartUpdated"));
    } catch (err) {
      console.error(err);
      toast.error("Reorder failed");
    } finally {
      setReorderingId(null);
    }
  };

  const openInvoice = (orderId) => {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

  window.open(`${baseUrl}/orders/${orderId}/invoice`, "_blank");
};
  const holdEscrow = async (order) => {
    const confirmed = window.confirm(
      `Hold ${formatPrice(order.total_amount)} in escrow for order #${order.id}? Funds will stay protected until delivery is confirmed.`
    );

    if (!confirmed) return;

    try {
      await API.post(`/escrow/orders/${order.id}/hold`, {
        amount: order.total_amount,
      });
      toast.success("Funds moved into escrow");
      fetchOrders(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Escrow hold failed");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.08),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm ring-1 ring-slate-100 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
                Dashboard
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-950">
                Welcome{user?.name ? `, ${user.name}` : ""}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Track orders, manage grain plans, review bulk deals, and keep your
                recurring deliveries organized from one place.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => fetchOrders(user?.id)}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link
                href="/"
                className="rounded-xl bg-green-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-green-800"
              >
                Browse Products
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Total Orders
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{orders.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Active Orders
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-700">{summary.active}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Total Spent
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {formatPrice(summary.spent)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Special Orders
                  </p>
                  <p className="mt-2 text-2xl font-bold text-amber-600">
                    {summary.bulk + summary.subscription + summary.bnpl}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <UserProfileCard />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((item) => (
            <div
              key={item.label}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
                {item.label}
              </p>
              <h2 className="mt-2 flex-1 text-lg font-bold text-slate-950">
                {item.title}
              </h2>
              <Link
                href={item.href}
                className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                {item.action}
              </Link>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Recent Orders</h2>
              <p className="mt-1 text-sm text-slate-500">Your latest activity at a glance.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {orders.length} orders
            </span>
          </div>

          {loading && orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">Loading orders...</p>
              <p className="mt-2 text-sm text-slate-500">Fetching your order history.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No orders yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Start shopping and your order history will appear here.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {orders.map((order) => {
                const status = normalizeStatus(order.status);
                const step = getStatusStep(order.status);
                const statusClass =
                  statusStyles[status] || "bg-slate-100 text-slate-700";

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
                          {order.is_bulk
                            ? "Bulk order"
                            : order.is_escrow
                              ? "Escrow order"
                            : order.is_bnpl
                              ? "BNPL order"
                            : order.is_subscription
                              ? "Subscription order"
                              : "Order"}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-950">
                          Order #{order.id}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(order.created_at)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
                      >
                        {formatStatus(order.status)}
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
                        <p className="text-slate-500">Items</p>
                        <p className="font-bold text-slate-950">
                          {order.items?.length || 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-start justify-between gap-2">
                        {steps.map((label, index) => (
                          <div key={label} className="flex-1 text-center">
                            <div
                              className={`h-2 rounded-full ${
                                index <= step ? "bg-green-700" : "bg-slate-200"
                              }`}
                            />
                            <p className="mt-2 text-[11px] text-slate-500">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-4">
                      {!order.is_escrow && (
                        <button
                          onClick={() => holdEscrow(order)}
                          className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                        >
                          Use Escrow
                        </button>
                      )}

                      {status !== "delivered" ? (
                        <Link
                          href={`/track/${order.id}`}
                          className="rounded-xl bg-green-700 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-green-800"
                        >
                          Track
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500"
                        >
                          Delivered
                        </button>
                      )}

                      <button
                        onClick={() => reorder(order)}
                        disabled={reorderingId === order.id}
                        className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {reorderingId === order.id ? "Adding..." : "Reorder"}
                      </button>

                      <button
                        onClick={() => openInvoice(order.id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Invoice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
