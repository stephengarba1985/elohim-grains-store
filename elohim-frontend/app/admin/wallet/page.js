"use client";

import { useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const typeLabels = {
  fund: "Funding",
  withdraw: "Withdrawal",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  plan_payment: "Plan Auto-save",
  refund: "Refund",
  reward_bonus: "Reward Bonus",
  escrow_hold: "Escrow Hold",
  escrow_refund: "Escrow Refund",
  virtual_account_deposit: "Virtual Account Deposit",
};

export default function AdminWalletPage() {
  const [totals, setTotals] = useState({});
  const [balances, setBalances] = useState([]);
  const [virtualAccounts, setVirtualAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWalletOverview();
  }, []);

  const activeUsers = useMemo(
    () => balances.filter((item) => Number(item.balance || 0) > 0).length,
    [balances]
  );

  const fetchWalletOverview = async () => {
    try {
      setLoading(true);
      const res = await API.get("/wallet/admin/overview");
      setTotals(res.data?.totals || {});
      setBalances(Array.isArray(res.data?.balances) ? res.data.balances : []);
      setVirtualAccounts(
        Array.isArray(res.data?.virtual_accounts) ? res.data.virtual_accounts : []
      );
      setTransactions(Array.isArray(res.data?.transactions) ? res.data.transactions : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load wallet overview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Wallet Admin</h1>
          <p className="text-slate-500 mt-1">
            Monitor customer balances, refunds, transfers, savings debits, and reward bonuses.
          </p>
        </div>
        <button
          onClick={fetchWalletOverview}
          disabled={loading}
          className="bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Platform Balance</p>
          <h2 className="text-xl font-bold">{formatPrice(totals.total_balance)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Money In</p>
          <h2 className="text-xl font-bold text-green-700">{formatPrice(totals.total_credit)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Money Out</p>
          <h2 className="text-xl font-bold text-red-600">{formatPrice(totals.total_debit)}</h2>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Funded Users</p>
          <h2 className="text-xl font-bold">{activeUsers}</h2>
        </div>
      </div>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Customer Balances</h2>
          <span className="text-sm text-gray-500">{balances.length} wallet user(s)</span>
        </div>

        {balances.length === 0 ? (
          <p className="text-gray-500">No wallet activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Transactions</th>
                  <th className="py-2 pr-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 font-semibold">{item.name}</td>
                    <td className="py-3 pr-3 text-gray-600">{item.email}</td>
                    <td className="py-3 pr-3">{item.transaction_count}</td>
                    <td className="py-3 pr-3 text-right font-bold">
                      {formatPrice(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Virtual Accounts</h2>
          <span className="text-sm text-gray-500">{virtualAccounts.length} account(s)</span>
        </div>

        {virtualAccounts.length === 0 ? (
          <p className="text-gray-500">No virtual accounts generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Bank</th>
                  <th className="py-2 pr-3">Account Number</th>
                  <th className="py-2 pr-3">Deposits</th>
                  <th className="py-2 pr-3 text-right">Total Deposited</th>
                </tr>
              </thead>
              <tbody>
                {virtualAccounts.map((account) => (
                  <tr key={account.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3">
                      <p className="font-semibold">{account.user_name}</p>
                      <p className="text-xs text-gray-500">{account.user_email}</p>
                    </td>
                    <td className="py-3 pr-3">{account.bank_name}</td>
                    <td className="py-3 pr-3 font-bold">{account.account_number}</td>
                    <td className="py-3 pr-3">{account.deposit_count}</td>
                    <td className="py-3 pr-3 text-right font-bold">
                      {formatPrice(account.total_deposits)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white p-5 rounded shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Recent Wallet Transactions</h2>
          <span className="text-sm text-gray-500">{transactions.length} recent</span>
        </div>

        <div className="grid gap-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <p className="font-semibold">
                  {transaction.user_name} - {typeLabels[transaction.type] || transaction.type}
                </p>
                <p className="text-sm text-gray-500">
                  {transaction.user_email} • {formatDate(transaction.created_at)}
                </p>
                {transaction.note && (
                  <p className="text-sm text-gray-600 mt-1">{transaction.note}</p>
                )}
              </div>
              <p
                className={`font-bold ${
                  transaction.direction === "credit" ? "text-green-700" : "text-red-600"
                }`}
              >
                {transaction.direction === "credit" ? "+" : "-"}
                {formatPrice(transaction.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
