"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function UserProfileCard() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedUser = localStorage.getItem("user");

    if (!storedUser) return;

    try {
      const parsedUser = JSON.parse(storedUser);
      setProfile((prev) => ({
        ...prev,
        name: parsedUser.name || prev.name,
        email: parsedUser.email || prev.email,
        phone: parsedUser.phone || prev.phone,
        address: parsedUser.address || prev.address,
      }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const saveProfile = async () => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      toast.error("Please login first");
      return;
    }

    if (isSaving) return;

    try {
      setIsSaving(true);
      const { data } = await API.put("/users/profile", {
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
      });

      setProfile((prev) => ({
        ...prev,
        name: data?.name ?? prev.name,
        email: data?.email ?? prev.email,
        phone: data?.phone ?? prev.phone,
        address: data?.address ?? prev.address,
      }));

      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          const updatedUser = {
            ...parsedUser,
            ...data,
            name: data?.name ?? parsedUser.name,
            email: data?.email ?? parsedUser.email,
            phone: data?.phone ?? parsedUser.phone,
            address: data?.address ?? parsedUser.address,
          };
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
      }

      toast.success("Profile updated successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      toast.error("Please login first");
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (isUpdatingPassword) return;

    try {
      setIsUpdatingPassword(true);
      await API.put("/users/change-password", password);

      toast.success("Password updated");

      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Password update failed");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 mb-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <div className="inline-flex w-fit items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
          Account
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-950">My Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Keep your contact details accurate and secure.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Full Name</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={profile.name}
            onChange={(e) =>
              setProfile({
                ...profile,
                name: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Email</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-sm"
            value={profile.email}
            disabled
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Phone</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={profile.phone || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                phone: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Address</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={profile.address || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                address: e.target.value,
              })
            }
          />
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={isSaving}
        className="mt-6 inline-flex items-center rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-400"
      >
        {isSaving ? "Saving..." : "Save Profile"}
      </button>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-slate-950">Change Password</h3>
          <p className="text-sm text-slate-600">
            Update your password to keep your account secure.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input
            type="password"
            placeholder="Current Password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={password.currentPassword}
            onChange={(e) =>
              setPassword({
                ...password,
                currentPassword: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="New Password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={password.newPassword}
            onChange={(e) =>
              setPassword({
                ...password,
                newPassword: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            value={password.confirmPassword}
            onChange={(e) =>
              setPassword({
                ...password,
                confirmPassword: e.target.value,
              })
            }
          />
        </div>

        <button
          onClick={changePassword}
          disabled={isUpdatingPassword}
          className="mt-6 inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUpdatingPassword ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}