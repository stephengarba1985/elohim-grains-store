"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not available";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminPaymentsPage() {
  const [totals, setTotals] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await API.get("/payment-gateways/admin/overview");
      setTotals(res.data?.totals || {});
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const verifyTransaction = async (transaction) => {
    try {
      await API.post("/payment-gateways/verify", { reference: transaction.reference });
      toast.success("Payment verified");
      fetchPayments();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Verification failed");
    }
  };

  const copyReference = async (reference) => {
    try {
      await navigator.clipboard.writeText(reference || "");
      toast.success("Reference copied");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const exportExcel = () => {
    const rows = [
      ["Reference", "Customer", "Email", "Gateway", "Channel", "Status", "Amount", "Date"],
      ...filteredTransactions.map((t) => [
        t.reference || "",
        t.user_name || "",
        t.user_email || "",
        t.provider || "",
        t.channel || "",
        t.status || "",
        Number(t.amount || 0),
        formatDate(t.created_at),
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    window.print();
  };

  const printPage = () => {
    window.print();
  };

  const statusBadgeClass = (status) => {
    switch (String(status || "").toLowerCase()) {
      case "verified":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const today = new Date();
  const toNumber = (value) => Number(value || 0);

  const computed = {
    revenueToday: transactions
      .filter((t) => new Date(t.created_at).toDateString() === today.toDateString())
      .reduce((sum, t) => sum + toNumber(t.amount), 0),
    revenueThisMonth: transactions
      .filter((t) => {
        const d = new Date(t.created_at);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((sum, t) => sum + toNumber(t.amount), 0),
    verifiedAmount: transactions
      .filter((t) => String(t.status).toLowerCase() === "verified")
      .reduce((sum, t) => sum + toNumber(t.amount), 0),
    pendingAmount: transactions
      .filter((t) => String(t.status).toLowerCase() === "pending")
      .reduce((sum, t) => sum + toNumber(t.amount), 0),
    transactions: transactions.length,
    verified: transactions.filter((t) => String(t.status).toLowerCase() === "verified").length,
    pending: transactions.filter((t) => String(t.status).toLowerCase() === "pending").length,
    failed: transactions.filter((t) => String(t.status).toLowerCase() === "failed").length,
  };

  const summary = {
    revenueToday: toNumber(totals.revenue_today ?? computed.revenueToday),
    revenueThisMonth: toNumber(totals.revenue_this_month ?? computed.revenueThisMonth),
    verifiedAmount: toNumber(totals.verified_amount ?? computed.verifiedAmount),
    pendingAmount: toNumber(totals.pending_amount ?? computed.pendingAmount),
    transactions: toNumber(totals.transactions ?? computed.transactions),
    verified: toNumber(totals.verified ?? computed.verified),
    pending: toNumber(totals.pending ?? computed.pending),
    failed: toNumber(totals.failed ?? computed.failed),
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const keyword = search.toLowerCase();
    const gateway = String(transaction.provider || "").toLowerCase();
    const status = String(transaction.status || "").toLowerCase();

    const matchesSearch =
      String(transaction.reference || "").toLowerCase().includes(keyword) ||
      String(transaction.user_name || "").toLowerCase().includes(keyword) ||
      String(transaction.user_email || "").toLowerCase().includes(keyword) ||
      gateway.includes(keyword);

    const matchesGateway = gatewayFilter === "all" || gateway === gatewayFilter;
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesGateway && matchesStatus;
  });

  const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekdayRevenue = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  transactions.forEach((t) => {
    const day = new Date(t.created_at).toLocaleDateString("en-US", { weekday: "long" });
    if (weekdayRevenue[day] !== undefined) {
      weekdayRevenue[day] += toNumber(t.amount);
    }
  });

  const revenueTrendData = weekdayOrder.map((day) => ({
    day,
    revenue: weekdayRevenue[day],
  }));

  const gatewayCounts = {
    Paystack: 0,
    Flutterwave: 0,
    Monnify: 0,
    Opay: 0,
  };

  transactions.forEach((t) => {
    const provider = String(t.provider || "").toLowerCase();
    if (provider === "paystack") gatewayCounts.Paystack += 1;
    if (provider === "flutterwave") gatewayCounts.Flutterwave += 1;
    if (provider === "monnify") gatewayCounts.Monnify += 1;
    if (provider === "opay") gatewayCounts.Opay += 1;
  });

  const totalGatewayTx = Object.values(gatewayCounts).reduce((sum, value) => sum + value, 0);
  const gatewayPieData = Object.entries(gatewayCounts).map(([name, value]) => ({ name, value }));
  const pieColors = ["#16a34a", "#2563eb", "#9333ea", "#f97316"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Payment Gateways</h1>
          <p className="text-slate-500 mt-1">
            Monitor Paystack, Flutterwave, Monnify, Opay transfer, virtual account, bank transfer, and USSD payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="bg-emerald-700 text-white px-4 py-2 rounded font-semibold"
          >
            Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="bg-sky-700 text-white px-4 py-2 rounded font-semibold"
          >
            Export PDF
          </button>
          <button
            onClick={printPage}
            className="bg-slate-700 text-white px-4 py-2 rounded font-semibold"
          >
            Print
          </button>
          <button
            onClick={fetchPayments}
            disabled={loading}
            className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Revenue Today</p>
          <h2 className="text-xl font-bold text-green-700">{formatPrice(summary.revenueToday)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Revenue This Month</p>
          <h2 className="text-xl font-bold text-emerald-700">{formatPrice(summary.revenueThisMonth)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Verified Amount</p>
          <h2 className="text-xl font-bold text-green-700">{formatPrice(summary.verifiedAmount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Pending Amount</p>
          <h2 className="text-xl font-bold text-amber-600">{formatPrice(summary.pendingAmount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Transactions</p>
          <h2 className="text-2xl font-bold">{summary.transactions}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Verified</p>
          <h2 className="text-xl font-bold">{summary.verified}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Pending</p>
          <h2 className="text-xl font-bold">{summary.pending}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Failed</p>
          <h2 className="text-xl font-bold text-red-700">{summary.failed}</h2>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white p-5 rounded shadow">
          <h2 className="font-bold text-lg mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => formatPrice(value)} />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="bg-white p-5 rounded shadow">
          <h2 className="font-bold text-lg mb-4">Gateway Share</h2>
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={gatewayPieData} dataKey="value" nameKey="name" outerRadius={90}>
                  {gatewayPieData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2 text-sm">
              {gatewayPieData.map((item) => {
                const percent = totalGatewayTx === 0
                  ? 0
                  : Math.round((item.value / totalGatewayTx) * 100);

                return (
                  <p key={item.name} className="text-gray-700">
                    {item.name} {percent}%
                  </p>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white p-5 rounded shadow">

        <div className="grid md:grid-cols-4 gap-3 mb-5">

          <input
            type="text"
            placeholder="Search reference, customer or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg p-3"
          />

          <select
            value={gatewayFilter}
            onChange={(e) => setGatewayFilter(e.target.value)}
            className="border rounded-lg p-3"
          >
            <option value="all">All Gateways</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
            <option value="monnify">Monnify</option>
            <option value="opay">OPay</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg p-3"
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <div className="flex gap-2">

            <button
              onClick={exportExcel}
              className="flex-1 bg-green-700 text-white rounded-lg"
            >
              Export Excel
            </button>

            <button
              onClick={exportPdf}
              className="flex-1 bg-red-700 text-white rounded-lg"
            >
              Export PDF
            </button>

          </div>

        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Gateway Transactions</h2>
          <span className="text-sm text-gray-500">{filteredTransactions.length} recent</span>
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="text-gray-500">No gateway transactions yet.</p>
        ) : (
          <div className="grid gap-4">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="border rounded p-4 hover:border-green-300 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase">
                      {formatLabel(transaction.provider)} • {formatLabel(transaction.channel)}
                    </p>
                    <h3 className="font-bold text-lg mt-1">{transaction.reference}</h3>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          copyReference(transaction.reference);
                        }}
                        className="text-xs bg-gray-100 px-2 py-1 rounded"
                      >
                        Copy Reference
                      </button>

                      <button
                        onClick={() => setSelectedTransaction(transaction)}
                        className="text-blue-600 underline text-sm"
                      >
                        View Details
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">
                      {transaction.user_name || "Unknown user"} ({transaction.user_email || "No email"})
                    </p>
                    <p className="text-sm text-gray-500">{formatDate(transaction.created_at)}</p>
                  </div>
                  <div className="lg:text-right">
                    <p className="text-xl font-bold">{formatPrice(transaction.amount)}</p>
                    <span
                      className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
                        statusBadgeClass(transaction.status)
                      }`}
                    >
                      {formatLabel(transaction.status)}
                    </span>
                  </div>
                </div>

                {transaction.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={(e) => {
                        verifyTransaction(transaction);
                      }}
                      className="bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold"
                    >
                      Mark Verified
                    </button>

                    <button
                      onClick={(e) => {
                        toast("Refund action coming soon");
                      }}
                      className="bg-purple-700 text-white px-3 py-2 rounded text-sm font-semibold"
                    >
                      Refund
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl">

            <h2 className="text-xl font-bold mb-4">
              Payment Details
            </h2>

            <p><b>Reference:</b> {selectedTransaction.reference}</p>

            <p><b>Gateway:</b> {formatLabel(selectedTransaction.provider)}</p>

            <p><b>Channel:</b> {formatLabel(selectedTransaction.channel)}</p>

            <p><b>Customer:</b> {selectedTransaction.user_name}</p>

            <p><b>Email:</b> {selectedTransaction.user_email}</p>

            <p><b>Amount:</b> {formatPrice(selectedTransaction.amount)}</p>

            <p><b>Status:</b> {selectedTransaction.status}</p>

            <p><b>Created:</b> {formatDate(selectedTransaction.created_at)}</p>

            {selectedTransaction.verified_at && (

              <p>

                <b>Verified:</b> {formatDate(selectedTransaction.verified_at)}

              </p>

            )}

            <div className="flex justify-end mt-6">

              <button
                onClick={() => setSelectedTransaction(null)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >

                Close

              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
