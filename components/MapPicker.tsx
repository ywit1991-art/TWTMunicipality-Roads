'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type LatLng = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

async function fetchRoute(start: LatLng, end: LatLng): Promise<[number, number][]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return [];

  return data.routes[0].geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
}

export default function MapPicker({
  start,
  end,
  onPick,
  onDrag,
  roadName,
  distanceKm,
}: {
  start: LatLng | null;
  end: LatLng | null;
  onPick: (p: LatLng) => void;
  onDrag?: (which: 'start' | 'end', p: LatLng) => void;
  roadName?: string;
  distanceKm?: number | null;
}) {
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    if (start && end) {
      fetchRoute(start, end).then(setRoute).catch(() => setRoute([]));
    } else {
      setRoute([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.lat, start?.lng, end?.lat, end?.lng]);

  // จุดกลางเส้นทาง (ไว้แสดง label)
  const midPoint: [number, number] | null =
    route.length > 0 ? route[Math.floor(route.length / 2)] : null;

  return (
    <MapContainer
      center={[13.7563, 100.5018]}
      zoom={12}
      style={{ height: '450px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />

      {/* เส้นทาง */}
      {route.length > 0 && (
        <Polyline
          positions={route}
          pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.85 }}
        />
      )}

      {/* Label กลางเส้น: ชื่อถนน + ระยะทาง (สีเหลืองดำ เด่นชัด) */}
      {midPoint && roadName && distanceKm != null && (
        <Marker
          position={midPoint}
          icon={L.divIcon({
            className: 'route-label',
            html: `<div style="
              background-color: #facc15 !important;
              color: #1e293b !important;
              padding: 6px 14px;
              border-radius: 999px;
              font-size: 13px;
              font-weight: 700;
              font-family: 'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              transform: translate(-50%, -50%);
              display: inline-block;
              border: 2px solid #1e293b;
              letter-spacing: 0.02em;
            ">🛣️ ${roadName} • ${distanceKm.toFixed(3)} กม.</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          })}
        />
      )}

      {/* Marker Start */}
      {start && (
        <Marker
          position={[start.lat, start.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const p = m.getLatLng();
              onDrag?.('start', { lat: p.lat, lng: p.lng });
            },
          }}
        >
          <Popup>🟢 จุดเริ่มต้น (ลากได้)</Popup>
          <Tooltip permanent direction="top" offset={[0, -40]}>
            เริ่มต้น
          </Tooltip>
        </Marker>
      )}

      {/* Marker End */}
      {end && (
        <Marker
          position={[end.lat, end.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const p = m.getLatLng();
              onDrag?.('end', { lat: p.lat, lng: p.lng });
            },
          }}
        >
          <Popup>🔴 จุดสิ้นสุด (ลากได้)</Popup>
          <Tooltip permanent direction="top" offset={[0, -40]}>
            สิ้นสุด
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}