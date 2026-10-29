'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
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

type LatLng = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
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
  drawMode = false, // ⭐ รับค่าโหมดวาดเส้นเอง
  onPick,
  onDrag,
  onWaypointDrag,
  onWaypointDelete,
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
  roadName?: string;
  distanceKm?: number | null;
  fullHeight?: boolean;
}) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [locating, setLocating] = useState(false);
  const [isSatellite, setIsSatellite] = useState(true);

  // ⭐ คำนวณเส้นทาง
  useEffect(() => {
    if (mode === 'double' && start && end) {
      if (drawMode) {
        // ถ้าเป็นโหมดวาดเส้นเอง ให้ต่อเส้นตรงจากจุดเริ่ม -> จุดผ่าน -> จุดสิ้นสุด
        const straightLine: [number, number][] = [
          [start.lat, start.lng],
          ...waypoints.map(wp => [wp.lat, wp.lng] as [number, number]),
          [end.lat, end.lng]
        ];
        setRoute(straightLine);
      } else {
        // ถ้าเป็นโหมดปกติ ให้เรียก OSRM
        let coords = `${start.lng},${start.lat}`;
        waypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
        coords += `;${end.lng},${end.lat}`;
        
        fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0) {
              setRoute(data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
            } else {
              setRoute([]);
            }
          }).catch(() => setRoute([]));
      }
    } else {
      setRoute([]);
    }
  }, [start?.lat, start?.lng, end?.lat, end?.lng, JSON.stringify(waypoints), mode, drawMode]);

  function useCurrentLocation() {
    if (!navigator.geolocation) return alert('เบราว์เซอร์นี้ไม่รองรับ GPS');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mode === 'single' || !start) onPick(p);
        else onDrag?.('end', p);
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
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
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
        style={{ height: fullHeight ? '100%' : '450px', minHeight: '400px', width: '100%', borderRadius: '12px' }}
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
        <ClickHandler onPick={onPick} />

        {mode === 'double' && route.length > 0 && (
          <Polyline 
            positions={route} 
            // ⭐ ถ้าเป็นโหมดวาดเอง ให้ใช้เส้นประสีส้ม เพื่อให้รู้ว่าไม่ใช่ถนนจริง
            pathOptions={drawMode ? { color: '#f97316', weight: 4, opacity: 0.8, dashArray: '10, 10' } : { color: '#3b82f6', weight: 6, opacity: 0.9 }} 
          />
        )}

        {start && (
          <Marker 
            position={[start.lat, start.lng]} 
            icon={defaultIcon} 
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onDrag?.('start', { lat: p.lat, lng: p.lng }); } }}
          />
        )}

        {waypoints.map((wp, idx) => (
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

        {mode === 'double' && end && (
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