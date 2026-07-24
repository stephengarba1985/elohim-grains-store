"use client";

import { useState } from "react";
import Link from "next/link";
import API from "../../lib/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "retail",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const res = await API.post("/auth/login", {
          email: form.email,
          password: form.password,
        });

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        window.dispatchEvent(new Event("auth:changed"));

        toast.success("Login successful");

        if (res.data.user.is_admin) {
          router.push("/admin");
        } else {
          router.push("/");
        }
      } else {
        await API.post("/auth/register", form);

        toast.success("Verification email sent!");

        setRegisteredEmail(form.email);
        setRegistrationComplete(true);

        setForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "retail",
        });
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.error ||
          (isLogin ? "Login failed" : "Registration failed")
      );
    }
  };

  // Success screen after registration
  if (registrationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📧</div>

          <h1 className="text-3xl font-bold text-green-700 mb-4">
            Verify Your Email
          </h1>

          <p className="text-gray-700 mb-4">
            Your account has been created successfully.
          </p>

          <p className="text-gray-700">
            A verification email has been sent to:
          </p>

          <p className="font-bold text-lg text-green-700 mt-2 mb-4 break-all">
            {registeredEmail}
          </p>

          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-left mb-6">
            <p className="font-semibold text-yellow-700 mb-2">
              Next Steps:
            </p>

            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Open your email inbox.</li>
              <li>Click the verification link.</li>
              <li>If you can't find the email, check your Spam/Junk folder.</li>
              <li>After verifying your email, return here and log in.</li>
            </ul>
          </div>

          <button
            onClick={() => {
              setRegistrationComplete(false);
              setIsLogin(true);
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-xl p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {isLogin ? "Login to Elohim Grains" : "Create an Account"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <>
              <input
                placeholder="Name"
                className="border p-2 w-full rounded"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
              />

              <input
                placeholder="Phone"
                className="border p-2 w-full rounded"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                required
              />

              <select
                className="border p-2 w-full rounded"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
              >
                <option value="retail">Retail User</option>
                <option value="bulk">Bulk Buyer</option>
              </select>
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            className="border p-2 w-full rounded"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-2 w-full rounded"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
            required
          />

          {isLogin && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-green-600 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          <button className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded">
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p className="text-center mt-4 text-sm">
          {isLogin ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setIsLogin(false)}
                className="text-green-600 font-semibold"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setIsLogin(true)}
                className="text-blue-600 font-semibold"
              >
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}