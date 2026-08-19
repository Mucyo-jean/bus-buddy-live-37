import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Stop } from "@/lib/tracking";
import type { Coords } from "@/lib/geo";

export type LiveMapProps = {
  stops: Stop[];
  bus: Coords | null;
  nextStopId?: string | null;
  destinationStopId?: string | null;
  height?: string;
};

const busIcon = L.divIcon({
  className: "",
  html: `<div class="bus-marker-pulse" style="width:22px;height:22px;border-radius:9999px;background:oklch(0.78 0.16 82);border:3px solid oklch(0.19 0.03 247);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function Recenter({ bus, stops }: { bus: Coords | null; stops: Stop[] }) {
  const map = useMap();
  useEffect(() => {
    if (bus) {
      map.setView([bus.latitude, bus.longitude], map.getZoom() < 13 ? 14 : map.getZoom(), {
        animate: true,
      });
    } else if (stops.length > 0) {
      map.fitBounds(L.latLngBounds(stops.map((s) => [s.latitude, s.longitude] as [number, number])), {
        padding: [40, 40],
      });
    }
  }, [bus?.latitude, bus?.longitude, stops.length]);
  return null;
}

export default function LiveMapInner({
  stops,
  bus,
  nextStopId,
  destinationStopId,
  height = "420px",
}: LiveMapProps) {
  const ordered = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const path = ordered.map((s) => [s.latitude, s.longitude] as [number, number]);
  const center: [number, number] = bus
    ? [bus.latitude, bus.longitude]
    : path[0] ?? [-1.95, 30.06];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path.length > 1 && <Polyline positions={path} pathOptions={{ color: "#34d0c6", weight: 5, opacity: 0.75 }} />}
      {ordered.map((s) => {
        const isNext = s.id === nextStopId;
        const isDest = s.id === destinationStopId;
        return (
          <CircleMarker
            key={s.id}
            center={[s.latitude, s.longitude]}
            radius={isDest ? 11 : isNext ? 9 : 6}
            pathOptions={{
              color: isDest ? "#f0a500" : isNext ? "#5ee2a0" : "#9fb4c7",
              fillColor: isDest ? "#f0a500" : isNext ? "#5ee2a0" : "#4a6076",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{s.stop_order}. {s.name}</strong>
              {isDest && <div>Your destination</div>}
              {isNext && <div>Next stop</div>}
            </Popup>
          </CircleMarker>
        );
      })}
      {bus && (
        <Marker position={[bus.latitude, bus.longitude]} icon={busIcon}>
          <Popup>Live bus position</Popup>
        </Marker>
      )}
      <Recenter bus={bus} stops={ordered} />
    </MapContainer>
  );
}