"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import API from "@/lib/api";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatCompact = (value) => {
  const amount = Number(value || 0);

  if (Math.abs(amount) >= 1000000) return `NGN ${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `NGN ${(amount / 1000).toFixed(0)}K`;

  return `NGN ${amount.toLocaleString()}`;
};

const formatDate = (date) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const monthKey = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
  });

const samplePlans = [
  {
    id: "GP-1201",
    product_name: "Rice",
    variant_weight: "50kg",
    total_amount: 240000,
    amount_paid: 168000,
    reward_amount: 7200,
    reward_rate: 0.03,
    payment_frequency: "weekly",
    status: "active",
    maturity_date: "2026-09-16T00:00:00Z",
  },
  {
    id: "GP-1192",
    product_name: "Beans",
    variant_weight: "25kg",
    total_amount: 96000,
    amount_paid: 96000,
    reward_amount: 1920,
    reward_rate: 0.02,
    payment_frequency: "monthly",
    status: "completed",
    maturity_date: "2026-06-01T00:00:00Z",
  },
  {
    id: "GP-1217",
    product_name: "Maize",
    variant_weight: "100kg",
    total_amount: 185000,
    amount_paid: 74000,
    reward_amount: 5550,
    reward_rate: 0.03,
    payment_frequency: "weekly",
    status: "active",
    maturity_date: "2026-10-16T00:00:00Z",
  },
];

const sampleTransactions = [
  { id: 1, direction: "debit", type: "order_payment", amount: 52000, created_at: "2026-01-18T09:00:00Z" },
  { id: 2, direction: "debit", type: "plan_payment", amount: 40000, created_at: "2026-02-10T09:00:00Z" },
  { id: 3, direction: "debit", type: "order_payment", amount: 68500, created_at: "2026-03-15T09:00:00Z" },
  { id: 4, direction: "debit", type: "warehouse_purchase", amount: 91000, created_at: "2026-04-09T09:00:00Z" },
  { id: 5, direction: "debit", type: "plan_payment", amount: 55000, created_at: "2026-05-12T09:00:00Z" },
  { id: 6, direction: "debit", type: "order_payment", amount: 74000, created_at: "2026-06-11T09:00:00Z" },
];

const sampleOrders = [
  { id: 101, total_amount: 52000, created_at: "2026-01-18T09:00:00Z", status: "delivered" },
  { id: 102, total_amount: 68500, created_at: "2026-03-15T09:00:00Z", status: "delivered" },
  { id: 103, total_amount: 74000, created_at: "2026-06-11T09:00:00Z", status: "processing" },
];

const sampleHoldings = [
  {
    id: "WH-410",
    grain_name: "Rice",
    quantity_bags: 4,
    purchase_value: 276000,
    market_value: 318000,
    unrealized_profit: 42000,
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "WH-411",
    grain_name: "Maize",
    quantity_bags: 6,
    purchase_value: 210000,
    market_value: 231000,
    unrealized_profit: 21000,
    created_at: "2026-04-12T00:00:00Z",
  },
];

const performanceColors = ["#166534", "#0f172a", "#d97706", "#2563eb"];

function StatCard({ label, value, change, tone = "slate" }) {
  const tones = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-bold">{change}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="h-72">{children}</div>
    </section>
  );
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
      Loading chart
    </div>
  );
}

function buildMonthlySpending(transactions, orders) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const byMonth = months.map((month) => ({
    month,
    spending: 0,
    savings: 0,
    warehouse: 0,
  }));

  const addToMonth = (date, key, amount) => {
    const month = monthKey(date);
    const item = byMonth.find((entry) => entry.month === month);
    if (item) item[key] += Number(amount || 0);
  };

  orders.forEach((order) => addToMonth(order.created_at, "spending", order.total_amount));

  transactions.forEach((transaction) => {
    if (transaction.direction !== "debit") return;
    if (transaction.type === "plan_payment") addToMonth(transaction.created_at, "savings", transaction.amount);
    if (transaction.type === "warehouse_purchase") addToMonth(transaction.created_at, "warehouse", transaction.amount);
    if (!["plan_payment", "warehouse_purchase"].includes(transaction.type)) {
      addToMonth(transaction.created_at, "spending", transaction.amount);
    }
  });

  return byMonth;
}

function buildGrowthData(plans, holdings) {
  const totalSavings = plans.reduce((sum, plan) => sum + Number(plan.amount_paid || 0), 0);
  const marketValue = holdings.reduce((sum, holding) => {
    const fallback = Number(holding.quantity_bags || 0) * Number(holding.current_market_price || 0);
    return sum + Number(holding.market_value || fallback || 0);
  }, 0);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return months.map((month, index) => {
    const progress = (index + 1) / months.length;
    const seasonalLift = index > 2 ? 1 + index * 0.018 : 1 + index * 0.01;

    return {
      month,
      savings: Math.round(totalSavings * progress),
      grainValue: Math.round(marketValue * progress * seasonalLift),
    };
  });
}

export default function FinancialAnalyticsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState(samplePlans);
  const [transactions, setTransactions] = useState(sampleTransactions);
  const [orders, setOrders] = useState(sampleOrders);
  const [holdings, setHoldings] = useState(sampleHoldings);
  const [chartsReady, setChartsReady] = useState(false);

  const loadAnalytics = async () => {
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        setLoading(false);
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setLoading(true);

      const [walletRes, plansRes, ordersRes, warehouseRes] = await Promise.allSettled([
        API.get(`/wallet/${parsedUser.id}`),
        API.get(`/plans/user/${parsedUser.id}`),
        API.get(`/orders/user/${parsedUser.id}`),
        API.get(`/warehouse/${parsedUser.id}`),
      ]);

      if (walletRes.status === "fulfilled" && Array.isArray(walletRes.value.data?.transactions)) {
        setTransactions(
          walletRes.value.data.transactions.length
            ? walletRes.value.data.transactions
            : sampleTransactions
        );
      }

      if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value.data)) {
        setPlans(plansRes.value.data.length ? plansRes.value.data : samplePlans);
      }

      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value.data)) {
        setOrders(ordersRes.value.data.length ? ordersRes.value.data : sampleOrders);
      }

      if (warehouseRes.status === "fulfilled" && Array.isArray(warehouseRes.value.data?.holdings)) {
        setHoldings(
          warehouseRes.value.data.holdings.length
            ? warehouseRes.value.data.holdings
            : sampleHoldings
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Using demo analytics until your account data loads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setChartsReady(true);
    loadAnalytics();
  }, []);

  const analytics = useMemo(() => {
    const totalSavings = plans.reduce((sum, plan) => sum + Number(plan.amount_paid || 0), 0);
    const savingsTarget = plans.reduce((sum, plan) => sum + Number(plan.total_amount || 0), 0);
    const activePlans = plans.filter((plan) => String(plan.status || "active").toLowerCase() !== "completed");
    const projectedRewards = plans.reduce((sum, plan) => {
      const total = Number(plan.total_amount || 0);
      return sum + Number(plan.reward_amount || total * Number(plan.reward_rate || 0));
    }, 0);

    const purchaseValue = holdings.reduce((sum, holding) => {
      const fallback = Number(holding.quantity_bags || 0) * Number(holding.purchase_price || 0);
      return sum + Number(holding.purchase_value || fallback || 0);
    }, 0);
    const marketValue = holdings.reduce((sum, holding) => {
      const fallback = Number(holding.quantity_bags || 0) * Number(holding.current_market_price || 0);
      return sum + Number(holding.market_value || fallback || 0);
    }, 0);
    const grainGrowth = marketValue - purchaseValue;
    const monthlySpending = buildMonthlySpending(transactions, orders);
    const currentMonthSpend = monthlySpending[monthlySpending.length - 1]?.spending || 0;
    const investmentGain = grainGrowth + projectedRewards;
    const investedCapital = purchaseValue + totalSavings;
    const performanceRate = investedCapital ? (investmentGain / investedCapital) * 100 : 0;

    return {
      totalSavings,
      savingsTarget,
      activePlans,
      projectedRewards,
      purchaseValue,
      marketValue,
      grainGrowth,
      monthlySpending,
      currentMonthSpend,
      investmentGain,
      performanceRate,
      growthData: buildGrowthData(plans, holdings),
      allocation: [
        { name: "Savings", value: totalSavings },
        { name: "Warehouse value", value: marketValue },
        { name: "Projected rewards", value: projectedRewards },
        { name: "Grain growth", value: Math.max(grainGrowth, 0) },
      ].filter((item) => item.value > 0),
    };
  }, [holdings, orders, plans, transactions]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-green-700">
                Financial Analytics
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
                Your grain money performance dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Track total savings, grain value growth, monthly spending,
                active plans, and investment performance from one professional
                dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={loadAnalytics}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-800 hover:bg-slate-50 disabled:text-slate-400"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link
                href="/user/plans"
                className="rounded-lg bg-green-700 px-5 py-3 text-center font-bold text-white shadow-sm hover:bg-green-800"
              >
                Manage Plans
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total savings"
              value={formatPrice(analytics.totalSavings)}
              change={`${Math.round((analytics.totalSavings / Math.max(analytics.savingsTarget, 1)) * 100)}% of targets funded`}
              tone="green"
            />
            <StatCard
              label="Grain value growth"
              value={formatPrice(analytics.grainGrowth)}
              change={`${formatPrice(analytics.marketValue)} current value`}
              tone="amber"
            />
            <StatCard
              label="Monthly spending"
              value={formatPrice(analytics.currentMonthSpend)}
              change="Current month order activity"
              tone="slate"
            />
            <StatCard
              label="Active plans"
              value={analytics.activePlans.length}
              change={`${plans.length} total grain plans`}
              tone="blue"
            />
            <StatCard
              label="Investment performance"
              value={`${analytics.performanceRate.toFixed(1)}%`}
              change={`${formatPrice(analytics.investmentGain)} gain + rewards`}
              tone="green"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 xl:grid-cols-[1.35fr_0.9fr]">
        <ChartCard
          title="Savings and Grain Value Growth"
          subtitle="Projected account value across the current half year"
        >
          {chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={analytics.growthData}>
                <defs>
                  <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="grainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis tickFormatter={formatCompact} stroke="#64748b" width={86} />
                <Tooltip formatter={(value) => formatPrice(value)} />
                <Area type="monotone" dataKey="savings" name="Savings" stroke="#16a34a" fill="url(#savingsFill)" strokeWidth={3} />
                <Area type="monotone" dataKey="grainValue" name="Grain value" stroke="#d97706" fill="url(#grainFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        <ChartCard
          title="Investment Allocation"
          subtitle="Savings, storage value, rewards, and growth"
        >
          {chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={analytics.allocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={3}
                >
                  {analytics.allocation.map((entry, index) => (
                    <Cell key={entry.name} fill={performanceColors[index % performanceColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPrice(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        <ChartCard
          title="Monthly Spending"
          subtitle="Orders, savings contributions, and warehouse purchases"
        >
          {chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={analytics.monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis tickFormatter={formatCompact} stroke="#64748b" width={86} />
                <Tooltip formatter={(value) => formatPrice(value)} />
                <Bar dataKey="spending" name="Orders" stackId="a" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" name="Savings" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="warehouse" name="Warehouse" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Performance Snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current return from grain storage and savings rewards.
          </p>

          <div className="mt-5 space-y-4">
            {[
              ["Stored grain purchase value", analytics.purchaseValue],
              ["Current grain market value", analytics.marketValue],
              ["Projected savings rewards", analytics.projectedRewards],
              ["Total gain and rewards", analytics.investmentGain],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-right font-black text-slate-950">{formatPrice(value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-slate-950 p-5 text-white">
            <p className="text-sm font-semibold text-slate-300">Estimated portfolio return</p>
            <p className="mt-2 text-4xl font-black">{analytics.performanceRate.toFixed(1)}%</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Based on completed and active savings rewards plus unrealized
              warehouse grain growth.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Active Plans</h2>
              <p className="text-sm text-slate-500">
                Savings progress, maturity dates, and expected rewards.
              </p>
            </div>
            <Link
              href="/user/receipts-statements"
              className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Statements
            </Link>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Saved</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Maturity</th>
                  <th className="px-4 py-3">Reward</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activePlans.map((plan) => {
                  const paid = Number(plan.amount_paid || 0);
                  const total = Number(plan.total_amount || 0);
                  const progress = Math.min(100, Math.round((paid / Math.max(total, 1)) * 100));
                  const reward = Number(plan.reward_amount || total * Number(plan.reward_rate || 0));

                  return (
                    <tr key={plan.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-950">
                        {plan.product_name || "Grain plan"} {plan.variant_weight || ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{plan.payment_frequency || "monthly"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatPrice(paid)}</td>
                      <td className="px-4 py-3">
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-green-600"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-500">{progress}%</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(plan.maturity_date)}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatPrice(reward)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
