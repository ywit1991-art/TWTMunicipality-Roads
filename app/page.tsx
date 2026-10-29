'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LatLng } from '@/lib/osrm';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { 
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-400">กำลังโหลดแผนที่...</div>
});

const VILLAGES = ['หมู่ 6', 'หมู่ 7', 'หมู่ 10', 'หมู่ 11'];
const ROAD_WORK_TYPES = ['ถนน คสล.', 'รางระบายน้ำ คสล.', 'วางท่อ คสล.', 'ถนนการเกษตร', 'ซ่อมแซมถนน', 'ขุดลอก'];
const OTHER_WORK_TYPES = ['ปรับปรุง/ก่อสร้าง'];
const ALL_TYPES = [...ROAD_WORK_TYPES, ...OTHER_WORK_TYPES];

// ⭐ ฟังก์ชันคำนวณระยะทางเส้นตรง (Haversine formula)
function getStraightLineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
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
  
  // ⭐ State สำหรับโหมดวาดเส้นเอง
  const [drawMode, setDrawMode] = useState(false);

  const [location, setLocation] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [width, setWidth] = useState('');
  const [details, setDetails] = useState('');
  const [readiness, setReadiness] = useState<'พร้อม' | 'ไม่พร้อม'>('พร้อม');
  const [problem, setProblem] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);
  const [successModalData, setSuccessModalData] = useState<{ village: string; planName: string } | null>(null);

  const isRoadWork = ROAD_WORK_TYPES.includes(planType);
  const isOtherWork = OTHER_WORK_TYPES.includes(planType);

  // ⭐ คำนวณระยะทาง (ถ้าเป็นโหมดวาดเอง จะคำนวณจากเส้นตรง)
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
        // คำนวณผ่าน OSRM
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
        setPicking('end');
      } else if (picking === 'waypoint') {
        setWaypoints([...waypoints, p]);
      } else {
        setEnd(p);
      }
    } else {
      setLocation(p);
    }
  }

  function handleMapDrag(which: 'start' | 'end', p: LatLng) {
    if (which === 'start') setStart(p);
    else setEnd(p);
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
    if (readiness === 'ไม่พร้อม' && !problem.trim()) {
      return setAlertInfo({ title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณาระบุ "ปัญหาที่ไม่พร้อม" ด้วยครับ', type: 'error' });
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
        readiness, problem: readiness === 'ไม่พร้อม' ? problem : null,
      };

      const { error } = await supabase.from('village_plans').insert(payload);
      
      if (error) throw error;

      setSuccessModalData({ village, planName });
      
      setVillage(''); setPlanName(''); setPlanType(''); setStart(null); setEnd(null); setWaypoints([]); setLocation(null);
      setDistance(null); setWidth(''); setDetails(''); setReadiness('พร้อม'); setProblem(''); setPicking('start');
      
    } catch (err: any) {
      setAlertInfo({ title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100/50 pb-10">
      
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-800 to-indigo-900 px-4 py-4 md:px-6 md:py-5 text-white shadow-lg z-10 relative">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-2xl md:text-3xl bg-white/20 p-1.5 md:p-2 rounded-xl backdrop-blur-sm shrink-0">📋</span> 
            <div>
              <h1 className="text-lg md:text-2xl font-black tracking-tight leading-tight">
                ระบบสำรวจแผนพัฒนาหมู่บ้าน
              </h1>
              <p className="text-blue-200 mt-0.5 text-xs md:text-sm font-medium leading-tight">
                เทศบาลตำบลท่าวังทอง (พย.11)
              </p>
            </div>
          </div>
          <Link href="/reports" className="shrink-0 rounded-xl bg-white/10 px-3 py-2 md:px-5 md:py-2.5 text-sm md:text-base font-bold hover:bg-white/20 transition shadow-sm border border-white/10 backdrop-blur-sm flex items-center gap-1.5 md:gap-2">
            📊 <span className="hidden md:inline">ดูรายงาน</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6 mt-2 md:mt-0">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 md:gap-6">
          
          <div className="lg:col-span-4 xl:col-span-3 rounded-3xl bg-white p-5 md:p-6 shadow-sm border border-slate-200">
            <div className="space-y-5 md:space-y-5 pb-6">
              
              <div>
                <label className="mb-2 block text-lg font-bold text-slate-700">หมู่บ้าน <span className="text-red-500">*</span></label>
                <select value={village} onChange={(e) => setVillage(e.target.value)} className="w-full rounded-xl border-none bg-slate-50 px-4 py-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer appearance-none">
                  <option value="">-- เลือกหมู่บ้าน --</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-lg font-bold text-slate-700">ชื่อแผน <span className="text-red-500">*</span></label>
                <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="เช่น ก่อสร้างถนน คสล. สายบ้าน..." className="w-full rounded-xl border-none bg-slate-50 px-4 py-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
              </div>

              <div>
                <label className="mb-2 block text-lg font-bold text-slate-700">ประเภทงาน <span className="text-red-500">*</span></label>
                <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full rounded-xl border-none bg-slate-50 px-4 py-4 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer appearance-none">
                  <option value="">-- เลือกประเภท --</option>
                  {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {isRoadWork && (
                <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  
                  {/* ⭐ ปุ่มสลับโหมด */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-sm font-bold text-slate-700">โหมดคำนวณ:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button type="button" onClick={() => setDrawMode(false)} className={`px-3 py-1 text-xs font-bold rounded-md transition ${!drawMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>ตามถนน</button>
                      <button type="button" onClick={() => setDrawMode(true)} className={`px-3 py-1 text-xs font-bold rounded-md transition ${drawMode ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>วาดเอง</button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPicking('start')} className={`flex-1 text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 เริ่มต้น</button>
                    <button type="button" onClick={() => setPicking('end')} className={`flex-1 text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 สิ้นสุด</button>
                  </div>

                  <div className="pt-2 border-t border-blue-200">
                    <button type="button" onClick={() => setPicking('waypoint')} className={`w-full text-sm px-3 py-2.5 rounded-lg font-bold transition shadow-sm ${picking === 'waypoint' ? 'bg-amber-500 text-white ring-2 ring-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                      {waypoints.length > 0 ? '📍 คลิกเพิ่มจุดผ่านต่อ' : '📍 เพิ่มจุดผ่าน'}
                    </button>
                    {picking === 'waypoint' && <p className="text-xs text-amber-600 font-bold mt-1 text-center animate-pulse">* คลิกบนแผนที่เพื่อเพิ่มจุดผ่าน</p>}
                  </div>

                  {waypoints.length > 0 && (
                    <div className="space-y-2 mt-2 bg-white p-3 rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-500 mb-1">จุดผ่านที่กำหนด:</div>
                      {waypoints.map((wp, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-sm border border-slate-100">
                          <span className="font-bold text-slate-700">จุดที่ {idx + 1}</span>
                          <button type="button" onClick={() => handleWaypointDelete(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded">ลบ</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <div className={`flex-1 rounded-xl p-3 border shadow-sm ${drawMode ? 'bg-orange-50 border-orange-200' : 'bg-white border-blue-200'}`}>
                      <div className={`text-sm font-bold mb-1 ${drawMode ? 'text-orange-600' : 'text-slate-500'}`}>ระยะทาง</div>
                      <div className={`font-black text-xl ${drawMode ? 'text-orange-600' : 'text-blue-600'}`}>{distance != null ? `${(distance / 1000).toFixed(3)} กม.` : '-'}</div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">ความกว้าง (ม.)</label>
                      <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="เช่น 4" className="w-full rounded-lg border-none bg-slate-50 px-3 py-3 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
                    </div>
                  </div>
                </div>
              )}

              {isOtherWork && (
                <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-base font-bold text-amber-600 flex items-center gap-1">📍 ตำแหน่งที่ตั้ง</span>
                      <span className="text-sm font-bold bg-white px-2 py-1 rounded-lg border border-amber-200 text-slate-500">คลิกแผนที่</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-1.5">รายละเอียด</label>
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="ระบุรายละเอียด..." className="w-full rounded-xl border-none bg-slate-50 px-3 py-3 text-lg font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                <label className="mb-3 block text-lg font-bold text-slate-700">ความพร้อม</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-3.5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 transition">
                    <input type="radio" checked={readiness === 'พร้อม'} onChange={() => setReadiness('พร้อม')} className="h-6 w-6 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <span className="text-lg font-bold text-slate-700">✅ พร้อม</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-3.5 rounded-xl border border-slate-200 shadow-sm hover:border-red-400 transition">
                    <input type="radio" checked={readiness === 'ไม่พร้อม'} onChange={() => setReadiness('ไม่พร้อม')} className="h-6 w-6 text-red-600 focus:ring-red-500 cursor-pointer" />
                    <span className="text-lg font-bold text-slate-700">❌ ไม่พร้อม</span>
                  </label>
                </div>
                {readiness === 'ไม่พร้อม' && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="ระบุปัญหาที่ไม่พร้อม..." className="w-full rounded-xl border-none bg-red-50 px-4 py-4 text-lg font-medium text-red-800 placeholder-red-400 outline-none focus:ring-2 focus:ring-red-100 transition" />
                  </div>
                )}
              </div>

              <button type="submit" onClick={handleSubmit} disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-xl font-black text-white transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:opacity-50 shadow-md">
                {loading ? '⏳ กำลังบันทึก...' : '💾 ส่งบันทึกข้อมูล'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-7 h-[50vh] md:h-[500px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-6 rounded-3xl bg-white p-1.5 md:p-2 shadow-sm border border-slate-200 overflow-hidden">
            <div className="w-full h-full rounded-2xl overflow-hidden relative">
               <MapPicker
                mode={isOtherWork ? 'single' : 'double'}
                start={isRoadWork ? start : location}
                end={end}
                waypoints={waypoints} 
                drawMode={drawMode} // ⭐ ส่งค่าโหมดวาดเอง
                onPick={handleMapPick}
                onDrag={handleMapDrag}
                onWaypointDrag={handleWaypointDrag}
                onWaypointDelete={handleWaypointDelete}
                roadName={planName}
                distanceKm={distance ? distance / 1000 : null}
                fullHeight
              />
            </div>
          </div>

        </div>
      </main>

      {/* Alert & Success Modals */}
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
            <button onClick={() => setAlertInfo(null)} className={`w-full rounded-xl py-4 text-base font-bold text-white transition shadow-md ${alertInfo.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
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
              <div className="text-sm font-bold text-slate-400">หมู่บ้าน</div>
              <div className="font-bold text-slate-800 text-lg mb-2">{successModalData.village}</div>
              <div className="text-sm font-bold text-slate-400">ชื่อแผน</div>
              <div className="font-bold text-slate-800 text-lg truncate">{successModalData.planName}</div>
            </div>
            <button onClick={() => setSuccessModalData(null)} className="w-full rounded-xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 transition shadow-md">
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}