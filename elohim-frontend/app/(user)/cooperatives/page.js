"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const GROUP_TYPES = [
  { value: "church", label: "Church" },
  { value: "women_group", label: "Women Group" },
  { value: "farmers_association", label: "Farmers Association" },
  { value: "student_group", label: "Student Group" },
  { value: "market_group", label: "Market Group" },
  { value: "other", label: "Other" },
];

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatType = (value) =>
  GROUP_TYPES.find((item) => item.value === value)?.label || "Other";

export default function CooperativesPage() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    group_type: "women_group",
    target_amount: "",
    delivery_address: "",
    leader_phone: "",
  });
  const [memberForm, setMemberForm] = useState({ name: "", phone: "" });
  const [contributionForm, setContributionForm] = useState({
    amount: "",
    member_id: "",
    note: "",
  });
  const [bulkForm, setBulkForm] = useState({
    product_id: "",
    quantity: "",
    requested_price: "",
    delivery_note: "",
  });

  useEffect(() => {
    fetchProducts();

    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please log in to manage cooperatives");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchGroups(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetails(selectedGroupId);
    } else {
      setDetails(null);
    }
  }, [selectedGroupId]);

  const selectedGroup = details?.group;
  const members = details?.members || [];
  const contributions = details?.contributions || [];
  const bulkRequests = details?.bulk_requests || [];

  const summary = useMemo(() => {
    return groups.reduce(
      (total, group) => {
        total.groups += 1;
        total.members += Number(group.member_count || 0);
        total.contributed += Number(group.total_contributed || 0);
        total.bulk += Number(group.bulk_request_count || 0);
        return total;
      },
      { groups: 0, members: 0, contributed: 0, bulk: 0 }
    );
  }, [groups]);

  const selectedProgress = selectedGroup?.target_amount
    ? Math.min(
        100,
        Math.round(
          (Number(selectedGroup.total_contributed || 0) /
            Number(selectedGroup.target_amount || 1)) *
            100
        )
      )
    : 0;

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    }
  };

  const fetchGroups = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/cooperatives/user/${userId}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setGroups(data);

      if (!selectedGroupId && data.length > 0) {
        setSelectedGroupId(String(data[0].id));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load cooperatives");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId = selectedGroupId) => {
    if (!groupId) return;

    try {
      const res = await API.get(`/cooperatives/${groupId}`);
      setDetails(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load cooperative details");
    }
  };

  const createGroup = async () => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    if (!groupForm.name) {
      return toast.error("Enter cooperative name");
    }

    try {
      setLoading(true);
      const res = await API.post("/cooperatives", {
        creator_user_id: user.id,
        ...groupForm,
      });

      toast.success("Cooperative account created");
      setGroupForm({
        name: "",
        group_type: "women_group",
        target_amount: "",
        delivery_address: "",
        leader_phone: "",
      });
      setSelectedGroupId(String(res.data.id));
      fetchGroups(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create cooperative");
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!selectedGroupId || !memberForm.name) {
      return toast.error("Select a group and enter member name");
    }

    try {
      await API.post(`/cooperatives/${selectedGroupId}/members`, memberForm);
      toast.success("Member added");
      setMemberForm({ name: "", phone: "" });
      fetchGroupDetails();
      fetchGroups(user?.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add member");
    }
  };

  const addContribution = async () => {
    if (!selectedGroupId || !contributionForm.amount) {
      return toast.error("Enter contribution amount");
    }

    try {
      await API.post(`/cooperatives/${selectedGroupId}/contributions`, {
        ...contributionForm,
        user_id: user?.id,
        member_id: contributionForm.member_id || null,
      });
      toast.success("Contribution recorded");
      setContributionForm({ amount: "", member_id: "", note: "" });
      fetchGroupDetails();
      fetchGroups(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to record contribution");
    }
  };

  const createBulkRequest = async () => {
    if (!selectedGroupId || !bulkForm.product_id || !bulkForm.quantity) {
      return toast.error("Select product and quantity");
    }

    try {
      await API.post(`/cooperatives/${selectedGroupId}/bulk-requests`, bulkForm);
      toast.success("Group bulk request created");
      setBulkForm({
        product_id: "",
        quantity: "",
        requested_price: "",
        delivery_note: "",
      });
      fetchGroupDetails();
      fetchGroups(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create bulk request");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Cooperative Savings
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Save together, buy grains in bulk
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Create group accounts for churches, women groups, farmers associations, student groups, and market communities.
            </p>
          </div>

          <button
            onClick={() => fetchGroups(user?.id)}
            disabled={loading}
            className="border border-slate-300 text-slate-700 hover:bg-white disabled:text-slate-400 px-5 py-3 rounded-lg font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Groups</p>
            <p className="text-xl font-bold text-slate-950">{summary.groups}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Members</p>
            <p className="text-xl font-bold text-green-700">{summary.members}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Contributed</p>
            <p className="text-xl font-bold text-slate-950">{formatPrice(summary.contributed)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Bulk Requests</p>
            <p className="text-xl font-bold text-amber-600">{summary.bulk}</p>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-green-700 px-5 py-4 text-white">
            <h2 className="text-lg font-bold">Create Cooperative Account</h2>
            <p className="text-sm text-green-50 mt-1">
              Start a shared savings group with a bulk-buying goal and delivery address.
            </p>
          </div>

          <div className="p-5">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
                className="border border-slate-300 rounded-lg p-3"
                placeholder="Group name"
              />
              <select
                value={groupForm.group_type}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, group_type: event.target.value })
                }
                className="border border-slate-300 rounded-lg p-3 bg-white"
              >
                {GROUP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                value={groupForm.target_amount}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, target_amount: event.target.value })
                }
                type="number"
                min="0"
                className="border border-slate-300 rounded-lg p-3"
                placeholder="Target amount"
              />
              <input
                value={groupForm.leader_phone}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, leader_phone: event.target.value })
                }
                className="border border-slate-300 rounded-lg p-3"
                placeholder="Leader phone"
              />
              <input
                value={groupForm.delivery_address}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, delivery_address: event.target.value })
                }
                className="border border-slate-300 rounded-lg p-3 lg:col-span-2"
                placeholder="Shared delivery address"
              />
            </div>

            <button
              onClick={createGroup}
              disabled={loading}
              className="mt-5 bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold"
            >
              Create Group
            </button>
          </div>
        </section>

        <section className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-950 mb-4">Your Groups</h2>
            {groups.length === 0 ? (
              <p className="text-slate-500 text-sm">No cooperative groups yet.</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(String(group.id))}
                    className={`w-full text-left border rounded-lg p-3 ${
                      String(group.id) === String(selectedGroupId)
                        ? "border-green-600 bg-green-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-semibold text-slate-950">{group.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatType(group.group_type)} • {group.member_count} member(s)
                    </p>
                    <p className="text-sm font-bold text-green-700 mt-1">
                      {formatPrice(group.total_contributed)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selectedGroup ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">Select a group</p>
              <p className="text-slate-500 mt-2">
                Contributions, members, and group bulk requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase">
                      {formatType(selectedGroup.group_type)}
                    </p>
                    <h2 className="text-xl font-bold text-slate-950 mt-1">
                      {selectedGroup.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedGroup.delivery_address || "No delivery address yet"}
                    </p>
                  </div>
                  <Link
                    href="/bulk"
                    className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-3 rounded-lg font-semibold text-center"
                  >
                    Public Bulk
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Target</p>
                    <p className="font-bold">{formatPrice(selectedGroup.target_amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Contributed</p>
                    <p className="font-bold text-green-700">
                      {formatPrice(selectedGroup.total_contributed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Members</p>
                    <p className="font-bold">{members.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Progress</p>
                    <p className="font-bold">{selectedProgress}%</p>
                  </div>
                </div>

                <div className="mt-4 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-700"
                    style={{ width: `${selectedProgress}%` }}
                  />
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950">Add Member</h3>
                  <input
                    value={memberForm.name}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, name: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-4"
                    placeholder="Member name"
                  />
                  <input
                    value={memberForm.phone}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, phone: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Phone"
                  />
                  <button
                    onClick={addMember}
                    className="mt-4 w-full bg-slate-950 hover:bg-slate-800 text-white px-4 py-3 rounded-lg font-semibold"
                  >
                    Add Member
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950">Record Contribution</h3>
                  <select
                    value={contributionForm.member_id}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        member_id: event.target.value,
                      })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-4 bg-white"
                  >
                    <option value="">General group contribution</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={contributionForm.amount}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        amount: event.target.value,
                      })
                    }
                    type="number"
                    min="1"
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Amount"
                  />
                  <input
                    value={contributionForm.note}
                    onChange={(event) =>
                      setContributionForm({ ...contributionForm, note: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Note"
                  />
                  <button
                    onClick={addContribution}
                    className="mt-4 w-full bg-green-700 hover:bg-green-800 text-white px-4 py-3 rounded-lg font-semibold"
                  >
                    Save Contribution
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950">Group Bulk Request</h3>
                  <select
                    value={bulkForm.product_id}
                    onChange={(event) =>
                      setBulkForm({ ...bulkForm, product_id: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-4 bg-white"
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={bulkForm.quantity}
                    onChange={(event) =>
                      setBulkForm({ ...bulkForm, quantity: event.target.value })
                    }
                    type="number"
                    min="1"
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Quantity"
                  />
                  <input
                    value={bulkForm.requested_price}
                    onChange={(event) =>
                      setBulkForm({ ...bulkForm, requested_price: event.target.value })
                    }
                    type="number"
                    min="1"
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Requested unit price"
                  />
                  <input
                    value={bulkForm.delivery_note}
                    onChange={(event) =>
                      setBulkForm({ ...bulkForm, delivery_note: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-3"
                    placeholder="Shared delivery note"
                  />
                  <button
                    onClick={createBulkRequest}
                    className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-lg font-semibold"
                  >
                    Request Bulk Deal
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950 mb-3">Members</h3>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="border border-slate-100 rounded p-3">
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-slate-500">
                          {member.phone || "No phone"} • {member.role}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950 mb-3">Contributions</h3>
                  <div className="space-y-2">
                    {contributions.map((item) => (
                      <div key={item.id} className="border border-slate-100 rounded p-3">
                        <p className="font-semibold text-green-700">
                          {formatPrice(item.amount)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.member_name || "Group"} {item.note ? `• ${item.note}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-bold text-slate-950 mb-3">Bulk Requests</h3>
                  <div className="space-y-2">
                    {bulkRequests.map((item) => (
                      <div key={item.id} className="border border-slate-100 rounded p-3">
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="text-sm text-slate-500">
                          Quantity: {item.quantity} • Status: {item.status}
                        </p>
                        <p className="text-sm text-slate-500">
                          Price: {formatPrice(item.requested_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
