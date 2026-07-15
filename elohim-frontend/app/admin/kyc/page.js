"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const statusClass = (status) => {
  if (status === "verified") return "bg-green-100 text-green-700";
  if (status === "pending" || status === "pending_review") return "bg-amber-100 text-amber-700";
  if (status === "rejected" || status === "needs_review") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
};

const labelStatus = (status) => String(status || "not_submitted").replace(/_/g, " ");

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusClass(status)}`}>
      {labelStatus(status)}
    </span>
  );
}

export default function AdminKycPage() {
  const [totals, setTotals] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  const pendingCount = useMemo(
    () =>
      records.filter(
        (record) =>
          record.bvn_status === "pending" ||
          record.nin_status === "pending" ||
          record.overall_status === "pending_review"
      ).length,
    [records]
  );

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/kyc/admin/overview/all");
      setTotals(res.data?.totals || {});
      setRecords(Array.isArray(res.data?.records) ? res.data.records : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load KYC overview");
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = async (record, payload) => {
    try {
      await API.patch(`/kyc/admin/${record.user_id}`, payload);
      toast.success("KYC record updated");
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "KYC update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">KYC Verification</h1>
          <p className="mt-1 text-slate-500">
            Review BVN, NIN, phone, and email verification for trust-sensitive services.
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
          <p className="text-sm text-gray-500">KYC Profiles</p>
          <h2 className="text-xl font-bold text-slate-950">{totals.total || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Verified</p>
          <h2 className="text-xl font-bold text-green-700">{totals.verified || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Pending Review</p>
          <h2 className="text-xl font-bold text-amber-600">{pendingCount}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Phone Verified</p>
          <h2 className="text-xl font-bold">{totals.phone_verified || 0}</h2>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-sm text-gray-500">Email Verified</p>
          <h2 className="text-xl font-bold">{totals.email_verified || 0}</h2>
        </div>
      </div>

      <section className="rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold text-slate-950">Customer KYC records</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">BVN</th>
                <th className="p-3">NIN</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
                <th className="p-3">Overall</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-semibold">{record.user_name}</p>
                    <p className="text-xs text-slate-500">{record.user_email}</p>
                    <p className="text-xs text-slate-500">{record.user_phone || "No phone"}</p>
                  </td>
                  <td className="p-3">
                    <StatusPill status={record.bvn_status} />
                    <p className="mt-1 text-xs text-slate-500">
                      {record.bvn_last4 ? `Ending ${record.bvn_last4}` : "No BVN"}
                    </p>
                  </td>
                  <td className="p-3">
                    <StatusPill status={record.nin_status} />
                    <p className="mt-1 text-xs text-slate-500">
                      {record.nin_last4 ? `Ending ${record.nin_last4}` : "No NIN"}
                    </p>
                  </td>
                  <td className="p-3"><StatusPill status={record.phone_status} /></td>
                  <td className="p-3"><StatusPill status={record.email_status} /></td>
                  <td className="p-3"><StatusPill status={record.overall_status} /></td>
                  <td className="p-3">
                    <div className="grid min-w-[220px] gap-2">
                      <button
                        onClick={() =>
                          updateRecord(record, {
                            bvn_status: "verified",
                            nin_status: "verified",
                          })
                        }
                        className="rounded bg-green-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        Approve BVN/NIN
                      </button>
                      <button
                        onClick={() =>
                          updateRecord(record, {
                            bvn_status: "rejected",
                            nin_status: "rejected",
                            admin_note: "Identity details need resubmission",
                          })
                        }
                        className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Reject Identity
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-500">
                    No KYC records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
