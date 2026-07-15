"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import API from "../../../lib/api";
import toast from "react-hot-toast";

const steps = ["pending", "processing", "assigned", "in_transit", "delivered"];

const statusLabel = (value) =>
  String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

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

export default function TrackOrder() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const currentStatus = data?.delivery?.status || data?.order?.status || data?.status || "pending";
  const activeStep = Math.max(0, steps.indexOf(currentStatus));

  const etaText = useMemo(() => {
    const eta = data?.delivery?.eta || data?.order?.eta;
    return eta || "Waiting for rider assignment";
  }, [data]);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/tracking/${id}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to load tracking");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-950">Loading delivery tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-green-200">
            Delivery Tracking
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black md:text-5xl">
                Order #{data.order?.id || data.id}
              </h1>
              <p className="mt-3 text-slate-300">
                Live rider status, ETA updates, and delivery OTP confirmation.
              </p>
            </div>
            <button
              onClick={fetchTracking}
              disabled={loading}
              className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-950 disabled:text-slate-400"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Delivery Status</p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {statusLabel(currentStatus)}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">ETA</p>
            <p className="mt-1 text-xl font-black text-green-700">{etaText}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Delivery OTP</p>
            <p className="mt-1 text-xl font-black text-amber-600">
              {data.delivery?.otp_confirmed ? "Confirmed" : data.delivery?.otp || "Pending"}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Rider</p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {data.rider?.name || "Not assigned"}
            </p>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Delivery progress</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`rounded-lg border p-4 ${
                  index <= activeStep
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    index <= activeStep ? "text-green-700" : "text-slate-500"
                  }`}
                >
                  {statusLabel(step)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Rider tracking</h2>
            {data.rider ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">Rider Name</p>
                  <p className="mt-1 font-bold text-slate-950">{data.rider.name}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="mt-1 font-bold text-slate-950">{data.rider.phone}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">Latitude</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {data.rider.location?.lat}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-500">Longitude</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {data.rider.location?.lng}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-slate-500">
                A rider has not been assigned to this order yet.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Delivery OTP</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Share this OTP with the rider only when your grains arrive.
            </p>
            <div className="mt-5 rounded-lg bg-slate-950 p-5 text-center text-white">
              <p className="text-3xl font-black tracking-widest">
                {data.delivery?.otp_confirmed ? "DONE" : data.delivery?.otp || "WAIT"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Status history</h2>
          <div className="mt-4 space-y-3">
            {(data.events || []).map((event, index) => (
              <div key={`${event.status}-${index}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{statusLabel(event.status)}</p>
                    <p className="text-sm text-slate-500">{event.note || "Delivery update"}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
                </div>
              </div>
            ))}
            {(data.events || []).length === 0 && (
              <p className="text-sm text-slate-500">No delivery events yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
