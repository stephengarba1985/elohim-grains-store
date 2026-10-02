"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `\u20A6${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const typeLabels = {
  fund: "Wallet Funding",
  paystack_funding: "Wallet Funding (Paystack)",
  withdraw: "Withdrawal",
  transfer_in: "Transfer Received",
  transfer_out: "Transfer Sent",
  plan_payment: "Grain Plan Auto-save",
  refund: "Plan Refund",
  reward_bonus: "Savings Reward Bonus",
  escrow_hold: "Escrow Hold",
  escrow_refund: "Escrow Refund",
  virtual_account_deposit: "Virtual Account Deposit",
};

const actionLabels = {
  fund: "Fund wallet",
  withdraw: "Withdraw",
  transfer: "Transfer",
};

function WalletPageContent() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [walletPinSet, setWalletPinSet] = useState(false);
  const [walletNumber, setWalletNumber] = useState("");
  const [virtualAccount, setVirtualAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeAction, setActiveAction] = useState("fund");
  const [loading, setLoading] = useState(false);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    recipient_phone: "",
    pin: "",
    note: "",
  });


  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please log in to manage your wallet");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchWallet(parsedUser.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read user session");
    }
  }, []);

  // Verify Paystack payment on return from checkout
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference) return;
    router.replace("/user/wallet");
    const verifyFunding = async () => {
      try {
        setLoading(true);
        const res = await API.post("/wallet/fund/verify", { reference });
        if (res.data.already_verified) {
          toast.success("Payment already verified");
        } else {
          toast.success(`Wallet funded! NGN ${Number(res.data.amount || 0).toLocaleString()} added`);
        }
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");
        if (storedUser?.id) fetchWallet(storedUser.id);
      } catch (err) {
        toast.error(err.response?.data?.error || "Payment verification failed");
      } finally {
        setLoading(false);
      }
    };
    verifyFunding();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    return transactions.reduce(
      (total, transaction) => {
        const amount = Number(transaction.amount || 0);

        if (transaction.direction === "credit") {
          total.credit += amount;
        } else {
          total.debit += amount;
        }

        if (transaction.type === "plan_payment") {
          total.autoSave += amount;
        }

        return total;
      },
      { credit: 0, debit: 0, autoSave: 0 }
    );
  }, [transactions]);

  const fetchWallet = async (userId = user?.id) => {
    if (!userId) return;

    try {
      setLoading(true);
      const res = await API.get(`/wallet/${userId}`);
      setBalance(Number(res.data?.balance || 0));
      setWalletPinSet(Boolean(res.data?.wallet_pin_set));
      setWalletNumber(String(res.data?.wallet_number || ""));
      setVirtualAccount(res.data?.virtual_account || null);
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load wallet");
    } finally {
      setLoading(false);
      setWalletLoaded(true);
    }
  };

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const lookupRecipient = useCallback(async (phone) => {
    const trimmed = String(phone || "").trim();
    if (trimmed.length < 10) { setRecipient(null); return; }
    try {
      setRecipientLoading(true);
      const res = await API.get(`/wallet/recipient/${encodeURIComponent(trimmed)}`);
      setRecipient(res.data.recipient);
    } catch {
      setRecipient(null);
    } finally {
      setRecipientLoading(false);
    }
  }, []);

  const resetForm = () => {
    setForm({ amount: "", recipient_phone: "", pin: "", note: "" });
  };


  const submitAction = async (action = activeAction) => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Enter a valid amount");
    }

    try {
      setLoading(true);

      if (action === "fund") {
        const res = await API.post("/wallet/fund/initialize", { amount });
        window.location.href = res.data.authorization_url;
        return;
      }

      if (action === "withdraw") {
        await API.post(`/wallet/${user.id}/withdraw`, {
          amount,
          pin: form.pin,
          note: form.note || "Wallet withdrawal",
        });
        toast.success("Withdrawal recorded");
      }

      if (action === "transfer") {
        await API.post(`/wallet/${user.id}/transfer`, {
          amount,
          recipient_phone: form.recipient_phone,
          pin: form.pin,
        });
        toast.success("Transfer sent");
      }

      resetForm();
      setRecipient(null);
      fetchWallet(user.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Wallet action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="space-y-5 md:hidden">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Elohim Wallet</p>
            <p className="mt-5 text-sm font-bold text-slate-500">Available balance</p>
            <p className="mt-1 text-4xl font-black text-slate-950">{walletLoaded ? formatPrice(balance) : "—"}</p>
          </div>
          <button onClick={() => document.getElementById("mobile-wallet-funding")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="w-full rounded-xl bg-emerald-700 px-5 py-4 text-sm font-black text-white">FUND WALLET</button>
          <section id="mobile-wallet-funding" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-black text-slate-950">Fund your wallet</p>
            <p className="mt-1 text-sm text-slate-500">You will complete payment securely through Paystack.</p>
            <label className="mt-4 block"><span className="text-sm font-bold text-slate-700">Amount</span><input type="number" min="1" value={form.amount} onChange={(event) => updateForm({ amount: event.target.value })} placeholder="Enter amount" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
          <button onClick={() => submitAction("fund")} disabled={loading} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">{loading ? "PROCESSING..." : "FUND WALLET"}</button>
          </section>
          <section>
            <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">Recent activity</h2><button onClick={() => fetchWallet(user?.id)} className="text-sm font-bold text-emerald-700">Refresh</button></div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {transactions.slice(0, 5).map((transaction) => { const isCredit = transaction.direction === "credit"; return <div key={transaction.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0"><div><p className="font-bold text-slate-900">{typeLabels[transaction.type] || transaction.type}</p><p className="mt-1 text-xs text-slate-500">{formatDate(transaction.created_at)}</p></div><p className={isCredit ? "font-black text-emerald-700" : "font-black text-red-600"}>{isCredit ? "+" : "−"}{formatPrice(transaction.amount)}</p></div>; })}
              {transactions.length === 0 && <p className="p-5 text-sm text-slate-500">No wallet activity yet.</p>}
            </div>
          </section>
        </section>

        <div className="hidden flex-col gap-4 md:flex lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Elohim Wallet
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Manage your grain money
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Fund your wallet, withdraw balance, transfer to another user, and
              let grain plans debit your savings automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/user/wallet/security"
              className="border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-5 py-3 rounded-lg font-semibold text-center"
            >
              Wallet Security
            </Link>
            <button
              onClick={() => fetchWallet(user?.id)}
              disabled={loading}
              className="border border-slate-300 text-slate-700 hover:bg-white disabled:text-slate-400 px-5 py-3 rounded-lg font-semibold"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/user/plans"
              className="bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm text-center"
            >
              Grain Plans
            </Link>
          </div>
        </div>

        <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
          <div className="bg-slate-950 text-white rounded-lg px-4 py-4 shadow-sm col-span-2">
            <p className="text-xs text-slate-300">Available Balance</p>
            <p className="text-3xl font-bold mt-1">{formatPrice(balance)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Money In</p>
            <p className="text-xl font-bold text-green-700">{formatPrice(summary.credit)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Auto-save</p>
            <p className="text-xl font-bold text-amber-600">{formatPrice(summary.autoSave)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Wallet PIN</p>
            <p className="text-xl font-bold text-slate-900">
              {walletPinSet ? "Set" : "Not Set"}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">

          <section className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <div className="bg-green-700 px-5 py-4 text-white">
              <h2 className="text-lg font-bold">{actionLabels[activeAction]}</h2>
              <p className="text-sm text-green-50 mt-1">
                Wallet actions update your balance and transaction history instantly.
              </p>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-3 gap-2 mb-5">
                {["fund", "withdraw", "transfer"].map((action) => (
                  <button
                    key={action}
                    onClick={() => setActiveAction(action)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      activeAction === action
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {actionLabels[action].replace(" wallet", "")}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Amount</span>
                  <input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(event) => updateForm({ amount: event.target.value })}
                    className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                    placeholder="Enter amount"
                  />
                </label>

                {activeAction === "transfer" && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">
                      Recipient Phone
                    </span>
                    <input
                      value={form.recipient_phone}
                      onChange={(event) => {
                        updateForm({ recipient_phone: event.target.value });
                        lookupRecipient(event.target.value);
                      }}
                      className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="08031234567"
                    />
                    {recipientLoading && (
                      <p className="text-xs text-slate-400 mt-1">Looking up...</p>
                    )}
                    {recipient && (
                      <p className="text-sm font-semibold text-green-700 mt-1">✓ {recipient.name}</p>
                    )}
                    {!recipientLoading && !recipient && form.recipient_phone.length >= 10 && (
                      <p className="text-xs text-red-500 mt-1">Account not found</p>
                    )}
                  </label>
                )}

                {(activeAction === "withdraw" || activeAction === "transfer") && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Wallet PIN</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.pin}
                      onChange={(event) =>
                        updateForm({ pin: event.target.value.replace(/\D/g, "").slice(0, 4) })
                      }
                      className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="Enter 4-digit PIN"
                    />
                  </label>
                )}

                {activeAction !== "transfer" && activeAction !== "fund" && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Note</span>
                    <input
                      value={form.note}
                      onChange={(event) => updateForm({ note: event.target.value })}
                      className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="Optional note"
                    />
                  </label>
                )}

                {activeAction === "fund" && (
                  <p className="text-xs text-slate-500">
                    You will be redirected to Paystack to complete payment securely.
                  </p>
                )}

                <button
                  onClick={submitAction}
                  disabled={loading}
                  className="w-full bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white px-5 py-3 rounded-lg font-semibold"
                >
                  {loading ? "Processing..." : actionLabels[activeAction]}
                </button>
              </div>
            </div>
          </section>

          <section className="hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-slate-950">Transactions</h2>
              <span className="text-sm text-slate-500">{transactions.length} recent</span>
            </div>

            {transactions.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
                <p className="text-lg font-semibold text-slate-950">
                  No wallet activity yet
                </p>
                <p className="text-slate-500 mt-2">
                  Your funds, withdrawals, transfers, plan debits, and refunds will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {transactions.map((transaction) => {
                  const isCredit = transaction.direction === "credit";

                  return (
                    <div
                      key={transaction.id}
                      className="grid sm:grid-cols-[1fr_auto] gap-3 px-5 py-4 border-b border-slate-100 last:border-b-0"
                    >
                      <div>
                        <p className="font-semibold text-slate-950">
                          {typeLabels[transaction.type] || transaction.type}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {transaction.note || "Wallet transaction"} • {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <p
                        className={`font-bold ${
                          isCredit ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatPrice(transaction.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6">Loading wallet...</div>}>
      <WalletPageContent />
    </Suspense>
  );
}
