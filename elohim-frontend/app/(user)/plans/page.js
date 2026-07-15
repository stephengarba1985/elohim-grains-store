"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import Link from "next/link";
import toast from "react-hot-toast";

const PAYMENT_FREQUENCIES = [
  { value: "daily", label: "Daily contribution", periodsPerMonth: 30 },
  { value: "weekly", label: "Weekly contribution", periodsPerMonth: 4 },
  { value: "monthly", label: "Monthly contribution", periodsPerMonth: 1 },
];

const DURATIONS = [
  { value: "1", label: "1 Month" },
  { value: "3", label: "3 Months" },
  { value: "6", label: "6 Months" },
  { value: "12", label: "12 Months" },
];

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "After plan duration";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getPaymentEstimate = (total, duration, frequency) => {
  const selected = PAYMENT_FREQUENCIES.find((item) => item.value === frequency);
  const months = Number(duration || 0);
  const amount = Number(total || 0);

  if (!selected || !months || !amount) return 0;

  const paymentCount = Math.max(1, Math.ceil(months * selected.periodsPerMonth));
  return amount / paymentCount;
};

const getNextPaymentAmount = (total, paid, duration, frequency) => {
  const balance = Math.max(Number(total || 0) - Number(paid || 0), 0);
  const estimate = getPaymentEstimate(total, duration, frequency);

  if (!balance) return 0;
  if (!estimate) return balance;

  return Math.min(balance, estimate);
};

