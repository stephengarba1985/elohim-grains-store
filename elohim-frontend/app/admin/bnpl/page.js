"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getScoreClass = (score) => {
  if (Number(score) >= 720) return "text-green-700";
  if (Number(score) >= 620) return "text-emerald-700";
  if (Number(score) >= 520) return "text-amber-600";
  return "text-red-600";
};

export default function AdminBnplPage() {
  const [totals, setTotals] = useState({});
  const [agreements, setAgreements] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBnplOverview();
  }, []);

  const overdueCount = useMemo(
    () => reminders.filter((item) => item.overdue).length,
    [reminders]
  );

  const fetchBnplOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/bnpl/admin/overview");
      setTotals(res.data?.totals || {});
      setAgreements(Array.isArray(res.data?.agreements) ? res.data.agreements : []);
      setReminders(Array.isArray(res.data?.reminders) ? res.data.reminders : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load BNPL overview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">BNPL Admin</h1>
          <p className="text-slate-500 mt-1">
            Track collect-now-pay-later orders, guarantors, credit scores, reminders, and repayments.
          </p>
        </div>
        <button
          onClick={fetchBnplOverview}
          disabled={loading}
          className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">BNPL Credit</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.total_credit)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Outstanding</p>
          <h2 className="text-xl font-bold text-orange-600">{formatPrice(totals.outstanding)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Active Agreements</p>
          <h2 className="text-xl font-bold">{totals.active || 0}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Overdue Reminders</p>
          <h2 className="text-xl font-bold text-red-600">{overdueCount}</h2>
        </div>
      </div>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Payment Reminders</h2>
          <span className="text-sm text-gray-500">{reminders.length} reminder(s)</span>
        </div>

        {reminders.length === 0 ? (
          <p className="text-gray-500">No BNPL reminders yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.agreement_id}
                className={`border rounded p-4 ${
                  reminder.overdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{reminder.user_name}</p>
                    <p className="text-sm text-gray-600">{reminder.product_name}</p>
                    <p className="text-sm text-gray-500">{reminder.user_email}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      reminder.overdue ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {reminder.overdue ? "Overdue" : "Upcoming"}
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span>Due: {formatDate(reminder.due_date)}</span>
                  <span className="font-bold">{formatPrice(reminder.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">BNPL Agreements</h2>
          <span className="text-sm text-gray-500">{agreements.length} agreement(s)</span>
        </div>

        {agreements.length === 0 ? (
          <p className="text-gray-500">No BNPL agreements yet.</p>
        ) : (
          <div className="grid gap-4">
            {agreements.map((agreement) => {
              const total = Number(agreement.total_amount || 0);
              const paid = Number(agreement.amount_paid || 0);
              const balance = Math.max(total - paid, 0);
              const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              const overdue = agreement.next_due_date && new Date(agreement.next_due_date) < new Date();

              return (
                <div key={agreement.id} className="border rounded p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase">
                        Agreement #{agreement.id} • Order #{agreement.order_id}
                      </p>
                      <h3 className="font-bold text-lg mt-1">
                        {agreement.product_name}
                        {agreement.variant_weight ? ` - ${agreement.variant_weight}` : ""}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Customer: {agreement.user_name} ({agreement.user_email})
                      </p>
                      <p className="text-sm text-gray-600">
                        Guarantor: {agreement.guarantor_name} • {agreement.guarantor_phone}
                        {agreement.guarantor_relationship ? ` • ${agreement.guarantor_relationship}` : ""}
                      </p>
                    </div>
                    <div className="text-sm lg:text-right">
                      <p className={`font-bold ${getScoreClass(agreement.credit_score)}`}>
                        Credit Score: {agreement.credit_score}
                      </p>
                      <p className={overdue ? "text-red-600 font-semibold" : "text-gray-600"}>
                        Next Due: {formatDate(agreement.next_due_date)}
                      </p>
                      <p className="text-gray-600">Status: {agreement.status}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Repayment Progress</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-700" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-bold">{formatPrice(total)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Paid</p>
                      <p className="font-bold text-green-700">{formatPrice(paid)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Balance</p>
                      <p className="font-bold text-orange-600">{formatPrice(balance)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Installment</p>
                      <p className="font-bold">{formatPrice(agreement.installment_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Frequency</p>
                      <p className="font-bold capitalize">{agreement.frequency}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
