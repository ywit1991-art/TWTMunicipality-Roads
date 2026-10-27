'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getRoadDistance, LatLng } from '@/lib/osrm';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { 
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-400">กำลังโหลดแผนที่...</div>
});

const VILLAGES = ['หมู่ 6', 'หมู่ 7', 'หมู่ 10', 'หมู่ 11'];
const ROAD_WORK_TYPES = ['ถนน คสล.', 'รางระบายน้ำ คสล.', 'วางท่อ คสล.', 'ถนนการเกษตร', 'ซ่อมแซมถนน', 'ขุดลอก'];
const OTHER_WORK_TYPES = ['ปรับปรุง/ก่อสร้าง'];
const ALL_TYPES = [...ROAD_WORK_TYPES, ...OTHER_WORK_TYPES];

export default function SurveyPage() {
  const [village, setVillage] = useState('');
  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState('');
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [width, setWidth] = useState('');
  const [details, setDetails] = useState('');
  const [readiness, setReadiness] = useState<'พร้อม' | 'ไม่พร้อม'>('พร้อม');
  const [problem, setProblem] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const isRoadWork = ROAD_WORK_TYPES.includes(planType);
  const isOtherWork = OTHER_WORK_TYPES.includes(planType);

  useEffect(() => {
    if (isRoadWork && start && end) {
      getRoadDistance(start, end).then((r) => setDistance(r.distance_m)).catch(() => setDistance(null));
    } else {
      setDistance(null);
    }
  }, [start, end, isRoadWork]);

  function handleMapPick(p: LatLng) {
    if (isRoadWork) {
      if (picking === 'start') {
        setStart(p);
        setPicking('end');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (!village || !planName || !planType) return setMessage('❌ กรุณากรอกข้อมูลพื้นฐานให้ครบ');
    if (isRoadWork && (!start || !end)) return setMessage('❌ กรุณาระบุจุดเริ่มต้นและจุดสิ้นสุดบนแผนที่');
    if (isOtherWork && !location) return setMessage('❌ กรุณาระบุตำแหน่งบนแผนที่');
    if (readiness === 'ไม่พร้อม' && !problem.trim()) return setMessage('❌ กรุณาระบุปัญหาที่ไม่พร้อม');

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

      setVillage(''); setPlanName(''); setPlanType(''); setStart(null); setEnd(null); setLocation(null);
      setDistance(null); setWidth(''); setDetails(''); setReadiness('พร้อม'); setProblem(''); setPicking('start');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      setMessage('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col lg:h-screen lg:overflow-hidden bg-slate-100/50">
      
      {/* ⭐ Header ปรับให้ Responsive พอดีมือถือ */}
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-800 to-indigo-900 px-3 py-3 md:px-6 md:py-5 text-white shadow-lg z-10 relative">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-2xl md:text-3xl bg-white/20 p-1.5 md:p-2 rounded-xl backdrop-blur-sm shrink-0">📋</span> 
            <div>
              <h1 className="text-base md:text-2xl font-black tracking-tight leading-tight">
                ระบบสำรวจแผนพัฒนาหมู่บ้าน
              </h1>
              <p className="text-blue-200 mt-0.5 text-[10px] md:text-sm font-medium leading-tight">
                เทศบาลตำบลท่าวังทอง (พย.11)
              </p>
            </div>
          </div>
          <Link href="/reports" className="shrink-0 rounded-xl bg-white/10 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-bold hover:bg-white/20 transition shadow-sm border border-white/10 backdrop-blur-sm flex items-center gap-1.5 md:gap-2">
            📊 <span className="hidden md:inline">ดูรายงาน</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:overflow-hidden p-3 md:p-6">
        <div className="mx-auto max-w-7xl w-full h-full flex flex-col">
          
          {(showSuccess || message) && (
            <div className="mb-3 md:mb-4 flex-shrink-0">
              {showSuccess && <div className="rounded-xl bg-emerald-50 p-2.5 md:p-3 text-emerald-800 border border-emerald-200 font-bold text-sm shadow-sm flex items-center gap-2 animate-in fade-in"><span className="text-lg md:text-xl">✅</span> บันทึกข้อมูลสำรวจเรียบร้อยแล้ว!</div>}
              {message && <div className="rounded-xl bg-red-50 p-2.5 md:p-3 text-red-800 border border-red-200 font-bold text-sm shadow-sm flex items-center gap-2 animate-in fade-in"><span className="text-lg md:text-xl">⚠️</span> {message}</div>}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6 flex-1 lg:h-full lg:overflow-hidden min-h-0">
            
            <div className="lg:col-span-4 xl:col-span-3 h-full overflow-y-auto custom-scrollbar rounded-3xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
              <div className="space-y-4 md:space-y-5 pb-6 md:pb-10">
                <div>
                  <label className="mb-1.5 md:mb-2 block text-sm font-bold text-slate-700">หมู่บ้าน <span className="text-red-500">*</span></label>
                  <select value={village} onChange={(e) => setVillage(e.target.value)} required className="w-full rounded-xl border-none bg-slate-50 px-3 md:px-4 py-2.5 md:py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
                    <option value="">-- เลือกหมู่บ้าน --</option>
                    {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 md:mb-2 block text-sm font-bold text-slate-700">ชื่อแผน <span className="text-red-500">*</span></label>
                  <input value={planName} onChange={(e) => setPlanName(e.target.value)} required placeholder="เช่น ก่อสร้างถนน คสล. สายบ้าน..." className="w-full rounded-xl border-none bg-slate-50 px-3 md:px-4 py-2.5 md:py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
                </div>

                <div>
                  <label className="mb-1.5 md:mb-2 block text-sm font-bold text-slate-700">ประเภทงาน <span className="text-red-500">*</span></label>
                  <select value={planType} onChange={(e) => setPlanType(e.target.value)} required className="w-full rounded-xl border-none bg-slate-50 px-3 md:px-4 py-2.5 md:py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
                    <option value="">-- เลือกประเภท --</option>
                    {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {isRoadWork && (
                  <div className="space-y-3 md:space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3 md:p-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs md:text-sm font-bold text-emerald-600 flex items-center gap-1">🟢 จุดเริ่มต้น</span>
                        <button type="button" onClick={() => setPicking('start')} className={`text-[10px] md:text-[11px] px-2 md:px-2.5 py-1 rounded-md font-bold transition shadow-sm ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 เลือกบนแผนที่</button>
                      </div>
                      <div className="text-[11px] md:text-xs text-slate-600 font-mono bg-white px-2 md:px-3 py-2 rounded-lg border border-slate-200 shadow-sm truncate">{start ? `${start.lat.toFixed(6)}, ${start.lng.toFixed(6)}` : 'ยังไม่ได้เลือกพิกัด'}</div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs md:text-sm font-bold text-red-500 flex items-center gap-1">🔴 จุดสิ้นสุด</span>
                        <button type="button" onClick={() => setPicking('end')} className={`text-[10px] md:text-[11px] px-2 md:px-2.5 py-1 rounded-md font-bold transition shadow-sm ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 เลือกบนแผนที่</button>
                      </div>
                      <div className="text-[11px] md:text-xs text-slate-600 font-mono bg-white px-2 md:px-3 py-2 rounded-lg border border-slate-200 shadow-sm truncate">{end ? `${end.lat.toFixed(6)}, ${end.lng.toFixed(6)}` : 'ยังไม่ได้เลือกพิกัด'}</div>
                    </div>

                    <div className="flex gap-2 md:gap-3 pt-1">
                      <div className="flex-1 rounded-xl bg-white p-2 md:p-2.5 border border-blue-200 shadow-sm">
                        <div className="text-[10px] font-bold text-slate-500 mb-0.5">ระยะทาง</div>
                        <div className="font-black text-base md:text-lg text-blue-600">{distance != null ? `${(distance / 1000).toFixed(3)} กม.` : '-'}</div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ความกว้าง (ม.)</label>
                        <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="เช่น 4" className="w-full rounded-lg border-none bg-slate-50 px-2 md:px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
                      </div>
                    </div>
                  </div>
                )}

                {isOtherWork && (
                  <div className="space-y-3 md:space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-3 md:p-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs md:text-sm font-bold text-amber-600 flex items-center gap-1">📍 ตำแหน่งที่ตั้ง</span>
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-amber-200 text-slate-500">คลิกแผนที่</span>
                      </div>
                      <div className="text-[11px] md:text-xs text-slate-600 font-mono bg-white px-2 md:px-3 py-2 rounded-lg border border-slate-200 shadow-sm truncate">{location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'ยังไม่ได้เลือกพิกัด'}</div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">รายละเอียด</label>
                      <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="ระบุรายละเอียด..." className="w-full rounded-xl border-none bg-slate-50 px-2 md:px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 p-3 md:p-4 bg-slate-50">
                  <label className="mb-2 block text-sm font-bold text-slate-700">ความพร้อม</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:border-blue-400 transition">
                      <input type="radio" checked={readiness === 'พร้อม'} onChange={() => setReadiness('พร้อม')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs md:text-sm font-bold text-slate-700">✅ พร้อม</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:border-red-400 transition">
                      <input type="radio" checked={readiness === 'ไม่พร้อม'} onChange={() => setReadiness('ไม่พร้อม')} className="h-4 w-4 text-red-600 focus:ring-red-500 cursor-pointer" />
                      <span className="text-xs md:text-sm font-bold text-slate-700">❌ ไม่พร้อม</span>
                    </label>
                  </div>
                  {readiness === 'ไม่พร้อม' && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                      <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="ระบุปัญหาที่ไม่พร้อม..." className="w-full rounded-lg border-none bg-red-50 px-2 md:px-3 py-2.5 text-sm font-medium text-red-800 placeholder-red-400 outline-none focus:ring-2 focus:ring-red-100 transition" />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 md:py-4 text-base md:text-lg font-black text-white transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:opacity-50 shadow-md">
                  {loading ? '⏳ กำลังบันทึก...' : '💾 ส่งบันทึกข้อมูล'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 xl:col-span-7 h-[400px] md:h-[500px] lg:h-full rounded-3xl bg-white p-1.5 md:p-2 shadow-sm border border-slate-200 overflow-hidden">
              <div className="w-full h-full rounded-2xl overflow-hidden relative">
                 <MapPicker
                  mode={isOtherWork ? 'single' : 'double'}
                  start={isRoadWork ? start : location}
                  end={end}
                  onPick={handleMapPick}
                  onDrag={handleMapDrag}
                  roadName={planName}
                  distanceKm={distance ? distance / 1000 : null}
                  fullHeight
                />
              </div>
            </div>

          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>
    </div>
  );
}