const formatFrequency = (value) => {
  if (!value) return "Monthly";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getMaturityDate = (duration) => {
  const date = new Date();
  date.setMonth(date.getMonth() + Number(duration || 0));
  return date;
};

const getRewardRate = (duration) => {
  const months = Number(duration || 0);

  if (months >= 6) return 0.05;
  if (months >= 3) return 0.03;

  return 0.02;
};

export default function GrainPlansPage() {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const [form, setForm] = useState({
    product_id: "",
    variant_id: "",
    quantity: "",
    duration: "1",
    payment_frequency: "weekly",
    auto_debit_enabled: true,
  });

  useEffect(() => {
    fetchProducts();

    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        toast.error("Please log in to manage plans");
      }
    } catch (err) {
      console.error("USER READ ERROR:", err);
      toast.error("Failed to read user session");
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchPlans(user.id);
      fetchWallet(user.id);
    }
  }, [user]);

  const selectedProduct = useMemo(() => {
    return products.find((product) => String(product.id) === String(form.product_id));
  }, [products, form.product_id]);

  const variants = selectedProduct?.variants || [];

  const selectedVariant = useMemo(() => {
    return variants.find((variant) => String(variant.id) === String(form.variant_id));
  }, [variants, form.variant_id]);

  const selectedPrice = Number(selectedVariant?.price || selectedProduct?.price || 0);
  const totalAmount = selectedPrice * Number(form.quantity || 0);
  const estimatedPayment = getPaymentEstimate(
    totalAmount,
    form.duration,
    form.payment_frequency
  );
  const estimatedReward = totalAmount * getRewardRate(form.duration);
  const estimatedMaturityDate = getMaturityDate(form.duration);

  const planSummary = useMemo(() => {
    return plans.reduce(
      (summary, plan) => {
        const total = Number(plan.total_amount || 0);
        const paid = Number(plan.amount_paid || 0);

        summary.total += total;
        summary.paid += paid;
        summary.balance += Math.max(total - paid, 0);

        if (total > 0 && paid >= total) {
          summary.completed += 1;
        }

        return summary;
      },
      { total: 0, paid: 0, balance: 0, completed: 0 }
    );
  }, [plans]);

  const fetchPlans = async (userId = user?.id) => {
    if (!userId) return;

    try {
      const res = await API.get(`/plans/user/${userId}`);
      setPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load plans");
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  const fetchWallet = async (userId = user?.id) => {
    if (!userId) return;

    try {
      const res = await API.get(`/wallet/${userId}`);
      setWalletBalance(Number(res.data?.balance || 0));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load wallet balance");
    }
  };

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const resetForm = () => {
    setEditingPlanId(null);
    setForm({
      product_id: "",
      variant_id: "",
      quantity: "",
      duration: "1",
      payment_frequency: "weekly",
      auto_debit_enabled: true,
    });
  };

  const savePlan = async () => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    if (!form.product_id || !form.quantity || !form.duration || !form.payment_frequency) {
      return toast.error("Select a product, quantity, duration, and payment frequency");
    }

    if (variants.length > 0 && !form.variant_id) {
      return toast.error("Select a product variant");
    }

    try {
      const payload = {
        user_id: user.id,
        product_id: form.product_id,
        variant_id: form.variant_id || null,
        quantity: form.quantity,
        duration: form.duration,
        payment_frequency: form.payment_frequency,
        auto_debit_enabled: form.auto_debit_enabled,
      };

      if (editingPlanId) {
        await API.put(`/plans/${editingPlanId}`, payload);
        toast.success("Plan updated");
      } else {
        await API.post("/plans", payload);
        toast.success("Plan created");
      }

      resetForm();
      fetchPlans(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to save plan");
    }
  };

  const editPlan = (plan) => {
    setEditingPlanId(plan.id);
    setForm({
      product_id: String(plan.product_id || ""),
      variant_id: plan.variant_id ? String(plan.variant_id) : "",
      quantity: String(plan.quantity || ""),
      duration: String(plan.duration || "1"),
      payment_frequency: plan.payment_frequency || "weekly",
      auto_debit_enabled: Boolean(plan.auto_debit_enabled ?? true),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const emergencyWithdraw = async (plan) => {
    const paid = Number(plan.amount_paid || 0);
    const maturityDate = plan.maturity_date ? new Date(plan.maturity_date) : null;
    const isMature = maturityDate ? maturityDate <= new Date() : false;
    const penaltyRate = isMature ? 0 : Number(plan.penalty_rate || 0.1);
    const penalty = paid * penaltyRate;
    const refund = Math.max(paid - penalty, 0);
    const confirmed = window.confirm(
      `Emergency withdraw from ${plan.product_name || "this plan"}?\n\nRefund: ${formatPrice(refund)}\nPenalty: ${formatPrice(penalty)}\n\nThis will close the locked savings plan.`
    );

    if (!confirmed) return;

    try {
      await API.delete(`/plans/${plan.id}`);
      toast.success("Emergency withdrawal processed");

      if (editingPlanId === plan.id) {
        resetForm();
      }

      if (Number(plan.amount_paid || 0) > 0) {
        toast.success("Paid amount refunded to wallet");
        fetchWallet(user?.id);
      }

      fetchPlans(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Emergency withdrawal failed");
    }
  };

  const runAutoDebit = async (plan) => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    try {
      const res = await API.post(`/plans/${plan.id}/auto-debit`);
      const amount = Number(res.data?.amount || 0);
      const reward = Number(res.data?.reward_amount || 0);

      toast.success(
        reward > 0
          ? `Auto debit saved ${formatPrice(amount)} and paid ${formatPrice(reward)} bonus`
          : `Auto debit saved ${formatPrice(amount)}`
      );
      fetchPlans(user.id);
      fetchWallet(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Auto debit failed");
    }
  };

  const pay = async (plan, paymentSource = "external") => {
    const total = Number(plan.total_amount || 0);
    const paid = Number(plan.amount_paid || 0);
    const balance = Math.max(total - paid, 0);
    const nextAmount = getNextPaymentAmount(
      total,
      paid,
      plan.duration,
      plan.payment_frequency || "monthly"
    );

    if (balance <= 0) {
      return toast.success("This plan is already fully paid");
    }

    const amount = prompt(
      `Next payment amount: ${formatPrice(nextAmount)}\nRemaining balance: ${formatPrice(balance)}\n\nEnter amount to pay:`,
      String(Math.ceil(nextAmount))
    );
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return toast.error("Enter a valid amount");
    }

    if (paymentAmount > balance) {
      return toast.error(`Amount cannot be more than ${formatPrice(balance)}`);
    }

    if (paymentSource === "wallet" && paymentAmount > walletBalance) {
      return toast.error("Insufficient wallet balance");
    }

    try {
      const res = await API.post(`/plans/${plan.id}/pay`, {
        amount: paymentAmount,
        payment_source: paymentSource,
      });

      const reward = Number(res.data?.reward_amount || 0);

      toast.success(
        reward > 0
          ? `Plan completed. ${formatPrice(reward)} reward added to wallet`
          : paymentSource === "wallet"
            ? "Auto-save payment added"
            : "Payment added"
      );
      fetchPlans(user?.id);
      fetchWallet(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Payment failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-start">
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Grain Savings
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Smart grain savings plans
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Save daily, weekly, or monthly toward a grain goal with wallet auto-debit, locked savings, emergency withdrawal, and completion rewards.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Link
              href="/user/wallet"
              className="bg-slate-950 text-white rounded-lg px-4 py-3 shadow-sm"
            >
              <p className="text-xs text-slate-300">Wallet</p>
              <p className="text-xl font-bold">{formatPrice(walletBalance)}</p>
            </Link>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Plans</p>
              <p className="text-xl font-bold text-slate-950">{plans.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-xl font-bold text-green-700">{planSummary.completed}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Paid</p>
              <p className="text-xl font-bold text-slate-950">{formatPrice(planSummary.paid)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">Balance</p>
              <p className="text-xl font-bold text-orange-600">{formatPrice(planSummary.balance)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-green-700 px-5 py-4 text-white">
            <h2 className="text-lg font-bold">
              {editingPlanId ? "Edit Plan" : "Start New Plan"}
            </h2>
            <p className="text-sm text-green-50 mt-1">
              {editingPlanId
                ? "Update the product, schedule, or quantity for this plan."
                : "Example: save NGN 5,000 weekly for 6 months and receive your target bags at maturity."}
            </p>
          </div>

          <div className="p-5">
            <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Product</span>
            <select
              value={form.product_id}
              onChange={(e) =>
                updateForm({ product_id: e.target.value, variant_id: "" })
              }
              className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Select Product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Variant</span>
            <select
              value={form.variant_id}
              onChange={(e) => updateForm({ variant_id: e.target.value })}
              disabled={!selectedProduct || variants.length === 0}
              className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">
                {variants.length > 0 ? "Select Variant" : "Default product"}
              </option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.weight} - {formatPrice(variant.price)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <input
              placeholder="Quantity"
              type="number"
              min="1"
              className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
              value={form.quantity}
              onChange={(e) => updateForm({ quantity: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Duration</span>
            <select
              value={form.duration}
              onChange={(e) => updateForm({ duration: e.target.value })}
              className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {DURATIONS.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Plan Type</span>
            <select
              value={form.payment_frequency}
              onChange={(e) => updateForm({ payment_frequency: e.target.value })}
              className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {PAYMENT_FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 border border-slate-200 rounded-lg p-3 mt-6 bg-slate-50">
            <input
              type="checkbox"
              checked={form.auto_debit_enabled}
              onChange={(e) => updateForm({ auto_debit_enabled: e.target.checked })}
              className="h-4 w-4 accent-green-700"
            />
            <span className="text-sm font-medium text-slate-700">Auto debit</span>
          </label>
            </div>

            <div className="mt-5 grid md:grid-cols-5 gap-4 text-sm">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Unit Price</p>
                <p className="text-xl font-bold text-slate-950 mt-1">{formatPrice(selectedPrice)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Plan Total</p>
                <p className="text-xl font-bold text-slate-950 mt-1">{formatPrice(totalAmount)}</p>
              </div>
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <p className="text-green-700">Estimated Each Payment</p>
                <p className="text-xl font-bold text-green-800 mt-1">
                  {formatPrice(estimatedPayment)}
                </p>
              </div>
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <p className="text-amber-700">Reward Bonus</p>
                <p className="text-xl font-bold text-amber-700 mt-1">
                  {formatPrice(estimatedReward)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Maturity</p>
                <p className="text-lg font-bold text-slate-950 mt-1">
                  {formatDate(estimatedMaturityDate)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-slate-500">
                Locked until maturity. Emergency withdrawal attracts a 10% penalty before maturity.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={savePlan}
                  className="bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
                >
                  {editingPlanId ? "Update Plan" : "Create Plan"}
                </button>
                {editingPlanId && (
                  <button
                    onClick={resetForm}
                    className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-3 rounded-lg font-semibold"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-slate-950">Your Plans</h2>
            <button
              onClick={() => fetchPlans(user?.id)}
              className="text-sm font-semibold text-green-700 hover:text-green-800"
            >
              Refresh
            </button>
          </div>

          {plans.length === 0 && (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No plans yet</p>
              <p className="text-slate-500 mt-2">
                Create your first grain savings plan using the form above.
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {plans.map((plan) => {
          const total = Number(plan.total_amount || 0);
          const paid = Number(plan.amount_paid || 0);
          const balance = Math.max(total - paid, 0);
          const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          const isComplete = progress >= 100;
          const maturityDate = plan.maturity_date
            ? new Date(plan.maturity_date)
            : getMaturityDate(plan.duration);
          const isMature = maturityDate <= new Date();
          const isLocked = !isMature && !isComplete;
          const rewardRate = Number(plan.reward_rate || getRewardRate(plan.duration));
          const rewardAmount = Number(plan.reward_amount || 0);
          const estimatedRewardAmount = Math.round(total * rewardRate * 100) / 100;
          const penaltyAmount = isMature ? 0 : Math.round(paid * Number(plan.penalty_rate || 0.1) * 100) / 100;
          const estimated = getPaymentEstimate(
            total,
            plan.duration,
            plan.payment_frequency || "monthly"
          );
          const nextPayment = getNextPaymentAmount(
            total,
            paid,
            plan.duration,
            plan.payment_frequency || "monthly"
          );

          return (
            <div key={plan.id} className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    {formatFrequency(plan.plan_type || plan.payment_frequency || "monthly")} savings plan
                  </p>
                  <h3 className="text-lg font-bold text-slate-950 mt-1">
                    {plan.product_name}
                    {plan.variant_weight ? ` - ${plan.variant_weight}` : ""}
                  </h3>

                  <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                    <p>Quantity: {plan.quantity}</p>
                    <p>Duration: {plan.duration} months</p>
                    <p>Auto debit: {plan.auto_debit_enabled ? "Enabled" : "Paused"}</p>
                    <p>Each payment: {formatPrice(estimated)}</p>
                    <p>Next payment: {formatPrice(nextPayment)}</p>
                    <p>Maturity: {formatDate(maturityDate)}</p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isComplete
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isComplete ? "Completed" : isLocked ? "Locked" : "Mature"}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">Progress</span>
                  <span className="font-semibold text-slate-950">{progress}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-700 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-bold text-slate-950">{formatPrice(total)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Paid</p>
                  <p className="font-bold text-green-700">{formatPrice(paid)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-bold text-orange-600">{formatPrice(balance)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Reward</p>
                  <p className="font-bold text-amber-600">
                    {formatPrice(rewardAmount || estimatedRewardAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Penalty</p>
                  <p className="font-bold text-red-600">{formatPrice(penaltyAmount)}</p>
                </div>
              </div>

              <div className="mt-5 grid sm:grid-cols-5 gap-2">
                <button
                  onClick={() => runAutoDebit(plan)}
                  disabled={isComplete || !plan.auto_debit_enabled}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold"
                >
                  Auto Debit
                </button>
                <button
                  onClick={() => pay(plan, "wallet")}
                  disabled={isComplete}
                  className="bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold"
                >
                  {isComplete ? "Fully Paid" : "Pay Wallet"}
                </button>
                <button
                  onClick={() => pay(plan, "external")}
                  disabled={isComplete}
                  className="bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold"
                >
                  {isComplete ? "Complete" : `Record ${formatPrice(nextPayment)}`}
                </button>
                <button
                  onClick={() => editPlan(plan)}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-3 rounded-lg font-semibold"
                >
                  Edit
                </button>
                <button
                  onClick={() => emergencyWithdraw(plan)}
                  className="border border-red-200 text-red-700 hover:bg-red-50 px-4 py-3 rounded-lg font-semibold"
                >
                  Emergency
                </button>
              </div>
            </div>
          );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
