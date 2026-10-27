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

type LatLng = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ⭐ คอมโพเนนต์สำหรับบังคับให้แผนที่วิ่งไปหาพิกัดที่เปลี่ยน
function MapController({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], 17, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

async function fetchRoute(start: LatLng, end: LatLng): Promise<[number, number][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return [];
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
  } catch {
    return [];
  }
}

export default function MapPicker({
  mode = 'double',
  start,
  end,
  onPick,
  onDrag,
  fullHeight,
}: {
  mode?: 'single' | 'double';
  start: LatLng | null;
  end: LatLng | null;
  onPick: (p: LatLng) => void;
  onDrag?: (which: 'start' | 'end', p: LatLng) => void;
  roadName?: string;
  distanceKm?: number | null;
  fullHeight?: boolean;
}) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (mode === 'double' && start && end) {
      fetchRoute(start, end).then(setRoute).catch(() => setRoute([]));
    } else {
      setRoute([]);
    }
  }, [start?.lat, start?.lng, end?.lat, end?.lng, mode]);

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

  // ⭐ หาจุดล่าสุดที่ถูกปัก เพื่อให้แผนที่วิ่งไปหา
  const latestPoint = end || start;

  return (
    <div className="relative w-full h-full">
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-600 shadow-md hover:bg-blue-50 disabled:opacity-50"
      >
        {locating ? '⏳ กำลังหา...' : '📍 ใช้ GPS ปัจจุบัน'}
      </button>

      <MapContainer
        center={[19.1907, 99.9315]}
        zoom={16}
        minZoom={13}
        maxZoom={20}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        style={{ height: fullHeight ? '100%' : '450px', minHeight: '400px', width: '100%', borderRadius: '12px' }}
      >
        <TileLayer 
          attribution='Tiles &copy; Esri' 
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
          maxNativeZoom={18}
          maxZoom={20}
        />
        
        {/* ⭐ เรียกใช้ MapController เพื่อบังคับให้แผนที่วิ่งตามจุดที่ปัก */}
        <MapController center={latestPoint} />
        
        <ClickHandler onPick={onPick} />

        {mode === 'double' && route.length > 0 && (
          <Polyline positions={route} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.85 }} />
        )}

        {start && (
          <Marker 
            position={[start.lat, start.lng]} 
            icon={defaultIcon} 
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onDrag?.('start', { lat: p.lat, lng: p.lng }); } }}
          >
            <Popup>
              <div style={{ textAlign: 'center', fontFamily: 'Noto Sans Thai, sans-serif' }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', fontSize: '14px' }}>
                  {mode === 'single' ? '📍 ตำแหน่งที่ตั้ง' : '🟢 จุดเริ่มต้น'}
                </div>
                <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${start.lat},${start.lng}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 ดู Street View</a>
              </div>
            </Popup>
          </Marker>
        )}

        {mode === 'double' && end && (
          <Marker 
            position={[end.lat, end.lng]} 
            icon={defaultIcon} 
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onDrag?.('end', { lat: p.lat, lng: p.lng }); } }}
          >
            <Popup>
              <div style={{ textAlign: 'center', fontFamily: 'Noto Sans Thai, sans-serif' }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px', fontSize: '14px' }}>
                  🔴 จุดสิ้นสุด
                </div>
                <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${end.lat},${end.lng}`} target="_blank" rel="noopener noreferrer" style={btnStyle}>🌍 ดู Street View</a>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}