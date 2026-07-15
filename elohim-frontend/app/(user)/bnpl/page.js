"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const DURATIONS = [
  { value: "1", label: "1 Month" },
  { value: "2", label: "2 Months" },
  { value: "3", label: "3 Months" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly", periodsPerMonth: 4 },
  { value: "monthly", label: "Monthly", periodsPerMonth: 1 },
];

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getInstallment = (total, duration, frequency) => {
  const selected = FREQUENCIES.find((item) => item.value === frequency);
  const periods = Math.max(1, Math.ceil(Number(duration || 0) * (selected?.periodsPerMonth || 1)));

  return Math.ceil(Number(total || 0) / periods);
};

const getCreditBand = (score) => {
  if (score >= 720) return { label: "Excellent", className: "text-green-700" };
  if (score >= 620) return { label: "Good", className: "text-emerald-700" };
  if (score >= 520) return { label: "Eligible", className: "text-amber-600" };

  return { label: "Needs history", className: "text-red-600" };
};

export default function BnplPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [creditScore, setCreditScore] = useState(600);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    variant_id: "",
    quantity: "1",
    duration_months: "2",
    frequency: "weekly",
    guarantor_name: "",
    guarantor_phone: "",
    guarantor_relationship: "",
  });

  useEffect(() => {
    fetchProducts();

    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please log in to use BNPL");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchBnpl(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((product) => String(product.id) === String(form.product_id));
  }, [products, form.product_id]);

  const variants = selectedProduct?.variants || [];

  const selectedVariant = useMemo(() => {
    return variants.find((variant) => String(variant.id) === String(form.variant_id));
  }, [variants, form.variant_id]);

  const unitPrice = Number(selectedVariant?.price || selectedProduct?.price || 0);
  const totalAmount = unitPrice * Number(form.quantity || 0);
  const installment = getInstallment(totalAmount, form.duration_months, form.frequency);
  const creditBand = getCreditBand(creditScore);

  const summary = useMemo(() => {
    return agreements.reduce(
      (total, agreement) => {
        const amount = Number(agreement.total_amount || 0);
        const paid = Number(agreement.amount_paid || 0);

        total.active += agreement.status === "active" ? 1 : 0;
        total.completed += agreement.status === "completed" ? 1 : 0;
        total.outstanding += Math.max(amount - paid, 0);

        return total;
      },
      { active: 0, completed: 0, outstanding: 0 }
    );
  }, [agreements]);

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  const fetchBnpl = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/bnpl/user/${userId}`);
      setCreditScore(Number(res.data?.credit_score || 600));
      setAgreements(Array.isArray(res.data?.agreements) ? res.data.agreements : []);
      setReminders(Array.isArray(res.data?.reminders) ? res.data.reminders : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load BNPL");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const submitBnpl = async () => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    if (!form.product_id || !form.quantity || !form.guarantor_name || !form.guarantor_phone) {
      return toast.error("Select product and enter guarantor details");
    }

    if (variants.length > 0 && !form.variant_id) {
      return toast.error("Select a product variant");
    }

    try {
      setLoading(true);
      await API.post("/bnpl", {
        user_id: user.id,
        product_id: form.product_id,
        variant_id: form.variant_id || null,
        quantity: form.quantity,
        duration_months: form.duration_months,
        frequency: form.frequency,
        guarantor_name: form.guarantor_name,
        guarantor_phone: form.guarantor_phone,
        guarantor_relationship: form.guarantor_relationship,
      });

      toast.success("BNPL approved. Order created for collection");
      setForm({
        product_id: "",
        variant_id: "",
        quantity: "1",
        duration_months: "2",
        frequency: "weekly",
        guarantor_name: "",
        guarantor_phone: "",
        guarantor_relationship: "",
      });
      fetchBnpl(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "BNPL request failed");
    } finally {
      setLoading(false);
    }
  };

  const payInstallment = async (agreement) => {
    const balance = Math.max(Number(agreement.total_amount || 0) - Number(agreement.amount_paid || 0), 0);
    const amount = prompt(
      `Installment: ${formatPrice(agreement.installment_amount)}\nOutstanding: ${formatPrice(balance)}\n\nEnter amount to pay:`,
      String(Math.min(Number(agreement.installment_amount || 0), balance))
    );
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return toast.error("Enter a valid amount");
    }

    try {
      await API.post(`/bnpl/${agreement.id}/pay`, { amount: paymentAmount });
      toast.success("Installment recorded");
      fetchBnpl(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Payment failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Buy Now Pay Later
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Collect grains now, pay in installments
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Pick a grain, add a guarantor, and spread payment weekly or monthly after collection.
            </p>
          </div>

          <button
            onClick={() => fetchBnpl(user?.id)}
            disabled={loading}
            className="border border-slate-300 text-slate-700 hover:bg-white disabled:text-slate-400 px-5 py-3 rounded-lg font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Credit Score</p>
            <p className={`text-xl font-bold ${creditBand.className}`}>{creditScore}</p>
            <p className="text-xs text-slate-500">{creditBand.label}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Active BNPL</p>
            <p className="text-xl font-bold text-slate-950">{summary.active}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Outstanding</p>
            <p className="text-xl font-bold text-orange-600">{formatPrice(summary.outstanding)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Reminders</p>
            <p className="text-xl font-bold text-green-700">{reminders.length}</p>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <h2 className="text-lg font-bold">Start BNPL</h2>
            <p className="text-sm text-slate-300 mt-1">
              Example: collect 25kg rice today and pay weekly for 2 months.
            </p>
          </div>

          <div className="p-5">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Product</span>
                <select
                  value={form.product_id}
                  onChange={(event) => updateForm({ product_id: event.target.value, variant_id: "" })}
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
                  onChange={(event) => updateForm({ variant_id: event.target.value })}
                  disabled={!selectedProduct || variants.length === 0}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">{variants.length > 0 ? "Select Variant" : "Default product"}</option>
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
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(event) => updateForm({ quantity: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Duration</span>
                <select
                  value={form.duration_months}
                  onChange={(event) => updateForm({ duration_months: event.target.value })}
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
                <span className="text-sm font-medium text-slate-700">Payment</span>
                <select
                  value={form.frequency}
                  onChange={(event) => updateForm({ frequency: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {FREQUENCIES.map((frequency) => (
                    <option key={frequency.value} value={frequency.value}>
                      {frequency.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Guarantor</span>
                <input
                  value={form.guarantor_name}
                  onChange={(event) => updateForm({ guarantor_name: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="Full name"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Guarantor Phone</span>
                <input
                  value={form.guarantor_phone}
                  onChange={(event) => updateForm({ guarantor_phone: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="080..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Relationship</span>
                <input
                  value={form.guarantor_relationship}
                  onChange={(event) => updateForm({ guarantor_relationship: event.target.value })}
                  className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="Sibling, spouse, friend"
                />
              </label>
            </div>

            <div className="mt-5 grid md:grid-cols-3 gap-4 text-sm">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Total</p>
                <p className="text-xl font-bold text-slate-950">{formatPrice(totalAmount)}</p>
              </div>
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <p className="text-green-700">Installment</p>
                <p className="text-xl font-bold text-green-800">{formatPrice(installment)}</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500">Collection</p>
                <p className="text-xl font-bold text-slate-950">Immediate</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-slate-500">
                Approval uses credit score, guarantor details, and product availability.
              </p>
              <button
                onClick={submitBnpl}
                disabled={loading}
                className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
              >
                {loading ? "Processing..." : "Collect Now"}
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-slate-950">Your BNPL Agreements</h2>
            <span className="text-sm text-slate-500">{agreements.length} agreement(s)</span>
          </div>

          {agreements.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No BNPL yet</p>
              <p className="text-slate-500 mt-2">
                Your installment agreements will appear here after approval.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {agreements.map((agreement) => {
                const total = Number(agreement.total_amount || 0);
                const paid = Number(agreement.amount_paid || 0);
                const balance = Math.max(total - paid, 0);
                const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                const overdue = agreement.next_due_date && new Date(agreement.next_due_date) < new Date();
                const complete = agreement.status === "completed";

                return (
                  <div key={agreement.id} className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                          {agreement.frequency} BNPL
                        </p>
                        <h3 className="text-lg font-bold text-slate-950 mt-1">
                          {agreement.product_name}
                          {agreement.variant_weight ? ` - ${agreement.variant_weight}` : ""}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Guarantor: {agreement.guarantor_name} ({agreement.guarantor_phone})
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          complete
                            ? "bg-green-100 text-green-700"
                            : overdue
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {complete ? "Completed" : overdue ? "Reminder Due" : "Active"}
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-slate-700">Progress</span>
                        <span className="font-semibold text-slate-950">{progress}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-700 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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
                        <p className="text-slate-500">Next Due</p>
                        <p className="font-bold text-slate-950">{formatDate(agreement.next_due_date)}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => payInstallment(agreement)}
                        disabled={complete}
                        className="bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-3 rounded-lg font-semibold"
                      >
                        {complete ? "Paid Off" : `Pay ${formatPrice(agreement.installment_amount)}`}
                      </button>
                      <Link
                        href={`/order/${agreement.order_id}`}
                        className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-3 rounded-lg font-semibold text-center"
                      >
                        Order Details
                      </Link>
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
