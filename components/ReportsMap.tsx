'use client';

import { MapContainer, TileLayer, Polyline, Tooltip, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

export type VillagePlan = {
  id: number;
  village: string;
  plan_name: string;
  plan_type: string;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  location_lat: number | null;
  location_lng: number | null;
  distance_m: number | null;
  width: number | null;
  details: string | null;
  readiness: string;
  problem: string | null;
  created_at: string;
};

const TYPE_COLORS: Record<string, string> = {
  'ถนน คสล.': '#ef4444',
  'รางระบายน้ำ คสล.': '#3b82f6',
  'วางท่อ คสล.': '#06b6d4',
  'ถนนการเกษตร': '#10b981',
  'ซ่อมแซมถนน': '#f59e0b',
  'ขุดลอก': '#8b5cf6',
  'ปรับปรุง/ก่อสร้าง': '#ec4899',
};
const DEFAULT_COLOR = '#64748b';

async function fetchRoute(startLat: number, startLng: number, endLat: number, endLng: number) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return [];
    return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
  } catch {
    return [];
  }
}

function MapBoundsController({ plans }: { plans: VillagePlan[] }) {
  const map = useMap();

  useEffect(() => {
    if (!plans || plans.length === 0) return;
    const bounds = L.latLngBounds([]);
    let hasValidPoint = false;

    plans.forEach((plan) => {
      if (plan.start_lat && plan.start_lng) { bounds.extend([plan.start_lat, plan.start_lng]); hasValidPoint = true; }
      if (plan.end_lat && plan.end_lng) { bounds.extend([plan.end_lat, plan.end_lng]); hasValidPoint = true; }
      if (plan.location_lat && plan.location_lng) { bounds.extend([plan.location_lat, plan.location_lng]); hasValidPoint = true; }
    });

    if (hasValidPoint) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true, duration: 1 });
    }
  }, [plans, map]);

  return null;
}

export default function ReportsMap({ plans }: { plans: VillagePlan[] }) {
  const [routes, setRoutes] = useState<Record<number, [number, number][]>>({});
  // ⭐ State สำหรับสลับแผนที่
  const [isSatellite, setIsSatellite] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      for (const plan of plans) {
        if (plan.start_lat && plan.start_lng && plan.end_lat && plan.end_lng) {
          if (!routes[plan.id]) {
            const r = await fetchRoute(plan.start_lat, plan.start_lng, plan.end_lat, plan.end_lng);
            if (!mounted) return;
            setRoutes((prev) => ({ ...prev, [plan.id]: r }));
            await new Promise((res) => setTimeout(res, 1100));
          }
        }
      }
    })();
    return () => { mounted = false; };
  }, [plans.length]);

  const bounds: [[number, number], [number, number]] = [
    [19.100, 99.850], 
    [19.280, 100.020] 
  ];

  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center',
    backgroundColor: '#1e293b', color: '#ffffff',
    padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold',
    textDecoration: 'none', marginTop: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      {/* ⭐ ปุ่มสลับแผนที่ */}
      <div className="absolute top-3 right-3 z-[1000]">
        <button
          type="button"
          onClick={() => setIsSatellite(!isSatellite)}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-md hover:bg-slate-50 transition border border-slate-200"
        >
          {isSatellite ? '🗺️ สลับเป็นแผนที่ถนน' : '🛰️ สลับเป็นดาวเทียม'}
        </button>
      </div>

      <MapContainer 
        center={[19.1907, 99.9315]} 
        zoom={15}
        minZoom={13}
        maxZoom={20}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        {/* ⭐ สลับ TileLayer ตาม State */}
        {isSatellite ? (
          <TileLayer 
            attribution='Tiles &copy; Esri' 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
            maxNativeZoom={18}
            maxZoom={20}
          />
        ) : (
          <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            maxZoom={19}
          />
        )}

        <MapBoundsController plans={plans} />

        {plans.map((plan) => {
          const color = TYPE_COLORS[plan.plan_type] || DEFAULT_COLOR;
          const route = routes[plan.id];
          const isRoad = plan.start_lat && plan.end_lat;

          if (!isRoad || !route || route.length < 2) return null;

          const startPoint = route[0];
          const endPoint = route[route.length - 1];

          return (
            <div key={plan.id}>
              <Polyline positions={route} pathOptions={{ color, weight: 6, opacity: 0.9, lineCap: 'round' }}>
                <Tooltip sticky>
                  <div className="text-center font-sans">
                    <div className="font-bold text-sm text-slate-800">{plan.plan_name}</div>
                    <div className="text-xs text-slate-500 font-medium">{plan.plan_type}</div>
                  </div>
                </Tooltip>
              </Polyline>

              <CircleMarker center={startPoint} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: color, fillOpacity: 1 }}>
                <Popup>
                  <div className="text-center font-sans p-1 min-w-[140px]">
                    <div className="font-bold text-slate-800 mb-1 text-sm">{plan.plan_name}</div>
                    <div className="text-xs text-slate-500 font-medium mb-2">{plan.plan_type}</div>
                    <div className="font-bold text-emerald-600 text-xs mb-1">🟢 จุดเริ่มต้น</div>
                    <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${startPoint[0]},${startPoint[1]}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
                  </div>
                </Popup>
              </CircleMarker>

              <CircleMarker center={endPoint} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: color, fillOpacity: 1 }}>
                <Popup>
                  <div className="text-center font-sans p-1 min-w-[140px]">
                    <div className="font-bold text-slate-800 mb-1 text-sm">{plan.plan_name}</div>
                    <div className="text-xs text-slate-500 font-medium mb-2">{plan.plan_type}</div>
                    <div className="font-bold text-red-600 text-xs mb-1">🔴 จุดสิ้นสุด</div>
                    <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${endPoint[0]},${endPoint[1]}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}