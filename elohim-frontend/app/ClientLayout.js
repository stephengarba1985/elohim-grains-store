"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const hidePublicNavbar = pathname?.startsWith("/admin");

  const loadUser = () => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error(err);
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();

    window.addEventListener("auth:changed", loadUser);
    window.addEventListener("storage", loadUser);

    return () => {
      window.removeEventListener("auth:changed", loadUser);
      window.removeEventListener("storage", loadUser);
    };
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    setUser(null);
    window.dispatchEvent(new Event("auth:changed"));
    window.location.href = "/login";
  };

  return (
    <>
      {!hidePublicNavbar && <Navbar user={user} logout={logout} />}
      {children}
      {!hidePublicNavbar && <Footer />}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </>
  );
}
