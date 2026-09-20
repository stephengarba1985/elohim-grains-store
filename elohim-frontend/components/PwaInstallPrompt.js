"use client";

import { useEffect, useState } from "react";

const DISMISS_UNTIL = "elohim_pwa_install_dismissed_until";
const VISITS = "elohim_pwa_visit_count";

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return;
    if (!sessionStorage.getItem("elohim_pwa_visit_recorded")) {
      localStorage.setItem(VISITS, String(Number(localStorage.getItem(VISITS) || 0) + 1));
      sessionStorage.setItem("elohim_pwa_visit_recorded", "1");
    }
    const checkEngagement = () => setEligible(Number(localStorage.getItem(VISITS) || 0) >= 2 || Boolean(localStorage.getItem("user")) || localStorage.getItem("elohim_pwa_order_completed") === "1");
    const onBeforeInstall = (event) => { event.preventDefault(); setInstallEvent(event); };
    const onInstalled = () => { setVisible(false); setInstallEvent(null); };
    checkEngagement();
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("auth:changed", checkEngagement);
    window.addEventListener("pwa:order-completed", checkEngagement);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); window.removeEventListener("auth:changed", checkEngagement); window.removeEventListener("pwa:order-completed", checkEngagement); };
  }, []);

  useEffect(() => {
    if (installEvent && eligible && Date.now() >= Number(localStorage.getItem(DISMISS_UNTIL) || 0)) setVisible(true);
  }, [installEvent, eligible]);

  const dismiss = () => { localStorage.setItem(DISMISS_UNTIL, String(Date.now() + 1000 * 60 * 60 * 24 * 30)); setVisible(false); };
  const install = async () => { if (!installEvent) return; installEvent.prompt(); const result = await installEvent.userChoice; if (result.outcome !== "accepted") dismiss(); else setVisible(false); setInstallEvent(null); };

  if (!visible) return null;
  return <aside className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl md:bottom-6" role="dialog" aria-label="Install Elohim Grains"><button onClick={dismiss} className="absolute right-3 top-3 rounded p-2 text-slate-500" aria-label="Dismiss install suggestion">×</button><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Elohim Grains</p><h2 className="mt-1 pr-8 text-xl font-black text-slate-950">Get Elohim on your phone</h2><p className="mt-2 text-sm leading-5 text-slate-600">Faster access to shopping, orders and delivery updates.</p><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={dismiss} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700">Not now</button><button onClick={install} className="rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white">Install Elohim</button></div></aside>;
}
