"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await API.get("/plans");
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("FETCH PLANS ERROR:", err);
      toast.error("Failed to load grain plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const totals = useMemo(() => {
    return plans.reduce(
      (acc, plan) => {
        const total = Number(plan.total_amount || 0);
        const paid = Number(plan.amount_paid || 0);

        acc.total += total;
        acc.paid += paid;
        acc.balance += Math.max(total - paid, 0);

        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );
  }, [plans]);

  const formatPrice = (value) =>
    `N${Number(value || 0).toLocaleString()}`;

  const formatFrequency = (value) => {
    if (!value) return "Monthly";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const pay = async (id) => {
    const amount = prompt("Enter amount");
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return toast.error("Enter a valid amount");
    }

    try {
      await API.post(`/plans/${id}/pay`, { amount: paymentAmount });
      toast.success("Payment added");
      fetchPlans();
    } catch (err) {
      console.error("PLAN PAYMENT ERROR:", err);
      toast.error("Payment failed");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Grain Plans</h1>
          <p className="text-sm text-gray-500">
            Track customer grain savings plans and payments.
          </p>
        </div>

        <button
          onClick={fetchPlans}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Total Value</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.total)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Amount Paid</p>
          <h2 className="text-xl font-bold text-green-700">
            {formatPrice(totals.paid)}
          </h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-500">Outstanding</p>
          <h2 className="text-xl font-bold text-orange-600">
            {formatPrice(totals.balance)}
          </h2>
        </div>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && plans.length === 0 && (
        <div className="bg-white p-4 rounded shadow">
          No grain plans found.
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const total = Number(plan.total_amount || 0);
          const paid = Number(plan.amount_paid || 0);
          const balance = Math.max(total - paid, 0);
          const isComplete = balance <= 0;

          return (
            <div key={plan.id} className="bg-white p-4 rounded shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold">
                    {plan.product_name}
                    {plan.variant_weight ? ` - ${plan.variant_weight}` : ""}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {plan.user_name} ({plan.user_email})
                  </p>
                  <p className="mt-2">Quantity: {plan.quantity}</p>
                  <p>Duration: {plan.duration} months</p>
                  <p>Payment: {formatFrequency(plan.payment_frequency)}</p>
                </div>

                <span
                  className={`px-2 py-1 rounded text-xs ${
                    isComplete
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {isComplete ? "Completed" : "Active"}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
                <p>Total: {formatPrice(total)}</p>
                <p>Paid: {formatPrice(paid)}</p>
                <p>Balance: {formatPrice(balance)}</p>
              </div>

              <button
                onClick={() => pay(plan.id)}
                className="mt-3 bg-blue-600 text-white px-3 py-1 rounded"
              >
                Add Payment
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
