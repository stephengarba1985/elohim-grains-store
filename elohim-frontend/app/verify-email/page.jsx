"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import API from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [verified, setVerified] = useState(false);

  // Verify email
  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing.");
        return;
      }

      try {
        const res = await API.get(`/auth/verify-email?token=${token}`);

        setStatus("success");
        setVerified(true);
        setMessage(
          res.data.message || "Your email has been verified successfully."
        );
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "Verification failed. The link may be invalid or expired."
        );
      }
    };

    verifyEmail();
  }, [searchParams]);

  // Auto redirect after successful verification
  useEffect(() => {
    if (!verified) return;

    const timer = setTimeout(() => {
      router.push("/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [verified, router]);

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "80px auto",
        padding: "40px",
        border: "1px solid #ddd",
        borderRadius: "10px",
        textAlign: "center",
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <h1 style={{ marginBottom: "20px" }}>🌾 Elohim Grains Store</h1>

      {status === "loading" && (
        <>
          <h2>Verifying Email...</h2>
          <p>{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <h2 style={{ color: "green" }}>✅ Email Verified</h2>

          <p>{message}</p>

          <p style={{ color: "#555", marginTop: "10px" }}>
            Redirecting to the login page in <strong>3 seconds...</strong>
          </p>

          <button
            onClick={() => router.push("/login")}
            style={{
              marginTop: "20px",
              padding: "12px 20px",
              background: "#15803d",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Go to Login Now
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <h2 style={{ color: "#dc2626" }}>❌ Verification Failed</h2>

          <p>{message}</p>

          <button
            onClick={() => router.push("/register")}
            style={{
              marginTop: "20px",
              padding: "12px 20px",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Register Again
          </button>
        </>
      )}
    </div>
  );
}