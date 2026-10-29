'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const waypointIcon = L.divIcon({
  className: 'custom-waypoint',
  html: `<div style="background-color: #eab308; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">●</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// ⭐ ไอคอนสำหรับจุดวัดระยะ
const measureIcon = L.divIcon({
  className: 'custom-measure',
  html: `<div style="background-color: #a855f7; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type LatLng = { lat: number; lng: number };

function ClickHandler({ 
  onPick, 
  isMeasuring, 
  onMeasureAdd 
}: { 
  onPick: (p: LatLng) => void;
  isMeasuring: boolean;
  onMeasureAdd: (p: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (isMeasuring) {
        onMeasureAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

function MapController({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], 17, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export default function MapPicker({
  mode = 'double',
  start,
  end,
  waypoints = [],
  drawMode = false, 
  onPick,
  onDrag,
  onWaypointDrag,
  onWaypointDelete,
  onRouteUpdate,
  fullHeight,
}: {
  mode?: 'single' | 'double';
  start: LatLng | null;
  end: LatLng | null;
  waypoints?: LatLng[];
  drawMode?: boolean;
  onPick: (p: LatLng) => void;
  onDrag?: (which: 'start' | 'end', p: LatLng) => void;
  onWaypointDrag?: (index: number, p: LatLng) => void;
  onWaypointDelete?: (index: number) => void;
  onRouteUpdate?: (route: [number, number][]) => void;
  roadName?: string;
  distanceKm?: number | null;
  fullHeight?: boolean;
}) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [locating, setLocating] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);
  
  // ⭐ State สำหรับการวัดระยะทาง
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureDistance, setMeasureDistance] = useState<number>(0);

  useEffect(() => {
    let currentRoute: [number, number][] = [];

    if (mode === 'double' && start && end) {
      if (drawMode) {
        currentRoute = [
          [start.lat, start.lng],
          ...waypoints.map(wp => [wp.lat, wp.lng] as [number, number]),
          [end.lat, end.lng]
        ];
        setRoute(currentRoute);
      } else {
        let coords = `${start.lng},${start.lat}`;
        waypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
        coords += `;${end.lng},${end.lat}`;
        
        fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0) {
              currentRoute = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
              setRoute(currentRoute);
            } else {
              setRoute([]);
            }
          }).catch(() => setRoute([]));
      }
    } else {
      setRoute([]);
    }

    if (onRouteUpdate) onRouteUpdate(currentRoute);

  }, [start?.lat, start?.lng, end?.lat, end?.lng, JSON.stringify(waypoints), mode, drawMode]);

  // ⭐ ฟังก์ชันเพิ่มจุดวัดระยะ
  function handleMeasureAdd(p: LatLng) {
    const newPoints: [number, number][] = [...measurePoints, [p.lat, p.lng]];
    setMeasurePoints(newPoints);
    
    if (newPoints.length > 1) {
      const last = L.latLng(newPoints[newPoints.length - 1]);
      const prev = L.latLng(newPoints[newPoints.length - 2]);
      const dist = prev.distanceTo(last); // ระยะทางเป็นเมตร
      setMeasureDistance(prevDist => prevDist + dist);
    }
  }

  function clearMeasure() {
    setMeasurePoints([]);
    setMeasureDistance(0);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return alert('เบราว์เซอร์นี้ไม่รองรับ GPS');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isMeasuring) {
          handleMeasureAdd(p);
        } else if (mode === 'single' || !start) {
          onPick(p);
        } else {
          onDrag?.('end', p);
        }
        setLocating(false);
      },
      (err) => {
        alert('ไม่สามารถระบุตำแหน่งได้: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  }

  const bounds: [[number, number], [number, number]] = [
    [19.100, 99.850], 
    [19.280, 100.020] 
  ];

  const btnStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 'bold',
    textDecoration: 'none',
    marginTop: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  };

  const latestPoint = end || (waypoints.length > 0 ? waypoints[waypoints.length - 1] : null) || start;

  return (
    <div className="relative w-full h-full">
      {/* ⭐ ปุ่มควบคุมมุมขวาบน */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
        
        {/* ปุ่มวัดระยะทาง */}
        {isMeasuring ? (
          <div className="flex flex-col gap-2 items-end animate-in slide-in-from-right-4 duration-300">
            <div className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow-lg font-bold text-sm flex items-center gap-2">
              📏 วัดได้: {(measureDistance / 1000).toFixed(3)} กม.
            </div>
            <button
              type="button"
              onClick={clearMeasure}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-bold text-red-600 shadow-md hover:bg-red-50 transition border border-slate-200"
            >
              🗑️ ล้างระยะ
            </button>
            <button
              type="button"
              onClick={() => { setIsMeasuring(false); clearMeasure(); }}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md hover:bg-slate-50 transition border border-slate-200"
            >
              ✕ ปิดโหมดวัด
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsMeasuring(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-purple-600 shadow-md hover:bg-purple-50 transition border border-slate-200"
          >
            📏 วัดระยะทาง
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsSatellite(!isSatellite)}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-md hover:bg-slate-50 transition border border-slate-200"
        >
          {isSatellite ? '🗺️ แผนที่ถนน' : '🛰️ ดาวเทียม'}
        </button>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-bold text-blue-600 shadow-md hover:bg-blue-50 disabled:opacity-50 transition border border-slate-200"
        >
          {locating ? '⏳ กำลังหา...' : '📍 GPS'}
        </button>
      </div>

      <MapContainer
        center={[19.1907, 99.9315]}
        zoom={16}
        minZoom={13}
        maxZoom={20}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        style={{ height: fullHeight ? '100%' : '450px', minHeight: '400px', width: '100%', borderRadius: '12px', cursor: isMeasuring ? 'crosshair' : 'grab' }}
      >
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
        
        <MapController center={latestPoint} />
        
        {/* ⭐ ส่งค่า isMeasuring ไปให้ ClickHandler */}
        <ClickHandler 
          onPick={onPick} 
          isMeasuring={isMeasuring} 
          onMeasureAdd={handleMeasureAdd} 
        />

        {/* แสดงเส้นทางหลัก */}
        {!isMeasuring && mode === 'double' && route.length > 0 && (
          <Polyline 
            positions={route} 
            pathOptions={drawMode ? { color: '#f97316', weight: 5, opacity: 0.9, dashArray: '10, 10' } : { color: '#3b82f6', weight: 6, opacity: 0.9 }} 
          />
        )}

        {/* ⭐ แสดงเส้นและจุดวัดระยะ */}
        {isMeasuring && measurePoints.length > 0 && (
          <>
            <Polyline 
              positions={measurePoints} 
              pathOptions={{ color: '#a855f7', weight: 4, dashArray: '5, 10' }} 
            />
            {measurePoints.map((pt, i) => (
              <Marker key={`measure-${i}`} position={pt} icon={measureIcon} />
            ))}
            {/* ป้ายบอกระยะทางลอยอยู่ที่จุดล่าสุด */}
            <Marker position={measurePoints[measurePoints.length - 1]} icon={L.divIcon({ className: 'transparent', html: '' })}>
              <Tooltip permanent direction="top" offset={[0, -10]} opacity={1}>
                <div className="bg-purple-600 text-white font-bold text-xs px-2 py-1 rounded shadow-md">
                  {(measureDistance / 1000).toFixed(3)} กม.
                </div>
              </Tooltip>
            </Marker>
          </>
        )}

        {!isMeasuring && start && (
          <Marker 
            position={[start.lat, start.lng]} 
            icon={defaultIcon} 
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onDrag?.('start', { lat: p.lat, lng: p.lng }); } }}
          />
        )}

        {!isMeasuring && waypoints.map((wp, idx) => (
          <Marker 
            key={`wp-${idx}`}
            position={[wp.lat, wp.lng]} 
            icon={waypointIcon} 
            draggable
            eventHandlers={{ 
              dragend: (e) => { 
                const p = (e.target as L.Marker).getLatLng(); 
                onWaypointDrag?.(idx, { lat: p.lat, lng: p.lng }); 
              } 
            }}
          >
            <Popup>
              <div className="text-center font-sans p-1">
                <div className="font-bold text-slate-800 mb-2 text-sm">จุดผ่านที่ {idx + 1}</div>
                <button 
                  onClick={() => onWaypointDelete?.(idx)}
                  className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition shadow-sm"
                >
                  🗑️ ลบจุดนี้
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {!isMeasuring && mode === 'double' && end && (
          <Marker 
            position={[end.lat, end.lng]} 
            icon={defaultIcon} 
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onDrag?.('end', { lat: p.lat, lng: p.lng }); } }}
          >
            <Popup>
              <div style={{ textAlign: 'center', fontFamily: 'Noto Sans Thai, sans-serif' }}>
                <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${end.lat},${end.lng}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 Street View</a>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}