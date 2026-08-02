"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
    fetchStats();
  }, []);

  useEffect(() => {
    const keyword = search.toLowerCase();

    setFiltered(
      customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(keyword) ||
          c.email?.toLowerCase().includes(keyword) ||
          c.phone?.toLowerCase().includes(keyword)
      )
    );
  }, [search, customers]);

  const fetchCustomers = async () => {
    try {
      const res = await API.get("/customers");
      setCustomers(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/customers/stats");
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCustomer = async (id) => {
    if (!confirm("Delete this customer?")) return;

    try {
      await API.delete(`/customers/${id}`);
      toast.success("Customer deleted");
      fetchCustomers();
      fetchStats();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const formatPrice = (amount) =>
    `₦${Number(amount || 0).toLocaleString()}`;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Customer Management
      </h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">

        <div className="bg-white shadow rounded p-5">
          <p className="text-gray-500">Customers</p>
          <h2 className="text-3xl font-bold">
            {stats.customers || 0}
          </h2>
        </div>

        <div className="bg-white shadow rounded p-5">
          <p className="text-gray-500">Total Users</p>
          <h2 className="text-3xl font-bold">
            {stats.total_customers || 0}
          </h2>
        </div>

      </div>

      <input
        className="border rounded w-full p-3 mb-5"
        placeholder="Search customer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="overflow-auto bg-white rounded shadow">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-3 text-left">Customer</th>

              <th>Email</th>

              <th>Phone</th>

              <th>Orders</th>

              <th>Spent</th>

              <th>Action</th>

            </tr>

          </thead>

          <tbody>

            {filtered.map((customer) => (

              <tr
                key={customer.id}
                className="border-t"
              >

                <td className="p-3">
                  {customer.name}
                </td>

                <td>
                  {customer.email}
                </td>

                <td>
                  {customer.phone}
                </td>

                <td>
                  {customer.total_orders}
                </td>

                <td className="font-semibold text-green-700">
                  {formatPrice(customer.total_spent)}
                </td>

                <td>

                  <button
                    onClick={() =>
                      deleteCustomer(customer.id)
                    }
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}