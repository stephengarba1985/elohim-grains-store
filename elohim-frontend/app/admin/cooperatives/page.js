"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatType = (value) =>
  String(value || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminCooperativesPage() {
  const [totals, setTotals] = useState({});
  const [groups, setGroups] = useState([]);
  const [bulkRequests, setBulkRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, []);

  const pendingBulk = useMemo(
    () => bulkRequests.filter((item) => item.status === "pending").length,
    [bulkRequests]
  );

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/cooperatives/admin/overview");
      setTotals(res.data?.totals || {});
      setGroups(Array.isArray(res.data?.groups) ? res.data.groups : []);
      setBulkRequests(Array.isArray(res.data?.bulk_requests) ? res.data.bulk_requests : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load cooperatives");
    } finally {
      setLoading(false);
    }
  };

  const updateBulkStatus = async (id, status) => {
    try {
      await API.put(`/cooperatives/bulk-requests/${id}`, { status });
      toast.success("Bulk request updated");
      fetchOverview();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update bulk request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Cooperative Admin</h1>
          <p className="text-slate-500 mt-1">
            Monitor group savings, members, shared deliveries, and cooperative bulk buying.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Groups</p>
          <h2 className="text-xl font-bold">{totals.groups || 0}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Members</p>
          <h2 className="text-xl font-bold text-green-700">{totals.members || 0}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Contributions</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.contributions)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Pending Bulk</p>
          <h2 className="text-xl font-bold text-amber-600">{pendingBulk}</h2>
        </div>
      </div>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Cooperative Bulk Requests</h2>
          <span className="text-sm text-gray-500">{bulkRequests.length} request(s)</span>
        </div>

        {bulkRequests.length === 0 ? (
          <p className="text-gray-500">No cooperative bulk requests yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {bulkRequests.map((request) => (
              <div key={request.id} className="border rounded p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-bold">{request.group_name}</p>
                    <p className="text-sm text-gray-500">
                      {formatType(request.group_type)} • {request.product_name}
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded h-fit">
                    {request.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-bold">{request.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Requested Price</p>
                    <p className="font-bold">{formatPrice(request.requested_price)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Delivery: {request.delivery_note || request.delivery_address || "No note"}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => updateBulkStatus(request.id, "approved")}
                    className="bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateBulkStatus(request.id, "rejected")}
                    className="bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Cooperative Groups</h2>
          <span className="text-sm text-gray-500">{groups.length} group(s)</span>
        </div>

        {groups.length === 0 ? (
          <p className="text-gray-500">No cooperative groups yet.</p>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => {
              const target = Number(group.target_amount || 0);
              const contributed = Number(group.total_contributed || 0);
              const progress = target > 0 ? Math.min(100, Math.round((contributed / target) * 100)) : 0;

              return (
                <div key={group.id} className="border rounded p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase">
                        {formatType(group.group_type)}
                      </p>
                      <h3 className="text-lg font-bold">{group.name}</h3>
                      <p className="text-sm text-gray-600">
                        Leader: {group.creator_name || "Not available"} ({group.creator_email || "No email"})
                      </p>
                      <p className="text-sm text-gray-600">
                        Delivery: {group.delivery_address || "No shared address"}
                      </p>
                    </div>
                    <div className="text-sm md:text-right">
                      <p>Members: <b>{group.member_count}</b></p>
                      <p>Bulk requests: <b>{group.bulk_request_count}</b></p>
                      <p>Status: <b>{group.status}</b></p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>{formatPrice(contributed)} saved</span>
                      <span>{progress}% of {formatPrice(target)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-700" style={{ width: `${progress}%` }} />
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
