'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LatLng } from '@/lib/osrm';

const MapPicker = nextDynamic(() => import('@/components/MapPicker'), { 
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-400">กำลังโหลดแผนที่...</div>
});

const VILLAGES = ['หมู่ 6', 'หมู่ 7', 'หมู่ 10', 'หมู่ 11'];
const ROAD_WORK_TYPES = ['ถนน คสล.', 'รางระบายน้ำ คสล.', 'วางท่อ คสล.', 'ถนนการเกษตร', 'ซ่อมแซมถนน', 'ขุดลอก'];
const OTHER_WORK_TYPES = ['ปรับปรุง/ก่อสร้าง'];
const ALL_TYPES = [...ROAD_WORK_TYPES, ...OTHER_WORK_TYPES];

function getStraightLineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function SurveyPage() {
  const [village, setVillage] = useState('');
  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState('');
  
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]); 
  const [picking, setPicking] = useState<'start' | 'end' | 'waypoint'>('start');
  const [drawMode, setDrawMode] = useState(false);

  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');

  const [location, setLocation] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [width, setWidth] = useState('');
  const [details, setDetails] = useState('');
  
  // ⭐ เพิ่ม State สำหรับหมายเหตุ
  const [remarks, setRemarks] = useState('');

  const [readiness, setReadiness] = useState<'ไม่มีอุปสรรค' | 'มีอุปสรรค'>('ไม่มีอุปสรรค');
  const [problem, setProblem] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);
  const [successModalData, setSuccessModalData] = useState<{ village: string; planName: string } | null>(null);

  const isRoadWork = ROAD_WORK_TYPES.includes(planType);
  const isOtherWork = OTHER_WORK_TYPES.includes(planType);

  useEffect(() => {
    if (isRoadWork && start && end) {
      if (drawMode) {
        let points = [start, ...waypoints, end];
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
          total += getStraightLineDistance(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }
        setDistance(total);
      } else {
        let coords = `${start.lng},${start.lat}`;
        waypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
        coords += `;${end.lng},${end.lat}`;
        
        fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0) {
              setDistance(data.routes[0].distance);
            } else {
              setDistance(null);
            }
          }).catch(() => setDistance(null));
      }
    } else {
      setDistance(null);
    }
  }, [start, end, waypoints, isRoadWork, drawMode]);

  function handleMapPick(p: LatLng) {
    if (isRoadWork) {
      if (picking === 'start') {
        setStart(p);
        setStartLat(p.lat.toString());
        setStartLng(p.lng.toString());
        setPicking('end');
      } else if (picking === 'waypoint') {
        setWaypoints([...waypoints, p]);
        if (!drawMode) setDrawMode(true); 
      } else {
        setEnd(p);
        setEndLat(p.lat.toString());
        setEndLng(p.lng.toString());
      }
    } else {
      setLocation(p);
    }
  }

  function handleMapDrag(which: 'start' | 'end', p: LatLng) {
    if (which === 'start') {
      setStart(p);
      setStartLat(p.lat.toString());
      setStartLng(p.lng.toString());
    } else {
      setEnd(p);
      setEndLat(p.lat.toString());
      setEndLng(p.lng.toString());
    }
  }

  function applyCoords(type: 'start' | 'end', latStr: string, lngStr: string) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (type === 'start') setStart({ lat, lng });
      else setEnd({ lat, lng });
    }
  }

  function handleWaypointDrag(index: number, p: LatLng) {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = p;
    setWaypoints(newWaypoints);
  }

  function handleWaypointDelete(index: number) {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
  }

  function handleClearAllPoints() {
    if (confirm('คุณต้องการล้างจุดทั้งหมดและเริ่มวาดใหม่ใช่หรือไม่?')) {
      setStart(null); setStartLat(''); setStartLng('');
      setEnd(null); setEndLat(''); setEndLng('');
      setWaypoints([]);
      setLocation(null);
      setDistance(null);
      setRoutePath([]);
      setPicking('start');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!village || !planName || !planType) {
      return setAlertInfo({ title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณากรอก "หมู่บ้าน", "ชื่อแผน" และ "ประเภทงาน" ให้ครบก่อนครับ', type: 'error' });
    }
    if (isRoadWork && (!start || !end)) {
      return setAlertInfo({ title: 'พิกัดไม่ครบถ้วน', message: 'กรุณาระบุ "จุดเริ่มต้น" และ "จุดสิ้นสุด" บนแผนที่ให้ครบก่อนครับ', type: 'error' });
    }
    if (isOtherWork && !location) {
      return setAlertInfo({ title: 'พิกัดไม่ครบถ้วน', message: 'กรุณาระบุ "ตำแหน่งที่ตั้ง" บนแผนที่ก่อนครับ', type: 'error' });
    }
    if (readiness === 'มีอุปสรรค' && !problem.trim()) {
      return setAlertInfo({ title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณาระบุ "รายละเอียดอุปสรรค" ด้วยครับ', type: 'error' });
    }

    setLoading(true);

    try {
      const payload = {
        village, plan_name: planName, plan_type: planType,
        start_lat: isRoadWork ? start?.lat : null, start_lng: isRoadWork ? start?.lng : null,
        end_lat: isRoadWork ? end?.lat : null, end_lng: isRoadWork ? end?.lng : null,
        location_lat: isOtherWork ? location?.lat : null, location_lng: isOtherWork ? location?.lng : null,
        distance_m: isRoadWork ? distance : null,
        width: isRoadWork && width ? parseFloat(width) : null,
        details: isOtherWork ? details : null,
        readiness, problem: readiness === 'มีอุปสรรค' ? problem : null,
        waypoints: isRoadWork ? waypoints : null,
        route_path: isRoadWork ? routePath : null,
        // ⭐ เพิ่มหมายเหตุใน Payload
        remarks: remarks.trim() !== '' ? remarks : null,
      };

      const { error } = await supabase.from('village_plans').insert(payload);
      
      if (error) throw error;

      setSuccessModalData({ village, planName });
      
      setVillage(''); setPlanName(''); setPlanType(''); 
      setStart(null); setStartLat(''); setStartLng('');
      setEnd(null); setEndLat(''); setEndLng('');
      setWaypoints([]); setLocation(null);
      setDistance(null); setWidth(''); setDetails(''); setReadiness('ไม่มีอุปสรรค'); setProblem(''); setPicking('start'); setRoutePath([]);
      // ⭐ ล้างค่าหมายเหตุ
      setRemarks('');
      
    } catch (err: any) {
      setAlertInfo({ title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    // ⭐ ลบ font-sans ออก
    <div className="min-h-screen pb-20 bg-slate-50/50">
      
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">ระบบสำรวจแผนพัฒนา</h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">เทศบาลตำบลท่าวังทอง (พย.11)</p>
            </div>
          </div>
          <Link href="/reports" className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden md:inline">ดูรายงาน</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6 mt-2 md:mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          
          <div className="lg:col-span-5 xl:col-span-4 rounded-3xl bg-white p-5 md:p-6 shadow-sm border border-slate-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">หมู่บ้าน <span className="text-red-500">*</span></label>
                <select value={village} onChange={(e) => setVillage(e.target.value)} className="w-full rounded-xl bg-slate-50 border-none px-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer appearance-none">
                  <option value="">-- เลือกหมู่บ้าน --</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">ชื่อแผน <span className="text-red-500">*</span></label>
                <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="เช่น ก่อสร้างถนน คสล. สายบ้าน..." className="w-full rounded-xl bg-slate-50 border-none px-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">ประเภทงาน <span className="text-red-500">*</span></label>
                <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full rounded-xl bg-slate-50 border-none px-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer appearance-none">
                  <option value="">-- เลือกประเภท --</option>
                  {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {isRoadWork && (
                <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-sm font-bold text-slate-700">โหมด:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button type="button" onClick={() => setDrawMode(false)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${!drawMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>ตามถนน</button>
                      <button type="button" onClick={() => setDrawMode(true)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${drawMode ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>วาดเอง</button>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <button type="button" onClick={() => setPicking('start')} className={`text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดเริ่มต้น</button>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="any" placeholder="Lat" value={startLat} onChange={(e) => { setStartLat(e.target.value); applyCoords('start', e.target.value, startLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                      <input type="number" step="any" placeholder="Lng" value={startLng} onChange={(e) => { setStartLng(e.target.value); applyCoords('start', startLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <button type="button" onClick={() => setPicking('end')} className={`text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดสิ้นสุด</button>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="any" placeholder="Lat" value={endLat} onChange={(e) => { setEndLat(e.target.value); applyCoords('end', e.target.value, endLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500" />
                      <input type="number" step="any" placeholder="Lng" value={endLng} onChange={(e) => { setEndLng(e.target.value); applyCoords('end', endLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPicking('waypoint')} className={`flex-1 text-xs px-2 py-2.5 rounded-lg font-bold transition shadow-sm ${picking === 'waypoint' ? 'bg-amber-500 text-white ring-2 ring-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                      {waypoints.length > 0 ? '📍 เพิ่มจุดผ่าน' : '📍 เพิ่มจุดผ่าน'}
                    </button>
                    {(start || end || waypoints.length > 0) && (
                      <button type="button" onClick={handleClearAllPoints} className="bg-red-100 text-red-600 px-4 py-2.5 rounded-lg font-bold hover:bg-red-200 transition shadow-sm border border-red-200 text-xs">
                        🗑️ ล้างจุด
                      </button>
                    )}
                  </div>
                  {picking === 'waypoint' && <p className="text-[10px] text-amber-600 font-bold text-center animate-pulse">* คลิกแผนที่เพื่อเพิ่มจุดผ่าน</p>}

                  <div className="flex gap-3 pt-1">
                    <div className={`flex-1 rounded-xl p-3 border shadow-sm ${drawMode ? 'bg-orange-50 border-orange-200' : 'bg-white border-blue-200'}`}>
                      <div className={`text-xs font-bold mb-1 ${drawMode ? 'text-orange-600' : 'text-slate-500'}`}>ระยะทาง</div>
                      <div className={`font-black text-lg ${drawMode ? 'text-orange-600' : 'text-blue-600'}`}>{distance != null ? `${(distance / 1000).toFixed(3)} กม.` : '-'}</div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">ความกว้าง (ม.)</label>
                      <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="เช่น 4" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition" />
                    </div>
                  </div>
                </div>
              )}

              {isOtherWork && (
                <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-bold text-amber-600 flex items-center gap-1">📍 ตำแหน่งที่ตั้ง</span>
                      <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border border-amber-200 text-slate-500">คลิกแผนที่</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">รายละเอียด</label>
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="ระบุรายละเอียด..." className="w-full rounded-xl bg-white border border-slate-300 px-3 py-3 text-sm font-medium outline-none focus:border-blue-500 transition" />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <label className="mb-2 block text-sm font-bold text-slate-700">สถานะอุปสรรค</label>
                <div className="flex gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setReadiness('ไม่มีอุปสรรค')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition border shadow-sm ${
                      readiness === 'ไม่มีอุปสรรค'
                        ? 'bg-white text-emerald-600 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    ไม่มีอุปสรรค
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadiness('มีอุปสรรค')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition border shadow-sm ${
                      readiness === 'มีอุปสรรค'
                        ? 'bg-white text-red-600 border-red-300 ring-2 ring-red-100'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    มีอุปสรรค
                  </button>
                </div>
                {readiness === 'มีอุปสรรค' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="ระบุรายละเอียดอุปสรรค..." className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 placeholder-red-400 outline-none focus:ring-2 focus:ring-red-100 transition" />
                  </div>
                )}
              </div>

              {/* ⭐ เพิ่มช่องหมายเหตุ */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">หมายเหตุเพิ่มเติม</label>
                <textarea 
                  value={remarks} 
                  onChange={(e) => setRemarks(e.target.value)} 
                  rows={3} 
                  placeholder="ระบุหมายเหตุหรือข้อมูลเพิ่มเติมที่นี่..." 
                  className="w-full rounded-xl bg-slate-50 border-none px-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition resize-none" 
                />
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-base font-black text-white transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:opacity-50 shadow-md">
                {loading ? '⏳ กำลังบันทึก...' : '💾 ส่งบันทึกข้อมูล'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 xl:col-span-6 h-[500px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 rounded-3xl bg-white p-2 shadow-sm border border-slate-200 overflow-hidden">
            <div className="w-full h-full rounded-2xl overflow-hidden relative">
               <MapPicker
                mode={isOtherWork ? 'single' : 'double'}
                start={isRoadWork ? start : location}
                end={end}
                waypoints={waypoints} 
                drawMode={drawMode}
                onPick={handleMapPick}
                onDrag={handleMapDrag}
                onWaypointDrag={handleWaypointDrag}
                onWaypointDelete={handleWaypointDelete}
                onClearStart={() => { setStart(null); setStartLat(''); setStartLng(''); }}
                onClearEnd={() => { setEnd(null); setEndLat(''); setEndLng(''); }}
                onClearLocation={() => setLocation(null)}
                onRouteUpdate={(route) => setRoutePath(route)}
                roadName={planName}
                distanceKm={distance ? distance / 1000 : null}
                fullHeight
              />
            </div>
          </div>

        </div>
      </main>

      {alertInfo && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full ${alertInfo.type === 'error' ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'} shadow-inner`}>
               {alertInfo.type === 'error' ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
               )}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{alertInfo.title}</h3>
            <p className="text-base text-slate-500 mb-6">{alertInfo.message}</p>
            <button onClick={() => setAlertInfo(null)} className={`w-full rounded-xl py-3.5 text-sm font-bold text-white transition shadow-md ${alertInfo.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

      {successModalData && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl shadow-inner text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">บันทึกสำเร็จ!</h3>
            <p className="text-base text-slate-500 mb-6">ข้อมูลแผนพัฒนาถูกบันทึกลงระบบเรียบร้อยแล้ว</p>
            <div className="w-full rounded-xl bg-slate-50 p-4 border border-slate-200 mb-6 text-left space-y-1">
              <div className="text-xs font-bold text-slate-400">หมู่บ้าน</div>
              <div className="font-bold text-slate-800 text-base mb-2">{successModalData.village}</div>
              <div className="text-xs font-bold text-slate-400">ชื่อแผน</div>
              <div className="font-bold text-slate-800 text-base truncate">{successModalData.planName}</div>
            </div>
            <button onClick={() => setSuccessModalData(null)} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white hover:bg-emerald-600 transition shadow-md">
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}