"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import API from "@/lib/api";

export default function WalletSecurityPage() {
  const [user, setUser] = useState(null);
  const [walletPinSet, setWalletPinSet] = useState(false);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    pin: "",
    confirmPin: "",
  });

  const [changeForm, setChangeForm] = useState({
    oldPin: "",
    newPin: "",
    confirmPin: "",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please log in to manage wallet security");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchWalletStatus(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  const fetchWalletStatus = async (userId) => {
    try {
      setLoading(true);
      const res = await API.get(`/wallet/${userId}`);
      setWalletPinSet(Boolean(res.data?.wallet_pin_set));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load wallet security");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    try {
      setLoading(true);
      await API.post("/wallet/set-pin", createForm);
      setWalletPinSet(true);
      setCreateForm({ pin: "", confirmPin: "" });
      toast.success("Wallet PIN created successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    try {
      setLoading(true);
      await API.post("/wallet/change-pin", changeForm);
      setChangeForm({ oldPin: "", newPin: "", confirmPin: "" });
      toast.success("Wallet PIN changed successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to change PIN");
    } finally {
      setLoading(false);
    }
  };

  const sanitizePin = (value) => value.replace(/\D/g, "").slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
              Wallet Security
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">Wallet PIN</h1>
            <p className="text-slate-600 mt-2">
              Protect wallet withdrawals and transfers with a 4-digit PIN.
            </p>
          </div>
          <Link
            href="/user/wallet"
            className="border border-slate-300 text-slate-700 hover:bg-white px-4 py-2 rounded-lg font-semibold"
          >
            Back to Wallet
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <p className="text-sm text-slate-500">Wallet PIN status</p>
          <p className="text-xl font-bold text-slate-950 mt-1">
            {walletPinSet ? "********" : "Not set"}
          </p>
        </div>

        {!walletPinSet ? (
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-950">Create Wallet PIN</h2>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={createForm.pin}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    pin: sanitizePin(event.target.value),
                  }))
                }
                className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                placeholder="____"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={createForm.confirmPin}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    confirmPin: sanitizePin(event.target.value),
                  }))
                }
                className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                placeholder="____"
              />
            </label>

            <button
              onClick={handleSetPin}
              disabled={loading || !user}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white px-5 py-3 rounded-lg font-semibold"
            >
              {loading ? "Saving..." : "Save PIN"}
            </button>
          </section>
        ) : (
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-950">Change Wallet PIN</h2>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Old PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={changeForm.oldPin}
                onChange={(event) =>
                  setChangeForm((current) => ({
                    ...current,
                    oldPin: sanitizePin(event.target.value),
                  }))
                }
                className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                placeholder="____"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={changeForm.newPin}
                onChange={(event) =>
                  setChangeForm((current) => ({
                    ...current,
                    newPin: sanitizePin(event.target.value),
                  }))
                }
                className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                placeholder="____"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Confirm New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={changeForm.confirmPin}
                onChange={(event) =>
                  setChangeForm((current) => ({
                    ...current,
                    confirmPin: sanitizePin(event.target.value),
                  }))
                }
                className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                placeholder="____"
              />
            </label>

            <button
              onClick={handleChangePin}
              disabled={loading || !user}
              className="bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white px-5 py-3 rounded-lg font-semibold"
            >
              {loading ? "Updating..." : "Change PIN"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
