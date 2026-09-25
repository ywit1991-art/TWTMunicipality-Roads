'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
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

export type Road = {
  id: number;
  name: string;
  note: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance_m: number | null;
  created_at: string;
};

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

async function fetchRoute(road: Road): Promise<[number, number][]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${road.start_lng},${road.start_lat};${road.end_lng},${road.end_lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) return [];

  return data.routes[0].geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
}

// ====== Component สำหรับบังคับแผนที่ให้ zoom ไปที่ถนน ======
function MapController({
  focusRoad,
  routes,
}: {
  focusRoad: Road | null;
  routes: Record<number, [number, number][]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusRoad) return;

    const route = routes[focusRoad.id];

    // ถ้ามีเส้นทางแล้ว → fitBounds ตามเส้นทาง (zoom พอดี)
    if (route && route.length > 0) {
      map.fitBounds(route as L.LatLngBoundsExpression, {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
        duration: 1,
      });
    } else {
      // ถ้ายังไม่มีเส้นทาง → zoom ไปที่จุดกลางระหว่าง start กับ end
      const midLat = (focusRoad.start_lat + focusRoad.end_lat) / 2;
      const midLng = (focusRoad.start_lng + focusRoad.end_lng) / 2;
      map.flyTo([midLat, midLng], 15, { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRoad?.id]);

  return null;
}

export default function RoadsMap({
  roads,
  focusRoad,
}: {
  roads: Road[];
  focusRoad?: Road | null;
}) {
  const [routes, setRoutes] = useState<Record<number, [number, number][]>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      for (const road of roads) {
        const r = await fetchRoute(road);
        if (!mounted) return;
        setRoutes((prev) => ({ ...prev, [road.id]: r }));
        await new Promise((res) => setTimeout(res, 1100));
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roads.length]);

  return (
    <MapContainer
      center={[19.1907, 99.9315]}
      zoom={12}
      style={{ height: '600px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController focusRoad={focusRoad ?? null} routes={routes} />

      {roads.map((road, i) => {
        const color = COLORS[i % COLORS.length];
        const route = routes[road.id];
        const isFocused = focusRoad?.id === road.id;
        const midPoint = route && route.length > 0 ? route[Math.floor(route.length / 2)] : null;

        return (
          <div key={road.id}>
            {route && route.length > 0 && (
              <>
                <Polyline
                  positions={route}
                  pathOptions={{
                    color,
                    weight: isFocused ? 8 : 5,
                    opacity: isFocused ? 1 : 0.7,
                  }}
                />
                {midPoint && (
                  <Marker
                    position={midPoint}
                    icon={L.divIcon({
                      className: 'road-label',
                      html: `<div style="
                        background-color: ${color} !important;
                        color: #ffffff !important;
                        padding: 4px 10px;
                        border-radius: 999px;
                        font-size: 12px;
                        font-weight: 700;
                        font-family: 'Noto Sans Thai', sans-serif;
                        white-space: nowrap;
                        transform: translate(-50%, -50%);
                        display: inline-block;
                        border: 2px solid #ffffff;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        ${isFocused ? 'transform: translate(-50%, -50%) scale(1.15);' : ''}
                      ">${road.name}</div>`,
                      iconSize: [0, 0],
                      iconAnchor: [0, 0],
                    })}
                  />
                )}
              </>
            )}

            <Marker position={[road.start_lat, road.start_lng]} icon={icon}>
              <Popup>
                <div style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
                  <strong>🟢 จุดเริ่มต้น</strong>
                  <br />
                  {road.name}
                </div>
              </Popup>
            </Marker>

            <Marker position={[road.end_lat, road.end_lng]} icon={icon}>
              <Popup>
                <div style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
                  <strong>🔴 จุดสิ้นสุด</strong>
                  <br />
                  {road.name}
                  {road.distance_m && (
                    <>
                      <br />
                      ระยะทาง: {(road.distance_m / 1000).toFixed(3)} กม.
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}