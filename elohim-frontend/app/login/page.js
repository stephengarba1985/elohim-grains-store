"use client";

import { useState } from "react";
import Link from "next/link";
import API from "../../lib/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

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

        toast.success("Registration successful");
        setIsLogin(true);
      }
    } catch (err) {
      console.error(err);
      toast.error(isLogin ? "Login failed" : "Registration failed");
    }
  };

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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <input
                placeholder="Phone"
                className="border p-2 w-full rounded"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              <select
                className="border p-2 w-full rounded"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="retail">Retail User</option>
                <option value="bulk">Bulk Buyer</option>
              </select>
            </>
          )}

          <input
            placeholder="Email"
            className="border p-2 w-full rounded"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
  type="password"
  placeholder="Password"
  className="border p-2 w-full rounded"
  value={form.password}
  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
