"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

const formatMoney = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const formatDate = (date, options = {}) => {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
};

const formatMonth = (date = new Date()) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

const documentTypes = [
  {
    id: "receipt",
    label: "PDF Receipts",
    title: "Transaction receipt",
    description: "Issue clean wallet and order confirmations with reference IDs.",
  },
  {
    id: "statement",
    label: "Monthly Statements",
    title: "Monthly account statement",
    description: "Summarize money in, money out, closing balance, and activity.",
  },
  {
    id: "savings",
    label: "Savings History",
    title: "Savings history",
    description: "Track plan contributions, progress, maturity dates, and rewards.",
  },
  {
    id: "invoice",
    label: "Tax Invoice",
    title: "Tax invoice",
    description: "Generate VAT-ready grain purchase invoices for business records.",
  },
];

const sampleTransactions = [
  {
    id: "TX-240618-01",
    type: "virtual_account_deposit",
    direction: "credit",
    amount: 120000,
    note: "Virtual account transfer confirmed",
    created_at: "2026-06-12T09:12:00Z",
  },
  {
    id: "TX-240618-02",
    type: "plan_payment",
    direction: "debit",
    amount: 25000,
    note: "Scheduled auto debit for grain savings plan",
    created_at: "2026-06-14T08:00:00Z",
  },
  {
    id: "TX-240618-03",
    type: "transfer_out",
    direction: "debit",
    amount: 18000,
    note: "Transfer to cooperative buyer",
    created_at: "2026-06-15T16:30:00Z",
  },
];

const samplePlans = [
  {
    id: "GP-1201",
    product_name: "Rice",
    variant_weight: "50kg",
    quantity: 3,
    total_amount: 225000,
    amount_paid: 150000,
    reward_amount: 6750,
    reward_rate: 0.03,
    payment_frequency: "weekly",
    status: "active",
    maturity_date: "2026-09-16T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "GP-1198",
    product_name: "Beans",
    variant_weight: "25kg",
    quantity: 2,
    total_amount: 88000,
    amount_paid: 88000,
    reward_amount: 1760,
    reward_rate: 0.02,
    payment_frequency: "monthly",
    status: "completed",
    maturity_date: "2026-06-01T00:00:00Z",
    created_at: "2026-03-01T00:00:00Z",
  },
];

const sampleOrder = {
  id: "EG-INV-2406",
  created_at: "2026-06-10T11:45:00Z",
  status: "paid",
  total_amount: 154500,
  payment_status: "verified",
};

const invoiceItems = [
  { name: "Premium Rice", weight: "50kg bag", quantity: 2, price: 69000 },
  { name: "Cowpea Beans", weight: "10kg pack", quantity: 1, price: 16500 },
];

const typeLabels = {
  fund: "Wallet funding",
  withdraw: "Withdrawal",
  transfer_in: "Transfer received",
  transfer_out: "Transfer sent",
  plan_payment: "Grain plan contribution",
  refund: "Refund",
  reward_bonus: "Savings reward",
  escrow_hold: "Escrow hold",
  escrow_refund: "Escrow refund",
  virtual_account_deposit: "Virtual account deposit",
};

