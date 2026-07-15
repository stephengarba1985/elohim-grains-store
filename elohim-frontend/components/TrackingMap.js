"use client";

import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

export default function TrackingMap({ rider, destination }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
  });

  if (!isLoaded) return <p>Loading map...</p>;

  return (
    <GoogleMap
      zoom={13}
      center={rider?.location || { lat: 9.0765, lng: 7.3986 }}
      mapContainerClassName="w-full h-[400px] rounded-xl"
    >
      {/* Rider */}
      {rider && <Marker position={rider.location} />}

      {/* Destination */}
      {destination && <Marker position={destination} />}
    </GoogleMap>
  );
}