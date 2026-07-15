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

const labelStatus = (status) =>
  String(status || "not_submitted").replace(/_/g, " ");

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusClass(status)}`}>
      {labelStatus(status)}
    </span>
  );
}

export default function KycPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [identityForm, setIdentityForm] = useState({ bvn: "", nin: "" });
  const [codes, setCodes] = useState({ phone: "", email: "" });
  const [devCodes, setDevCodes] = useState({});

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login to complete KYC");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchKyc(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const completion = useMemo(() => {
    if (!profile) return 0;

    const checks = [
      profile.bvn_status,
      profile.nin_status,
      profile.phone_status,
      profile.email_status,
    ];

    const verified = checks.filter((status) => status === "verified").length;
    return Math.round((verified / checks.length) * 100);
  }, [profile]);

  const fetchKyc = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/kyc/${userId}`);
      setProfile(res.data || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load KYC profile");
    } finally {
      setLoading(false);
    }
  };

  const submitIdentity = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      await API.post("/kyc/submit-identity", identityForm);
      toast.success("BVN and NIN submitted for review");
      setIdentityForm({ bvn: "", nin: "" });
      fetchKyc(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Identity submission failed");
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async (channel) => {
    try {
      const res = await API.post("/kyc/request-code", { channel });
      setDevCodes((current) => ({ ...current, [channel]: res.data?.dev_code }));
      toast.success(`${channel} verification code generated`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Code request failed");
    }
  };

  const confirmCode = async (channel) => {
    try {
      await API.post("/kyc/confirm-code", {
        channel,
        code: codes[channel],
      });
      toast.success(`${channel} verified`);
      setCodes((current) => ({ ...current, [channel]: "" }));
      setDevCodes((current) => ({ ...current, [channel]: "" }));
      fetchKyc(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Verification failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-green-200">
            Security and Trust
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Verify your identity for trusted grain finance.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Complete BVN, NIN, phone, and email checks to unlock stronger trust
            signals for wallet, warehouse, BNPL, escrow, and vendor activity.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">KYC profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {user?.name || "Customer"} / {user?.email || "No email"}
                </p>
              </div>
              <StatusPill status={profile?.overall_status} />
            </div>

            <div className="mt-5 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-green-600"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {completion}% complete
            </p>
          </div>

          <button
            onClick={() => fetchKyc(user?.id)}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm disabled:text-slate-400"
          >
            {loading ? "Refreshing..." : "Refresh KYC"}
          </button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={submitIdentity}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-black text-slate-950">BVN and NIN</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit 11-digit identifiers for admin review. Only the last 4
              digits are stored for display.
            </p>
            <div className="mt-5 space-y-3">
              <input
                value={identityForm.bvn}
                onChange={(event) =>
                  setIdentityForm({ ...identityForm, bvn: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 p-3"
                inputMode="numeric"
                maxLength="11"
                placeholder="BVN"
                required
              />
              <input
                value={identityForm.nin}
                onChange={(event) =>
                  setIdentityForm({ ...identityForm, nin: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 p-3"
                inputMode="numeric"
                maxLength="11"
                placeholder="NIN"
                required
              />
              <button className="w-full rounded-lg bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800">
                Submit Identity
              </button>
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: "bvn", label: "BVN", last4: profile?.bvn_last4, status: profile?.bvn_status },
              { key: "nin", label: "NIN", last4: profile?.nin_last4, status: profile?.nin_status },
              { key: "phone", label: "Phone", status: profile?.phone_status },
              { key: "email", label: "Email", status: profile?.email_status },
            ].map((item) => (
              <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{item.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.last4 ? `Ending ${item.last4}` : "Verification status"}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {["phone", "email"].map((channel) => (
            <div key={channel} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black capitalize text-slate-950">
                    {channel} verification
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Request a code, then confirm it here.
                  </p>
                </div>
                <StatusPill status={profile?.[`${channel}_status`]} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  onClick={() => requestCode(channel)}
                  className="rounded-lg border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Request Code
                </button>
                {devCodes[channel] && (
                  <span className="rounded-lg bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-700">
                    Demo code: {devCodes[channel]}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={codes[channel]}
                  onChange={(event) =>
                    setCodes((current) => ({
                      ...current,
                      [channel]: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-300 p-3"
                  placeholder="Enter code"
                />
                <button
                  onClick={() => confirmCode(channel)}
                  className="rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800"
                >
                  Confirm
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
