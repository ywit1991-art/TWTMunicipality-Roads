'use client';

import {
  MapContainer,
  TileLayer,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

export type Road = {
  id: number;
  name: string;
  note: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance_m: number | null;
  received_date: string | null;
  created_at: string;
};

const COLORS = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

export const ROAD_COLORS = COLORS;

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

    if (route && route.length > 0) {
      map.fitBounds(route as L.LatLngBoundsExpression, {
        padding: [60, 60],
        maxZoom: 16,
        animate: true,
        duration: 1,
      });
    } else {
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
  onRoadClick,
}: {
  roads: Road[];
  focusRoad?: Road | null;
  onRoadClick?: (road: Road) => void;
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
      zoom={13}
      style={{ height: '700px', width: '100%', borderRadius: '12px' }}
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

        return (
          <div key={road.id}>
            {route && route.length > 0 && (
              <Polyline
                positions={route}
                pathOptions={{
                  color,
                  weight: isFocused ? 8 : 5,
                  opacity: isFocused ? 1 : 0.85,
                }}
                eventHandlers={{
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 8, opacity: 1 });
                  },
                  mouseout: (e) => {
                    e.target.setStyle({
                      weight: isFocused ? 8 : 5,
                      opacity: isFocused ? 1 : 0.85,
                    });
                  },
                  click: () => {
                    onRoadClick?.(road);
                  },
                }}
              >
                <Tooltip
                  sticky
                  direction="top"
                  offset={[0, -10]}
                  opacity={1}
                  className="road-tooltip"
                >
                  <div
                    style={{
                      fontFamily: "'Noto Sans Thai', sans-serif",
                      fontWeight: 600,
                      fontSize: '13px',
                      color: '#ffffff',
                      backgroundColor: color,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                    }}
                  >
                    🛣️ {road.name}
                    {road.distance_m != null && (
                      <span style={{ marginLeft: 6, opacity: 0.9 }}>
                        • {(road.distance_m / 1000).toFixed(3)} กม.
                      </span>
                    )}
                  </div>
                </Tooltip>
              </Polyline>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}