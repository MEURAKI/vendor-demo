"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoRegion } from "./types";

type SingaporeMapProps = {
  regions: GeoRegion[];
};

/* Singapore center and bounds */
const SG_CENTER: [number, number] = [1.3521, 103.8198];
const SG_ZOOM = 12;

/* Size scale for circle markers based on bookings */
function markerRadius(bookings: number, max: number): number {
  const min = 8;
  const maxR = 28;
  return min + (bookings / max) * (maxR - min);
}

export default function SingaporeMap({ regions }: SingaporeMapProps) {
  const maxBookings = Math.max(...regions.map((r) => r.bookings), 1);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-200">
      <MapContainer
        center={SG_CENTER}
        zoom={SG_ZOOM}
        scrollWheelZoom={false}
        style={{ height: 420, width: "100%" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {regions.map((region) => {
          const r = markerRadius(region.bookings, maxBookings);
          return (
            <CircleMarker
              key={region.region}
              center={[region.lat, region.lng]}
              radius={r}
              pathOptions={{
                color: "#7B61FF",
                fillColor: "#7B61FF",
                fillOpacity: 0.35,
                weight: 2,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -r]}
                opacity={1}
                className="custom-leaflet-tooltip"
              >
                <div style={{ minWidth: 160, padding: "4px 2px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#111827",
                      marginBottom: 6,
                    }}
                  >
                    {region.region}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Bookings</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {region.bookings}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Revenue</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {region.revenue}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Customers</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {region.customers}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Avg Spend</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {region.avgSpend}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 4,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Trend</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          region.trendDirection === "up"
                            ? "#16a34a"
                            : region.trendDirection === "down"
                            ? "#ef4444"
                            : "#9ca3af",
                      }}
                    >
                      {region.trend}
                    </span>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Leaflet tooltip style override */}
      <style jsx global>{`
        .custom-leaflet-tooltip {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12) !important;
        }
        .custom-leaflet-tooltip::before {
          border-top-color: white !important;
        }
        .leaflet-container {
          font-family: inherit !important;
        }
      `}</style>
    </div>
  );
}
