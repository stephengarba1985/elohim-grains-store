"use client";

import { useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await API.post("/users/forgot-password", {
        email,
      });

      toast.success(res.data.message);

      setEmail("");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-8">

        <h1 className="text-2xl font-bold text-center mb-2">
          Forgot Password
        </h1>

        <p className="text-gray-500 text-center mb-6">
          Enter your email address and we'll send you a password reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="email"
            required
            placeholder="Email Address"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="w-full border rounded-lg p-3"
          />

          <button
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 text-white rounded-lg p-3 font-semibold"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

        </form>

        <Link
          href="/login"
          className="block text-center text-green-700 mt-6"
        >
          Back to Login
        </Link>

      </div>
    </div>
  );
}