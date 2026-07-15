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

const statusClass = (status) => {
  if (["approved", "disbursed", "repaid", "released"].includes(status)) {
    return "bg-green-100 text-green-700";
  }
  if (["rejected", "defaulted", "liquidated"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-700";
};

export default function InventoryFinancePage() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    grain_type: "Rice",
    quantity_bags: "",
    bag_weight_kg: 50,
    estimated_value: "",
    requested_amount: "",
    duration_months: 3,
    storage_location: "",
    warehouse_receipt: "",
  });
  const [repaymentForm, setRepaymentForm] = useState({
    application_id: "",
    amount: "",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login to use inventory financing");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchApplications(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const maxLoanAmount = useMemo(
    () => Number(form.estimated_value || 0) * 0.7,
    [form.estimated_value]
  );

  const activeApplications = useMemo(
    () => applications.filter((item) => !["repaid", "rejected"].includes(item.status)),
    [applications]
  );

  const fetchApplications = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/inventory-finance/${userId}`);
      setApplications(Array.isArray(res.data?.applications) ? res.data.applications : []);
      setRepayments(Array.isArray(res.data?.repayments) ? res.data.repayments : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory financing");
    } finally {
      setLoading(false);
    }
  };

  const applyForFinance = async (event) => {
    event.preventDefault();

    if (!user) return toast.error("Please login first");

    try {
      await API.post("/inventory-finance/apply", form);
      toast.success("Inventory finance application submitted");
      setForm({
        grain_type: "Rice",
        quantity_bags: "",
        bag_weight_kg: 50,
        estimated_value: "",
        requested_amount: "",
        duration_months: 3,
        storage_location: "",
        warehouse_receipt: "",
      });
      fetchApplications(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Application failed");
    }
  };

  const repayFinance = async (event) => {
    event.preventDefault();

    try {
      await API.post(`/inventory-finance/${repaymentForm.application_id}/repay`, {
        amount: repaymentForm.amount,
      });
      toast.success("Repayment recorded");
      setRepaymentForm({ application_id: "", amount: "" });
      fetchApplications(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Repayment failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-green-200">
            Inventory Financing
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Use stored grains as collateral for small loans.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Farmers and grain holders can pledge verified inventory, receive
            working capital, and repay while their collateral is tracked by Elohim.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Applications</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {applications.length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Active Loans</p>
            <p className="mt-1 text-2xl font-black text-green-700">
              {activeApplications.length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Collateral Value</p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatPrice(
                applications.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0)
              )}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Outstanding</p>
            <p className="mt-1 text-2xl font-black text-amber-600">
              {formatPrice(
                applications.reduce((sum, item) => sum + Number(item.outstanding_amount || 0), 0)
              )}
            </p>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <form
            onSubmit={applyForFinance}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Apply with grain collateral
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Requested loans are capped at 70% of collateral value.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchApplications(user?.id)}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:text-slate-400"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <select
                value={form.grain_type}
                onChange={(event) => setForm({ ...form, grain_type: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
              >
                {["Rice", "Maize", "Beans", "Millet", "Sorghum", "Soybeans"].map((grain) => (
                  <option key={grain} value={grain}>{grain}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={form.quantity_bags}
                onChange={(event) => setForm({ ...form, quantity_bags: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Quantity in bags"
                required
              />
              <input
                type="number"
                min="1"
                value={form.bag_weight_kg}
                onChange={(event) => setForm({ ...form, bag_weight_kg: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Bag weight kg"
              />
              <input
                type="number"
                min="1"
                value={form.duration_months}
                onChange={(event) => setForm({ ...form, duration_months: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Duration months"
              />
              <input
                type="number"
                min="1"
                value={form.estimated_value}
                onChange={(event) => setForm({ ...form, estimated_value: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Estimated collateral value"
                required
              />
              <input
                type="number"
                min="1"
                value={form.requested_amount}
                onChange={(event) => setForm({ ...form, requested_amount: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Requested loan amount"
                required
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={form.storage_location}
                onChange={(event) => setForm({ ...form, storage_location: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Storage location"
              />
              <input
                value={form.warehouse_receipt}
                onChange={(event) => setForm({ ...form, warehouse_receipt: event.target.value })}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Warehouse receipt number"
              />
            </div>

            <div className="mt-4 rounded-lg bg-green-50 p-4">
              <p className="text-sm font-bold text-green-700">
                Maximum recommended loan: {formatPrice(maxLoanAmount)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Admin will inspect the grain, verify collateral, and approve the final amount.
              </p>
            </div>

            <button className="mt-5 rounded-lg bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800">
              Submit Application
            </button>
          </form>

          <form
            onSubmit={repayFinance}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-black text-slate-950">Repay financing</h2>
            <p className="mt-1 text-sm text-slate-500">
              Repay active inventory loans and release collateral after completion.
            </p>
            <div className="mt-5 space-y-3">
              <select
                value={repaymentForm.application_id}
                onChange={(event) =>
                  setRepaymentForm({ ...repaymentForm, application_id: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 p-3"
                required
              >
                <option value="">Select application</option>
                {activeApplications.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} {item.grain_type} - {formatPrice(item.outstanding_amount)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={repaymentForm.amount}
                onChange={(event) =>
                  setRepaymentForm({ ...repaymentForm, amount: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 p-3"
                placeholder="Repayment amount"
                required
              />
              <button className="w-full rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800">
                Record Repayment
              </button>
            </div>

            <div className="mt-6">
              <h3 className="font-bold text-slate-950">Recent repayments</h3>
              <div className="mt-3 space-y-2">
                {repayments.slice(0, 5).map((repayment) => (
                  <div key={repayment.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-slate-950">{repayment.grain_type}</p>
                      <p className="font-bold text-green-700">{formatPrice(repayment.amount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(repayment.created_at)}
                    </p>
                  </div>
                ))}
                {repayments.length === 0 && (
                  <p className="text-sm text-slate-500">No repayments yet.</p>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">My inventory loans</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3">Collateral</th>
                  <th className="p-3">Requested</th>
                  <th className="p-3">Approved</th>
                  <th className="p-3">Outstanding</th>
                  <th className="p-3">Due</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Collateral</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <p className="font-semibold">{item.grain_type}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity_bags} bags • {item.bag_weight_kg}kg
                      </p>
                    </td>
                    <td className="p-3">{formatPrice(item.requested_amount)}</td>
                    <td className="p-3">{formatPrice(item.approved_amount)}</td>
                    <td className="p-3 font-semibold text-amber-700">
                      {formatPrice(item.outstanding_amount)}
                    </td>
                    <td className="p-3">{formatDate(item.due_date)}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(item.collateral_status)}`}>
                        {item.collateral_status}
                      </span>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-slate-500">
                      No inventory finance applications yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
