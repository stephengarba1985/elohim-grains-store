"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Payment Gateways</h1>
          <p className="text-slate-500 mt-1">
            Monitor Paystack, Flutterwave, Monnify, Opay transfer, virtual account, bank transfer, and USSD payments.
          </p>
        </div>
        <button
          onClick={fetchPayments}
          disabled={loading}
          className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Verified Amount</p>
          <h2 className="text-xl font-bold text-green-700">{formatPrice(totals.verified_amount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Pending Amount</p>
          <h2 className="text-xl font-bold text-amber-600">{formatPrice(totals.pending_amount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Verified</p>
          <h2 className="text-xl font-bold">{totals.verified || 0}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Pending</p>
          <h2 className="text-xl font-bold">{totals.pending || 0}</h2>
        </div>
      </div>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Gateway Transactions</h2>
          <span className="text-sm text-gray-500">{transactions.length} recent</span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-gray-500">No gateway transactions yet.</p>
        ) : (
          <div className="grid gap-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="border rounded p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase">
                      {formatLabel(transaction.provider)} • {formatLabel(transaction.channel)}
                    </p>
                    <h3 className="font-bold text-lg mt-1">{transaction.reference}</h3>
                    <p className="text-sm text-gray-600">
                      {transaction.user_name || "Unknown user"} ({transaction.user_email || "No email"})
                    </p>
                    <p className="text-sm text-gray-500">{formatDate(transaction.created_at)}</p>
                  </div>
                  <div className="lg:text-right">
                    <p className="text-xl font-bold">{formatPrice(transaction.amount)}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${
                        transaction.status === "verified"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </div>
                </div>

                {(transaction.account_number || transaction.ussd_code) && (
                  <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm bg-slate-50 rounded p-3">
                    {transaction.bank_name && (
                      <p>Bank: <b>{transaction.bank_name}</b></p>
                    )}
                    {transaction.account_number && (
                      <p>Account: <b>{transaction.account_number}</b></p>
                    )}
                    {transaction.ussd_code && (
                      <p>USSD: <b>{transaction.ussd_code}</b></p>
                    )}
                  </div>
                )}

                {transaction.status === "pending" && (
                  <button
                    onClick={() => verifyTransaction(transaction)}
                    className="mt-4 bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold"
                  >
                    Mark Verified
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
