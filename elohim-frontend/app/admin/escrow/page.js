"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function AdminEscrowPage() {
  const [totals, setTotals] = useState({});
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEscrow();
  }, []);

  const heldPayments = useMemo(
    () => payments.filter((payment) => payment.status === "held"),
    [payments]
  );

  const fetchEscrow = async () => {
    try {
      setLoading(true);
      const res = await API.get("/escrow/admin/overview");
      setTotals(res.data?.totals || {});
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load escrow overview");
    } finally {
      setLoading(false);
    }
  };

  const releaseEscrow = async (payment) => {
    const confirmed = window.confirm(`Release ${formatPrice(payment.amount)} for order #${payment.order_id}?`);
    if (!confirmed) return;

    try {
      await API.post(`/escrow/${payment.id}/release`, {
        note: "Delivery confirmed by admin",
      });
      toast.success("Escrow released");
      fetchEscrow();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Release failed");
    }
  };

  const refundEscrow = async (payment) => {
    const confirmed = window.confirm(`Refund ${formatPrice(payment.amount)} to ${payment.user_name}?`);
    if (!confirmed) return;

    try {
      await API.post(`/escrow/${payment.id}/refund`, {
        note: "Escrow refunded by admin",
      });
      toast.success("Escrow refunded");
      fetchEscrow();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Refund failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Escrow Payments</h1>
          <p className="text-slate-500 mt-1">
            Protect large, interstate, and distributor transactions until delivery is confirmed.
          </p>
        </div>
        <button
          onClick={fetchEscrow}
          disabled={loading}
          className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Held Funds</p>
          <h2 className="text-xl font-bold text-amber-600">{formatPrice(totals.held_amount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Released</p>
          <h2 className="text-xl font-bold text-green-700">{formatPrice(totals.released_amount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Refunded</p>
          <h2 className="text-xl font-bold text-red-600">{formatPrice(totals.refunded_amount)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Awaiting Action</p>
          <h2 className="text-xl font-bold">{heldPayments.length}</h2>
        </div>
      </div>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Escrow Transactions</h2>
          <span className="text-sm text-gray-500">{payments.length} payment(s)</span>
        </div>

        {payments.length === 0 ? (
          <p className="text-gray-500">No escrow payments yet.</p>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <div key={payment.id} className="border rounded p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase">
                      Order #{payment.order_id}
                    </p>
                    <h3 className="font-bold text-lg">{payment.user_name}</h3>
                    <p className="text-sm text-gray-500">{payment.user_email}</p>
                    <p className="text-sm text-gray-600">Order status: {payment.order_status}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-bold text-xl">{formatPrice(payment.amount)}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${
                        payment.status === "held"
                          ? "bg-amber-100 text-amber-700"
                          : payment.status === "released"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                </div>

                {payment.release_note && (
                  <p className="text-sm text-gray-600 mt-3">{payment.release_note}</p>
                )}

                {payment.status === "held" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => releaseEscrow(payment)}
                      className="bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold"
                    >
                      Release After Delivery
                    </button>
                    <button
                      onClick={() => refundEscrow(payment)}
                      className="bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold"
                    >
                      Refund Customer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
