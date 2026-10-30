'use client';

import { MapContainer, TileLayer, Polyline, Tooltip, CircleMarker, Popup, useMap, Marker } from 'react-leaflet';
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
  waypoints?: { lat: number; lng: number }[] | null; 
  route_path?: [number, number][] | null;            
  remarks?: string | null; 
};

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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

function ResizeHandler({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [isFullscreen, map]);
  return null;
}

export default function ReportsMap({ plans }: { plans: VillagePlan[] }) {
  const [routes, setRoutes] = useState<Record<number, [number, number][]>>({});
  const [isSatellite, setIsSatellite] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const plansDataString = JSON.stringify(plans.map(p => ({ id: p.id, path: p.route_path })));

  useEffect(() => {
    let mounted = true;
    (async () => {
      for (const plan of plans) {
        if (plan.start_lat && plan.start_lng && plan.end_lat && plan.end_lng) {
          if (plan.route_path && plan.route_path.length > 0) {
            setRoutes((prev) => {
              if (JSON.stringify(prev[plan.id]) !== JSON.stringify(plan.route_path)) {
                return { ...prev, [plan.id]: plan.route_path! };
              }
              return prev;
            });
          } 
          else if (!routes[plan.id]) {
            const r = await fetchRoute(plan.start_lat, plan.start_lng, plan.end_lat, plan.end_lng);
            if (!mounted) return;
            setRoutes((prev) => ({ ...prev, [plan.id]: r }));
            await new Promise((res) => setTimeout(res, 1100));
          }
        }
      }
    })();
    return () => { mounted = false; };
  }, [plansDataString]);

  const bounds: [[number, number], [number, number]] = [
    [19.100, 99.850], 
    [19.280, 100.020] 
  ];

  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center',
    backgroundColor: '#1e293b', color: '#ffffff',
    padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
    textDecoration: 'none', marginTop: '6px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div className={isFullscreen 
      ? "fixed inset-0 z-[9999] bg-white" 
      : "relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200"
    }>
      
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md hover:bg-slate-50 transition border border-slate-200"
        >
          {isFullscreen ? '✖️ ปิดเต็มจอ' : '⛶ เต็มหน้าจอ'}
        </button>
        <button
          type="button"
          onClick={() => setIsSatellite(!isSatellite)}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md hover:bg-slate-50 transition border border-slate-200"
        >
          {isSatellite ? '🗺️ แผนที่ถนน' : '🛰️ ดาวเทียม'}
        </button>
      </div>

      <MapContainer 
        center={[19.1907, 99.9315]} 
        zoom={15}
        minZoom={13}
        maxZoom={20}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        <ResizeHandler isFullscreen={isFullscreen} />

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
          
          if (plan.start_lat && plan.start_lng && plan.end_lat && plan.end_lng) {
            const route = routes[plan.id];
            if (!route || route.length < 2) return null;

            const startPoint = route[0];
            const endPoint = route[route.length - 1];

            return (
              <div key={plan.id}>
                <Polyline 
                  positions={route} 
                  pathOptions={{ color, weight: 4, opacity: 0.7, lineCap: 'round' }} 
                  eventHandlers={{
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({ weight: 7, opacity: 1 }); 
                      layer.bringToFront(); 
                    },
                    mouseout: (e) => {
                      const layer = e.target;
                      layer.setStyle({ weight: 4, opacity: 0.7 }); 
                    },
                  }}
                >
                  {/* ⭐ กลับมาใช้ Tooltip แบบเดิมที่ข้อความไม่แตกบรรทัด */}
                  <Tooltip sticky>
                    <div className="text-center p-1">
                      <div className="font-bold text-sm text-slate-800 mb-0.5">{plan.plan_name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{plan.plan_type}</div>
                      <div className="text-xs font-bold text-blue-600 mt-1.5 bg-blue-100 px-2 py-1 rounded-md inline-block">
                        📏 ระยะทาง: {plan.distance_m ? (plan.distance_m / 1000).toFixed(3) : '0.000'} กม.
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>

                <CircleMarker center={startPoint} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 1 }}>
                  <Popup>
                    <div className="text-center p-1 min-w-[150px]">
                      <div className="font-bold text-slate-800 mb-1 text-sm">{plan.plan_name}</div>
                      <div className="text-xs text-slate-500 font-medium mb-2">{plan.plan_type}</div>
                      <div className="text-xs font-bold text-blue-600 mb-2 bg-blue-100 py-1 rounded">
                        ระยะทาง: {plan.distance_m ? (plan.distance_m / 1000).toFixed(3) : '0.000'} กม.
                      </div>
                      {plan.remarks && <div className="text-xs text-slate-600 mb-2 bg-slate-100 py-1 rounded">📝 {plan.remarks}</div>}
                      <div className="font-bold text-emerald-600 text-xs mb-1">🟢 จุดเริ่มต้น</div>
                      <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${startPoint[0]},${startPoint[1]}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
                    </div>
                  </Popup>
                </CircleMarker>

                <CircleMarker center={endPoint} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 1 }}>
                  <Popup>
                    <div className="text-center p-1 min-w-[150px]">
                      <div className="font-bold text-slate-800 mb-1 text-sm">{plan.plan_name}</div>
                      <div className="text-xs text-slate-500 font-medium mb-2">{plan.plan_type}</div>
                      <div className="text-xs font-bold text-blue-600 mb-2 bg-blue-100 py-1 rounded">
                        ระยะทาง: {plan.distance_m ? (plan.distance_m / 1000).toFixed(3) : '0.000'} กม.
                      </div>
                      {plan.remarks && <div className="text-xs text-slate-600 mb-2 bg-slate-100 py-1 rounded">📝 {plan.remarks}</div>}
                      <div className="font-bold text-red-600 text-xs mb-1">🔴 จุดสิ้นสุด</div>
                      <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${endPoint[0]},${endPoint[1]}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
                    </div>
                  </Popup>
                </CircleMarker>
              </div>
            );
          }

          if (plan.location_lat && plan.location_lng) {
            return (
              <div key={plan.id}>
                <Marker position={[plan.location_lat, plan.location_lng]} icon={defaultIcon}>
                  <Tooltip direction="top" offset={[0, -40]}>
                    <div className="text-center">
                      <div className="font-bold text-sm text-slate-800">{plan.plan_name}</div>
                      <div className="text-xs text-slate-500 font-medium">{plan.plan_type}</div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="text-center p-1 min-w-[150px]">
                      <div className="font-bold text-slate-800 mb-1 text-sm">{plan.plan_name}</div>
                      <div className="text-xs text-slate-500 font-medium mb-2">{plan.plan_type}</div>
                      {plan.remarks && <div className="text-xs text-slate-600 mb-2 bg-slate-100 py-1 rounded">📝 {plan.remarks}</div>}
                      <div className="font-bold text-blue-600 text-xs mb-2">📍 ตำแหน่งที่ตั้ง</div>
                      <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${plan.location_lat},${plan.location_lng}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
                    </div>
                  </Popup>
                </Marker>
              </div>
            );
          }

          return null;
        })}
      </MapContainer>
    </div>
  );
}