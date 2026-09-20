import Link from "next/link";

export default function OfflinePage() {
  return <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-4xl">🌾</div><p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Elohim Grains</p><h1 className="mt-3 text-3xl font-black text-slate-950">You&apos;re offline</h1><p className="mt-3 leading-7 text-slate-600">Your cart is kept on this device. Reconnect to continue shopping or complete checkout.</p><Link href="/" className="mt-7 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Try again</Link></main>;
}