function Pill({ tone = "slate", children }) {
  const tones = {
    green: "bg-green-50 text-green-700 ring-green-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MoneyCell({ value, direction }) {
  return (
    <span className={direction === "credit" ? "text-green-700" : "text-slate-950"}>
      {direction === "credit" ? "+" : "-"}{formatMoney(value)}
    </span>
  );
}

function DocumentShell({ title, reference, children, meta }) {
  return (
    <article className="print-document rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-green-700">
              Elohim Grains
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">Reference: {reference}</p>
          </div>
          <div className="rounded-lg bg-slate-950 p-4 text-sm text-white">
            <p className="font-bold">Elohim Grains Store</p>
            <p className="mt-1 text-slate-300">Agro fintech document</p>
            <p className="mt-3 text-slate-300">Generated {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {meta.map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 font-black text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">{children}</div>

      <div className="border-t border-slate-200 p-6 text-xs leading-6 text-slate-500">
        This computer-generated document is valid without a signature. For
        support, contact Elohim Grains with the reference number above.
      </div>
    </article>
  );
}

function ReceiptDocument({ transaction, user }) {
  return (
    <DocumentShell
      title="Transaction Receipt"
      reference={`EG-RCPT-${transaction.id}`}
      meta={[
        { label: "Customer", value: user?.name || "Elohim Customer" },
        { label: "Date", value: formatDate(transaction.created_at) },
        { label: "Status", value: "Successful" },
      ]}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Transaction details
          </p>
          <dl className="mt-4 grid gap-3">
            {[
              ["Type", typeLabels[transaction.type] || transaction.type || "Transaction"],
              ["Narration", transaction.note || "Elohim wallet transaction"],
              ["Direction", transaction.direction === "credit" ? "Credit" : "Debit"],
              ["Transaction ID", transaction.id],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-right text-sm font-bold text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-lg bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-700">Amount</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {formatMoney(transaction.amount)}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Posted to Elohim wallet ledger.
          </p>
        </div>
      </div>
    </DocumentShell>
  );
}

function StatementDocument({ transactions, user, balance }) {
  const totals = transactions.reduce(
    (sum, transaction) => {
      const amount = Number(transaction.amount || 0);
      if (transaction.direction === "credit") sum.credit += amount;
      if (transaction.direction === "debit") sum.debit += amount;
      return sum;
    },
    { credit: 0, debit: 0 }
  );

  return (
    <DocumentShell
      title={`${formatMonth()} Statement`}
      reference={`EG-STMT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
      meta={[
        { label: "Account holder", value: user?.name || "Elohim Customer" },
        { label: "Money in", value: formatMoney(totals.credit) },
        { label: "Closing balance", value: formatMoney(balance) },
      ]}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-green-50 p-4">
          <p className="text-xs font-bold text-green-700">Credits</p>
          <p className="mt-1 text-xl font-black">{formatMoney(totals.credit)}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-xs font-bold text-red-700">Debits</p>
          <p className="mt-1 text-xl font-black">{formatMoney(totals.debit)}</p>
        </div>
        <div className="rounded-lg bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold text-slate-300">Net movement</p>
          <p className="mt-1 text-xl font-black">{formatMoney(totals.credit - totals.debit)}</p>
        </div>
      </div>

      <DocumentTable
        headers={["Date", "Description", "Type", "Amount"]}
        rows={transactions.map((transaction) => [
          formatDate(transaction.created_at),
          transaction.note || typeLabels[transaction.type] || "Wallet activity",
          transaction.direction === "credit" ? "Credit" : "Debit",
          <MoneyCell
            key={transaction.id}
            value={transaction.amount}
            direction={transaction.direction}
          />,
        ])}
      />
    </DocumentShell>
  );
}

function SavingsDocument({ plans, user }) {
  const totals = plans.reduce(
    (sum, plan) => {
      sum.target += Number(plan.total_amount || 0);
      sum.paid += Number(plan.amount_paid || 0);
      sum.reward += Number(plan.reward_amount || 0);
      return sum;
    },
    { target: 0, paid: 0, reward: 0 }
  );

  return (
    <DocumentShell
      title="Savings History"
      reference={`EG-SAVE-${user?.id || "DEMO"}-${new Date().getFullYear()}`}
      meta={[
        { label: "Customer", value: user?.name || "Elohim Customer" },
        { label: "Saved to date", value: formatMoney(totals.paid) },
        { label: "Projected reward", value: formatMoney(totals.reward) },
      ]}
    >
      <DocumentTable
        headers={["Plan", "Frequency", "Progress", "Maturity", "Reward"]}
        rows={plans.map((plan) => {
          const paid = Number(plan.amount_paid || 0);
          const total = Number(plan.total_amount || 0);
          const progress = total ? Math.round((paid / total) * 100) : 0;

          return [
            `${plan.product_name || "Grain plan"} ${plan.variant_weight || ""}`.trim(),
            plan.payment_frequency || "monthly",
            `${formatMoney(paid)} / ${formatMoney(total)} (${progress}%)`,
            formatDate(plan.maturity_date),
            formatMoney(plan.reward_amount || total * Number(plan.reward_rate || 0)),
          ];
        })}
      />
    </DocumentShell>
  );
}

function InvoiceDocument({ order, user }) {
  const subTotal = invoiceItems.reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const vat = Math.round(subTotal * 0.075);
  const total = Number(order?.total_amount || subTotal + vat);

  return (
    <DocumentShell
      title="Tax Invoice"
      reference={`EG-TINV-${order?.id || "DEMO"}`}
      meta={[
        { label: "Bill to", value: user?.name || "Elohim Customer" },
        { label: "Invoice date", value: formatDate(order?.created_at || new Date()) },
        { label: "Payment", value: order?.payment_status || order?.status || "verified" },
      ]}
    >
      <DocumentTable
        headers={["Item", "Qty", "Unit price", "Line total"]}
        rows={invoiceItems.map((item) => [
          `${item.name} (${item.weight})`,
          item.quantity,
          formatMoney(item.price),
          formatMoney(item.price * item.quantity),
        ])}
      />
      <div className="ml-auto mt-6 max-w-sm space-y-3 rounded-lg bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-bold text-slate-950">{formatMoney(subTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">VAT 7.5%</span>
          <span className="font-bold text-slate-950">{formatMoney(vat)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-3 text-lg">
          <span className="font-black text-slate-950">Total</span>
          <span className="font-black text-green-700">{formatMoney(total)}</span>
        </div>
      </div>
    </DocumentShell>
  );
}

function DocumentTable({ headers, rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-950 text-white">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-200">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReceiptsStatementsPage() {
  const [activeType, setActiveType] = useState("receipt");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance: 0, transactions: sampleTransactions });
  const [plans, setPlans] = useState(samplePlans);
  const [orders, setOrders] = useState([sampleOrder]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const storedUser = localStorage.getItem("user");

        if (!storedUser) {
          setLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        const [walletRes, plansRes, ordersRes] = await Promise.allSettled([
          API.get(`/wallet/${parsedUser.id}`),
          API.get(`/plans/user/${parsedUser.id}`),
          API.get(`/orders/user/${parsedUser.id}`),
        ]);

        if (walletRes.status === "fulfilled") {
          setWallet({
            balance: Number(walletRes.value.data?.balance || 0),
            transactions: walletRes.value.data?.transactions?.length
              ? walletRes.value.data.transactions
              : sampleTransactions,
          });
        }

        if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value.data)) {
          setPlans(plansRes.value.data.length ? plansRes.value.data : samplePlans);
        }

        if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value.data)) {
          setOrders(ordersRes.value.data.length ? ordersRes.value.data : [sampleOrder]);
        }
      } catch (err) {
        console.error(err);
        toast.error("Using sample documents until your account data loads");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const selectedTransaction = wallet.transactions[0] || sampleTransactions[0];
  const selectedOrder = orders[0] || sampleOrder;

  const summary = useMemo(() => {
    const credits = wallet.transactions
      .filter((item) => item.direction === "credit")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const debits = wallet.transactions
      .filter((item) => item.direction === "debit")
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const saved = plans.reduce((total, plan) => total + Number(plan.amount_paid || 0), 0);

    return { credits, debits, saved };
  }, [plans, wallet.transactions]);

  const printDocument = () => {
    const active = documentTypes.find((item) => item.id === activeType);
    const previousTitle = document.title;
    document.title = `Elohim Grains - ${active?.title || "Document"}`;
    window.print();
    document.title = previousTitle;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .print-area,
          .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            inset: 0;
            width: 100%;
            background: white;
          }

          .print-document {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-green-700">
                Receipts & Statements
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
                Professional financial documents
              </h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Generate PDF-ready receipts, monthly statements, savings history,
                and tax invoices from your Elohim wallet and grain activity.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={printDocument}
                className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white shadow-sm hover:bg-slate-800"
              >
                Generate PDF
              </button>
              <Link
                href="/user/wallet"
                className="rounded-lg border border-slate-300 px-5 py-3 text-center font-bold text-slate-800 hover:bg-white"
              >
                Wallet
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Documents", "4 formats", "slate"],
              ["Money in", formatMoney(summary.credits), "green"],
              ["Money out", formatMoney(summary.debits), "red"],
              ["Savings paid", formatMoney(summary.saved), "amber"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <Pill tone={tone}>{loading ? "Syncing" : "Ready"}</Pill>
                </div>
                <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[320px_1fr]">
        <aside className="no-print space-y-3">
          {documentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                activeType === type.id
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-black text-slate-950">{type.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{type.description}</p>
            </button>
          ))}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-black text-slate-950">Document controls</p>
            <div className="mt-4 grid gap-2">
              <button
                onClick={printDocument}
                className="rounded-lg bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800"
              >
                Save as PDF
              </button>
              <button
                onClick={() => toast.success("Document queued for email")}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Email copy
              </button>
            </div>
          </div>
        </aside>

        <div className="print-area">
          {activeType === "receipt" && (
            <ReceiptDocument transaction={selectedTransaction} user={user} />
          )}
          {activeType === "statement" && (
            <StatementDocument
              transactions={wallet.transactions}
              user={user}
              balance={wallet.balance}
            />
          )}
          {activeType === "savings" && <SavingsDocument plans={plans} user={user} />}
          {activeType === "invoice" && (
            <InvoiceDocument order={selectedOrder} user={user} />
          )}
        </div>
      </section>
    </main>
  );
}
