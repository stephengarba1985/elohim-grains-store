"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function RiderMap({ riders }) {
  return (
    <MapContainer
      center={[9.0765, 7.3986]} // Abuja
      zoom={13}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {riders.map((r) => (
        r.latitude && r.longitude && (
          <Marker key={r.id} position={[r.latitude, r.longitude]}>
            <Popup>
              🚚 {r.name} <br />
              {r.phone}
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
}