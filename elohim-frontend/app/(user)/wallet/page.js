"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

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

export default function WalletPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [virtualAccount, setVirtualAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeAction, setActiveAction] = useState("fund");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    recipient_email: "",
    note: "",
  });
  const [depositForm, setDepositForm] = useState({
    amount: "",
    sender_name: "",
    reference: "",
  });

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
      setVirtualAccount(res.data?.virtual_account || null);
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const resetForm = () => {
    setForm({ amount: "", recipient_email: "", note: "" });
  };

  const confirmVirtualAccountTransfer = async () => {
    if (!virtualAccount?.account_number) {
      return toast.error("Virtual account not ready");
    }

    const amount = Number(depositForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Enter transfer amount");
    }

    try {
      setLoading(true);
      await API.post("/wallet/virtual-accounts/confirm-transfer", {
        account_number: virtualAccount.account_number,
        amount,
        sender_name: depositForm.sender_name || user?.name,
        reference: depositForm.reference,
      });

      toast.success("Transfer confirmed and wallet credited");
      setDepositForm({ amount: "", sender_name: "", reference: "" });
      fetchWallet(user?.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Transfer confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const submitAction = async () => {
    if (!user?.id) {
      return toast.error("Please log in first");
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Enter a valid amount");
    }

    try {
      setLoading(true);

      if (activeAction === "fund") {
        await API.post(`/wallet/${user.id}/fund`, {
          amount,
          note: form.note || "Wallet funding",
        });
        toast.success("Wallet funded");
      }

      if (activeAction === "withdraw") {
        await API.post(`/wallet/${user.id}/withdraw`, {
          amount,
          note: form.note || "Wallet withdrawal",
        });
        toast.success("Withdrawal recorded");
      }

      if (activeAction === "transfer") {
        await API.post(`/wallet/${user.id}/transfer`, {
          amount,
          recipient_email: form.recipient_email,
        });
        toast.success("Transfer sent");
      }

      resetForm();
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
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden lg:col-span-2">
            <div className="bg-slate-950 px-5 py-4 text-white">
              <h2 className="text-lg font-bold">Elohim Wallet Account</h2>
              <p className="text-sm text-slate-300 mt-1">
                Transfer to your personal account and your wallet is credited after confirmation.
              </p>
            </div>

            <div className="p-5 grid lg:grid-cols-[1fr_1.2fr] gap-5">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs text-slate-500">Bank</p>
                  <p className="font-bold text-slate-950 mt-1">
                    {virtualAccount?.bank_name || "Generating..."}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs text-slate-500">Account Number</p>
                  <p className="font-bold text-slate-950 mt-1">
                    {virtualAccount?.account_number || "Generating..."}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs text-slate-500">Account Name</p>
                  <p className="font-bold text-slate-950 mt-1">
                    {virtualAccount?.account_name || "ELOHIM WALLET"}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Amount Sent</span>
                  <input
                    type="number"
                    min="1"
                    value={depositForm.amount}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, amount: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                    placeholder="Amount"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Sender</span>
                  <input
                    value={depositForm.sender_name}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, sender_name: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                    placeholder="Sender name"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Reference</span>
                  <input
                    value={depositForm.reference}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, reference: event.target.value })
                    }
                    className="border border-slate-300 rounded-lg p-3 w-full mt-1"
                    placeholder="Bank ref"
                  />
                </label>
                <button
                  onClick={confirmVirtualAccountTransfer}
                  disabled={loading}
                  className="bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white px-4 py-3 rounded-lg font-semibold"
                >
                  Confirm
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
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
                      Recipient Email
                    </span>
                    <input
                      type="email"
                      value={form.recipient_email}
                      onChange={(event) =>
                        updateForm({ recipient_email: event.target.value })
                      }
                      className="border border-slate-300 rounded-lg p-3 w-full mt-1 focus:outline-none focus:ring-2 focus:ring-green-600"
                      placeholder="customer@example.com"
                    />
                  </label>
                )}

                {activeAction !== "transfer" && (
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

          <section>
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
