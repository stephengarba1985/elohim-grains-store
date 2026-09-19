import Link from "next/link";
import { notFound } from "next/navigation";
import { policies, policyEffectiveDate } from "../policyContent";

export function generateStaticParams() { return Object.keys(policies).map((slug) => ({ slug })); }

export default async function PolicyPage({ params }) {
  const { slug } = await params;
  const policy = policies[slug];
  if (!policy) notFound();
  return <main className="mx-auto max-w-3xl px-4 py-14 md:px-6"><Link href="/policies" className="text-sm font-bold text-emerald-700">← All policies</Link><p className="mt-8 text-sm text-slate-500">Effective {policyEffectiveDate}</p><h1 className="mt-2 text-4xl font-black text-slate-950">{policy.title}</h1><p className="mt-4 text-lg text-slate-600">{policy.summary}</p><div className="mt-10 space-y-8">{policy.sections.map(([heading, copy]) => <section key={heading}><h2 className="text-xl font-black text-slate-950">{heading}</h2><p className="mt-2 leading-7 text-slate-700">{copy}</p></section>)}</div><p className="mt-12 border-t pt-6 text-sm text-slate-500">For questions about this policy, contact Elohim support and include your order or account reference where relevant.</p></main>;
}
