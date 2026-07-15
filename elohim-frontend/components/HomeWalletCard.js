"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function HomeWalletCard({ marketSignals }) {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return;

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchWallet(parsedUser.id);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchWallet = async (userId) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/wallet/${userId}`);
      setBalance(Number(res.data?.balance || 0));
    } catch (err) {
      console.error(err);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/15 bg-white/95 p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {user ? "Wallet balance" : "Elohim Wallet"}
          </p>
          <p className="mt-1 text-3xl font-black text-slate-950">
            {user
              ? loading
                ? "Loading..."
                : formatPrice(balance || 0)
              : "Login required"}
          </p>
          {!user && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to view your real wallet balance and virtual account.
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            user
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {user ? "Active" : "Guest"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={user ? "/wallet" : "/login"}
          className="rounded-lg bg-green-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-green-800"
        >
          {user ? "Fund wallet" : "Login"}
        </Link>
        <Link
          href={user ? "/plans" : "/login"}
          className="rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-800 hover:bg-slate-50"
        >
          {user ? "Start savings" : "Create account"}
        </Link>
      </div>

      <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-green-200">
          Food goal
        </p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xl font-black">
              {user ? "5 bags of rice" : "Plan your grains"}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {user ? "Weekly plan running" : "Save daily, weekly, or monthly"}
            </p>
          </div>
          <p className="text-right text-sm font-bold text-green-200">
            {user ? "68%" : "Start"}
          </p>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/15">
          <div
            className={`h-2 rounded-full bg-green-400 ${
              user ? "w-[68%]" : "w-[18%]"
            }`}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {marketSignals.map((signal) => (
          <div
            key={signal.crop}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div>
              <p className="font-bold text-slate-950">{signal.crop}</p>
              <p className="text-xs text-slate-500">{signal.note}</p>
            </div>
            <span
              className={`text-sm font-black ${
                signal.movement.startsWith("-")
                  ? "text-red-600"
                  : "text-green-700"
              }`}
            >
              {signal.movement}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
