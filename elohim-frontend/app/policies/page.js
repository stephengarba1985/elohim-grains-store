import Link from "next/link";
import { policies, policyEffectiveDate } from "./policyContent";

export const metadata = { title: "Policies | Elohim Grains" };

export default function PoliciesPage() {
  return <main className="mx-auto max-w-5xl px-4 py-14 md:px-6"><p className="text-sm font-bold text-emerald-700">Elohim Grains</p><h1 className="mt-2 text-4xl font-black text-slate-950">Policies & customer transparency</h1><p className="mt-4 max-w-3xl text-slate-600">These policies explain how Elohim works today. They are effective from {policyEffectiveDate} and will be updated when our services or applicable obligations change.</p><div className="mt-10 grid gap-4 sm:grid-cols-2">{Object.entries(policies).map(([slug, policy]) => <Link key={slug} href={`/policies/${slug}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-400 hover:shadow"><h2 className="text-lg font-black text-slate-950">{policy.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{policy.summary}</p><span className="mt-4 inline-block text-sm font-bold text-emerald-700">Read policy →</span></Link>)}</div></main>;
}
