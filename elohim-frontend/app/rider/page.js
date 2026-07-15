"use client";

import { useEffect, useState } from "react";
import API from "../../lib/api";

export default function RiderPage() {
  const [riderId, setRiderId] = useState("");

  useEffect(() => {
    if (!riderId) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        try {
          await API.put(`/riders/location/${riderId}`, {
            latitude,
            longitude,
          });

        } catch (err) {
          console.error(err);
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [riderId]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">
        Rider Tracking 📍
      </h1>

      <input
        placeholder="Enter Rider ID"
        value={riderId}
        onChange={(e) => setRiderId(e.target.value)}
        className="border p-2 rounded"
      />
    </div>
  );
}
