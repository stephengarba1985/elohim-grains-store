"use client";

import { useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    let seconds = 60;
    setCountdown(seconds);

    const timer = setInterval(() => {
      seconds--;

      if (seconds <= 0) {
        clearInterval(timer);
        setCountdown(0);
      } else {
        setCountdown(seconds);
      }
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (countdown > 0) return;

    try {
      setLoading(true);

      const res = await API.post("/auth/resend-verification", {
        email,
      });

      toast.success(res.data.message);

      setSuccess(true);

      startCountdown();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          "Unable to resend verification email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8">

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-700">
            🌾 Elohim Grains Store
          </h1>

          <p className="text-gray-500 mt-2">
            Resend Verification Email
          </p>
        </div>

        {!success ? (
          <>
            <p className="text-gray-700 mb-5">
              Enter the email address you used during registration.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">

              <input
                type="email"
                required
                placeholder="Enter your email"
                className="w-full border rounded-lg p-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <button
                disabled={loading || countdown > 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 disabled:bg-gray-400"
              >
                {loading
                  ? "Sending..."
                  : countdown > 0
                  ? `Try again in ${countdown}s`
                  : "Resend Verification Email"}
              </button>

            </form>
          </>
        ) : (
          <div className="text-center">

            <div className="text-6xl mb-4">
              📧
            </div>

            <h2 className="text-2xl font-bold text-green-700 mb-3">
              Email Sent
            </h2>

            <p className="text-gray-700 mb-5">
              A new verification email has been sent to:
            </p>

            <p className="font-bold text-green-700 break-all mb-6">
              {email}
            </p>

            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-left mb-6">
              <ul className="list-disc list-inside text-sm space-y-2">
                <li>Open your inbox.</li>
                <li>Click the verification link.</li>
                <li>Check Spam/Junk if you don't see it.</li>
              </ul>
            </div>

            {countdown > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                You can request another email in {countdown} seconds.
              </p>
            )}

          </div>
        )}

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-green-700 hover:underline font-semibold"
          >
            ← Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}