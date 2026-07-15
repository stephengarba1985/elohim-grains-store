"use client";

import { useEffect, useState } from "react";
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
  if (["approved", "disbursed", "repaid", "verified", "released"].includes(status)) {
    return "bg-green-100 text-green-700";
  }
  if (["rejected", "defaulted", "liquidated"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-700";
};

export default function AdminInventoryFinancePage() {
  const [totals, setTotals] = useState({});
  const [applications, setApplications] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/inventory-finance/admin/overview/all");
      setTotals(res.data?.totals || {});
      setApplications(Array.isArray(res.data?.applications) ? res.data.applications : []);
      setRepayments(Array.isArray(res.data?.repayments) ? res.data.repayments : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory financing");
    } finally {
      setLoading(false);
    }
  };

  const updateApplication = async (application, payload) => {
    try {
      await API.patch(`/inventory-finance/admin/${application.id}/status`, payload);
      toast.success("Inventory finance updated");
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Inventory Financing</h1>
          <p className="mt-1 text-slate-500">
            Approve grain-backed loans, inspect collateral, disburse funds, and track repayment.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:bg-green-300"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Applications</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.applications || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Pending</p>
          <h2 className="text-xl font-bold text-amber-600">{totals.pending || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Disbursed</p>
          <h2 className="text-xl font-bold text-green-700">{totals.disbursed || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Requested</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.requested_amount)}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Approved</p>
          <h2 className="text-xl font-bold text-green-700">
            {formatPrice(totals.approved_amount)}
          </h2>
        </div>
      </div>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Loan applications</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Applicant</th>
                <th className="p-3">Collateral</th>
                <th className="p-3">Value</th>
                <th className="p-3">Requested</th>
                <th className="p-3">Approved</th>
                <th className="p-3">Outstanding</th>
                <th className="p-3">Status</th>
                <th className="p-3">Collateral</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-semibold">{application.user_name || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{application.user_email}</p>
                    <p className="text-xs text-slate-500">{application.user_phone}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{application.grain_type}</p>
                    <p className="text-xs text-slate-500">
                      {application.quantity_bags} bags • {application.bag_weight_kg}kg
                    </p>
                    <p className="text-xs text-slate-500">
                      {application.storage_location || "No storage location"}
                    </p>
                  </td>
                  <td className="p-3">{formatPrice(application.estimated_value)}</td>
                  <td className="p-3">{formatPrice(application.requested_amount)}</td>
                  <td className="p-3">{formatPrice(application.approved_amount)}</td>
                  <td className="p-3 font-semibold text-amber-700">
                    {formatPrice(application.outstanding_amount)}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(application.status)}`}>
                      {application.status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      Due {formatDate(application.due_date)}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(application.collateral_status)}`}>
                      {application.collateral_status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      Receipt: {application.warehouse_receipt || "None"}
                    </p>
                  </td>
                  <td className="p-3">
                    <div className="grid min-w-[190px] gap-2">
                      <button
                        onClick={() =>
                          updateApplication(application, {
                            status: "approved",
                            collateral_status: "verified",
                            approved_amount:
                              Number(application.approved_amount || 0) > 0
                                ? application.approved_amount
                                : application.requested_amount,
                          })
                        }
                        className="rounded bg-green-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          updateApplication(application, {
                            status: "disbursed",
                            collateral_status: "locked",
                          })
                        }
                        className="rounded bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                      >
                        Disburse
                      </button>
                      <button
                        onClick={() =>
                          updateApplication(application, {
                            status: "rejected",
                          })
                        }
                        className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-slate-500">
                    No inventory finance applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Recent repayments</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {repayments.map((repayment) => (
            <div key={repayment.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{repayment.user_name || "Customer"}</p>
                  <p className="text-sm text-slate-500">{repayment.grain_type}</p>
                  <p className="text-xs text-slate-500">{formatDate(repayment.created_at)}</p>
                </div>
                <p className="font-bold text-green-700">{formatPrice(repayment.amount)}</p>
              </div>
            </div>
          ))}
          {repayments.length === 0 && (
            <p className="text-sm text-slate-500">No repayments yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
