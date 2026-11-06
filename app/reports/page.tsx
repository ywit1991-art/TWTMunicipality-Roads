'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LatLng } from '@/lib/osrm';
import type { VillagePlan } from '@/components/ReportsMap';

const MapPicker = nextDynamic(() => import('@/components/MapPicker'), { ssr: false });
const ReportsMap = nextDynamic(() => import('@/components/ReportsMap'), { 
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

export default function ReportsPage() {
  const [plans, setPlans] = useState<VillagePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<VillagePlan | null>(null);

  const [planToDelete, setPlanToDelete] = useState<VillagePlan | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVillage, setFilterVillage] = useState('ทั้งหมด');
  const [filterType, setFilterType] = useState('ทั้งหมด');
  const [filterReadiness, setFilterReadiness] = useState('ทั้งหมด');

  const [editStart, setEditStart] = useState<LatLng | null>(null);
  const [editEnd, setEditEnd] = useState<LatLng | null>(null);
  const [editWaypoints, setEditWaypoints] = useState<LatLng[]>([]); 
  const [editRoutePath, setEditRoutePath] = useState<[number, number][]>([]); 
  const [drawMode, setDrawMode] = useState(false); 
  const [picking, setPicking] = useState<'start' | 'end' | 'waypoint'>('start');

  const [editStartLat, setEditStartLat] = useState('');
  const [editStartLng, setEditStartLng] = useState('');
  const [editEndLat, setEditEndLat] = useState('');
  const [editEndLng, setEditEndLng] = useState('');

  const [editLocation, setEditLocation] = useState<LatLng | null>(null);
  const [editDistance, setEditDistance] = useState<number | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete', plan: VillagePlan } | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase.from('village_plans').select('*').order('created_at', { ascending: false });
    if (!error) setPlans(data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filteredPlans = plans.filter((plan) => {
    const matchSearch = plan.plan_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchVillage = filterVillage === 'ทั้งหมด' || plan.village === filterVillage;
    const matchType = filterType === 'ทั้งหมด' || plan.plan_type === filterType;
    
    const isNoObstacle = plan.readiness === 'ไม่มีอุปสรรค' || plan.readiness === 'พร้อม';
    const hasObstacle = plan.readiness === 'มีอุปสรรค' || plan.readiness === 'ไม่พร้อม';
    const matchReadiness = 
      filterReadiness === 'ทั้งหมด' ? true :
      filterReadiness === 'ไม่มีอุปสรรค' ? isNoObstacle : hasObstacle;

    return matchSearch && matchVillage && matchType && matchReadiness;
  });

  const clearFilters = () => { 
    setSearchQuery(''); 
    setFilterVillage('ทั้งหมด'); 
    setFilterType('ทั้งหมด'); 
    setFilterReadiness('ทั้งหมด');
  };
  const hasFilter = searchQuery !== '' || filterVillage !== 'ทั้งหมด' || filterType !== 'ทั้งหมด' || filterReadiness !== 'ทั้งหมด';

  const requestAuth = (type: 'edit' | 'delete', plan: VillagePlan) => {
    setPendingAction({ type, plan });
    setPassword(''); setAuthError(''); setIsAuthModalOpen(true);
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  const verifyPassword = (inputPass: string) => {
    if (inputPass === '55555') {
      setIsAuthModalOpen(false);
      if (pendingAction?.type === 'delete') {
        setPlanToDelete(pendingAction.plan);
      } else if (pendingAction?.type === 'edit') {
        executeEdit(pendingAction.plan);
      }
      setPendingAction(null);
    } else {
      setAuthError('❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่');
      setPassword(''); 
      passwordInputRef.current?.focus();
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setAuthError('');
    if (val.length === 5) verifyPassword(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') verifyPassword(password);
  };

  async function handleConfirmDelete() {
    if (!planToDelete || !planToDelete.id) return;
    const { error } = await supabase.from('village_plans').delete().eq('id', planToDelete.id);
    if (error) {
      setAlertInfo({ title: 'ลบไม่สำเร็จ', message: error.message, type: 'error' });
    } else {
      loadData();
      setAlertInfo({ title: 'ลบข้อมูลสำเร็จ!', message: 'ข้อมูลแผนพัฒนาถูกลบออกจากระบบแล้ว', type: 'success' });
    }
    setPlanToDelete(null);
  }

  function executeEdit(plan: VillagePlan) {
    const mappedReadiness = plan.readiness === 'พร้อม' ? 'ไม่มีอุปสรรค' : plan.readiness === 'ไม่พร้อม' ? 'มีอุปสรรค' : plan.readiness;
    const newPlan = { ...plan, readiness: mappedReadiness };

    setEditingPlan(newPlan);
    setEditStart(plan.start_lat && plan.start_lng ? { lat: plan.start_lat, lng: plan.start_lng } : null);
    setEditStartLat(plan.start_lat ? plan.start_lat.toString() : '');
    setEditStartLng(plan.start_lng ? plan.start_lng.toString() : '');

    setEditEnd(plan.end_lat && plan.end_lng ? { lat: plan.end_lat, lng: plan.end_lng } : null);
    setEditEndLat(plan.end_lat ? plan.end_lat.toString() : '');
    setEditEndLng(plan.end_lng ? plan.end_lng.toString() : '');

    setEditLocation(plan.location_lat && plan.location_lng ? { lat: plan.location_lat, lng: plan.location_lng } : null);
    setEditDistance(plan.distance_m); 
    
    setEditWaypoints(plan.waypoints || []);
    setEditRoutePath(plan.route_path || []);
    
    if ((plan.route_path && plan.route_path.length > 0) || (plan.waypoints && plan.waypoints.length > 0)) {
      setDrawMode(true);
    } else {
      setDrawMode(false); 
    }
    
    setPicking('start');
  }

  useEffect(() => {
    const isRoad = editingPlan ? ROAD_WORK_TYPES.includes(editingPlan.plan_type) : false;
    if (isRoad && editStart && editEnd) {
      if (drawMode) {
        let points = [editStart, ...editWaypoints, editEnd];
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
          total += getStraightLineDistance(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }
        setEditDistance(total);
      } else {
        let coords = `${editStart.lng},${editStart.lat}`;
        editWaypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
        coords += `;${editEnd.lng},${editEnd.lat}`;
        
        fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.length > 0) {
              setEditDistance(data.routes[0].distance);
            } else {
              setEditDistance(null);
            }
          }).catch(() => setEditDistance(null));
      }
    } else {
      setEditDistance(null);
    }
  }, [editStart, editEnd, editWaypoints, editingPlan, drawMode]);

  function handleMapPick(p: LatLng) {
    if (!editingPlan) return;
    const isRoad = ROAD_WORK_TYPES.includes(editingPlan.plan_type);
    
    if (isRoad) {
      if (picking === 'start') { 
        setEditStart(p); 
        setEditStartLat(p.lat.toString());
        setEditStartLng(p.lng.toString());
        setPicking('end'); 
      }
      else if (picking === 'waypoint') { 
        setEditWaypoints([...editWaypoints, p]); 
        if (!drawMode) setDrawMode(true); 
      }
      else { 
        setEditEnd(p); 
        setEditEndLat(p.lat.toString());
        setEditEndLng(p.lng.toString());
      }
    } else { 
      setEditLocation(p); 
    }
  }

  function applyCoords(type: 'start' | 'end', latStr: string, lngStr: string) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (type === 'start') setEditStart({ lat, lng });
      else setEditEnd({ lat, lng });
    }
  }

  function handleClearAllPoints() {
    if (confirm('คุณต้องการล้างจุดทั้งหมดและเริ่มวาดใหม่ใช่หรือไม่?')) {
      setEditStart(null); setEditStartLat(''); setEditStartLng('');
      setEditEnd(null); setEditEndLat(''); setEditEndLng('');
      setEditWaypoints([]);
      setEditLocation(null);
      setEditDistance(null);
      setEditRoutePath([]);
      setPicking('start');
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    const isRoad = ROAD_WORK_TYPES.includes(editingPlan.plan_type);

    let finalRoutePath = editRoutePath;
    if (isRoad) {
      if (drawMode) {
        const points = [editStart, ...editWaypoints, editEnd].filter(p => p !== null) as LatLng[];
        finalRoutePath = points.map(p => [p.lat, p.lng]);
      } else if (editStart && editEnd) {
        let coords = `${editStart.lng},${editStart.lat}`;
        editWaypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
        coords += `;${editEnd.lng},${editEnd.lat}`;
        try {
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
          const data = await res.json();
          if (data.code === 'Ok' && data.routes?.length > 0) {
            finalRoutePath = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
          }
        } catch (err) { console.error(err); }
      }
    }

    const { error } = await supabase.from('village_plans').update({
        village: editingPlan.village, 
        plan_name: editingPlan.plan_name, 
        plan_type: editingPlan.plan_type,
        readiness: editingPlan.readiness, 
        problem: editingPlan.readiness === 'มีอุปสรรค' ? editingPlan.problem : null,
        details: editingPlan.details, 
        width: editingPlan.width,
        start_lat: isRoad ? editStart?.lat : null, 
        start_lng: isRoad ? editStart?.lng : null,
        end_lat: isRoad ? editEnd?.lat : null, 
        end_lng: isRoad ? editEnd?.lng : null,
        location_lat: !isRoad ? editLocation?.lat : null, 
        location_lng: !isRoad ? editLocation?.lng : null,
        distance_m: isRoad ? editDistance : null,
        waypoints: isRoad ? editWaypoints : null, 
        route_path: isRoad ? finalRoutePath : null,
        remarks: editingPlan.remarks || null, 
      }).eq('id', editingPlan.id);

    if (error) {
      setAlertInfo({ title: 'แก้ไขไม่สำเร็จ', message: error.message, type: 'error' });
    } else {
      setEditingPlan(null);
      loadData();
      setAlertInfo({ title: 'แก้ไขข้อมูลสำเร็จ!', message: 'ข้อมูลแผนพัฒนาถูกอัปเดตเรียบร้อยแล้ว', type: 'success' });
    }
  }

  const isRoadWork = editingPlan ? ROAD_WORK_TYPES.includes(editingPlan.plan_type) : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full overflow-hidden">
      
      <header className="flex-shrink-0 bg-white border-b border-slate-200 w-full px-4 md:px-6 py-3 shadow-sm z-10 sticky top-0">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-blue-50 text-blue-600 p-2 rounded-xl shrink-0">📊</span>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-800">
                รายงานผลการสำรวจ
              </h1>
              <p className="text-blue-500 text-xs font-medium">
                เทศบาลตำบลท่าวังทอง (พย.11)
              </p>
            </div>
          </div>
          <Link href="/" className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 transition shadow-sm flex items-center gap-2">
            <span>⬅️</span> <span className="hidden sm:inline">กลับหน้าสำรวจ</span>
          </Link>
        </div>
      </header>

      {/* ⭐ ใช้ Grid 12 คอลัมน์ ซ้าย 4 ขวา 8 */}
      <main className="flex-1 w-full p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        
        {/* ฝั่งซ้าย (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-[calc(100vh-6rem)] lg:h-[calc(100vh-5rem)] min-w-0">
          
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input type="text" placeholder="ค้นหาชื่อแผน..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-base font-medium outline-none focus:border-blue-400 focus:bg-white transition" />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition cursor-pointer appearance-none pr-8">
                  <option value="ทั้งหมด">🏘️ ทุกหมู่บ้าน</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              
              <div className="relative">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition cursor-pointer appearance-none pr-8">
                  <option value="ทั้งหมด">🛠️ ทุกประเภท</option>
                  {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <select value={filterReadiness} onChange={(e) => setFilterReadiness(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition cursor-pointer appearance-none pr-8">
                  <option value="ทั้งหมด">⚖️ ทุกสถานะอุปสรรค</option>
                  <option value="ไม่มีอุปสรรค">✅ ไม่มีอุปสรรค</option>
                  <option value="มีอุปสรรค">❌ มีอุปสรรค</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              {hasFilter && (
                <button onClick={clearFilters} className="shrink-0 rounded-xl bg-red-50 text-red-600 px-3 py-2.5 text-sm font-bold hover:bg-red-100 transition border border-red-100">
                  ✕ ล้าง
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
                <div className="text-[10px] font-bold text-blue-600">ทั้งหมด</div>
                <div className="text-lg font-black text-blue-700">{filteredPlans.length}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                <div className="text-[10px] font-bold text-emerald-600">ไม่มีอุปสรรค</div>
                <div className="text-lg font-black text-emerald-700">{filteredPlans.filter(p => p.readiness === 'ไม่มีอุปสรรค' || p.readiness === 'พร้อม').length}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center border border-red-100">
                <div className="text-[10px] font-bold text-red-600">มีอุปสรรค</div>
                <div className="text-lg font-black text-red-700">{filteredPlans.filter(p => p.readiness === 'มีอุปสรรค' || p.readiness === 'ไม่พร้อม').length}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-3 space-y-3">
            {loading ? (
              <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-10 text-slate-400">ไม่พบข้อมูล</div>
            ) : (
              filteredPlans.map((plan) => {
                const isNoObstacle = plan.readiness === 'ไม่มีอุปสรรค' || plan.readiness === 'พร้อม';
                return (
                  <div key={plan.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <div className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-block mb-1">{plan.village}</div>
                        <div className="font-bold text-slate-800 text-base leading-tight">{plan.plan_name}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border ${isNoObstacle ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                        {isNoObstacle ? '✅ ปกติ' : '❌ อุปสรรค'}
                      </span>
                    </div>
                    
                    <div className="text-xs font-bold text-slate-500 bg-slate-200/50 inline-block px-2 py-0.5 rounded mb-2">{plan.plan_type}</div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm bg-white rounded-lg p-2 border border-slate-100 mb-2">
                      <div className="text-slate-600 font-bold">
                        <span className="text-slate-400 text-xs block">ระยะทาง</span> 
                        <span className="font-mono text-blue-600">{plan.distance_m ? `${(plan.distance_m / 1000).toFixed(3)} กม.` : '-'}</span>
                      </div>
                      <div className="text-slate-600 font-bold">
                        <span className="text-slate-400 text-xs block">ความกว้าง</span> 
                        <span className="text-slate-800">{plan.width ? `${plan.width} ม.` : '-'}</span>
                      </div>
                      {plan.problem && <div className="col-span-2 text-xs text-red-600 font-bold mt-1">⚠️ {plan.problem}</div>}
                      {plan.remarks && <div className="col-span-2 text-xs text-slate-600 font-bold mt-1">📝 {plan.remarks}</div>}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => requestAuth('edit', plan)} className="flex-1 rounded-lg bg-amber-100 py-2 text-sm font-bold text-amber-700 border border-amber-200 active:bg-amber-200 transition">✏️ แก้ไข</button>
                      <button onClick={() => requestAuth('delete', plan)} className="flex-1 rounded-lg bg-red-100 py-2 text-sm font-bold text-red-700 border border-red-200 active:bg-red-200 transition">🗑️ ลบ</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ฝั่งขวา (8/12) */}
        <div className="lg:col-span-8 h-[500px] lg:h-[calc(100vh-5rem)] lg:sticky lg:top-[5rem] rounded-2xl bg-white p-2 shadow-sm border border-slate-200 overflow-hidden min-w-0">
          <div className="w-full h-full rounded-xl overflow-hidden relative">
            {loading ? (
              <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400 font-medium">กำลังโหลดแผนที่...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400 font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
            ) : (
              <ReportsMap plans={filteredPlans} />
            )}
          </div>
        </div>

      </main>

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl shadow-inner">🔒</div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">ยืนยันสิทธิ์การเข้าถึง</h3>
            <p className="text-sm text-slate-500 mb-6">กรุณากรอกรหัสผ่านเพื่อ{pendingAction?.type === 'edit' ? 'แก้ไข' : 'ลบ'}ข้อมูลนี้</p>
            
            <input
              ref={passwordInputRef}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={handlePasswordChange}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              placeholder="•••••"
              maxLength={5}
              className={`w-full rounded-2xl border-2 bg-slate-50 px-4 py-4 text-center text-3xl tracking-[0.5em] outline-none transition-all placeholder:tracking-normal placeholder:text-slate-300 ${authError ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
            />
            
            {authError && <p className="mt-2 text-sm font-bold text-red-500 animate-in slide-in-from-top-1">{authError}</p>}
            
            <div className="mt-3 text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              💡 รหัสสำหรับทดสอบคือ 55555
            </div>

            <div className="mt-6 flex w-full gap-3">
              <button type="button" onClick={() => setIsAuthModalOpen(false)} className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
              <button type="button" onClick={() => verifyPassword(password)} className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition">ยืนยันรหัส</button>
            </div>
          </div>
        </div>
      )}

      {planToDelete && (
        <div className="fixed inset-0 z-[3500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl shadow-inner text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">ยืนยันการลบข้อมูล</h3>
            <p className="text-sm text-slate-500 mb-4">
              คุณต้องการลบแผน <br />
              <span className="font-bold text-slate-800 text-base">"{planToDelete.plan_name}"</span> <br />
              ใช่หรือไม่?
            </p>
            <p className="text-xs text-red-500 font-bold bg-red-50 px-3 py-1.5 rounded-lg mb-6 w-full">
              ⚠️ ข้อมูลนี้จะหายไปถาวรและไม่สามารถกู้คืนได้
            </p>

            <div className="flex w-full gap-3">
              <button onClick={() => setPlanToDelete(null)} className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
              <button onClick={handleConfirmDelete} className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 shadow-md transition">ยืนยันการลบ</button>
            </div>
          </div>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-20 flex items-center justify-between bg-amber-500 p-4 md:p-5 text-white">
              <h3 className="font-bold text-base md:text-xl flex items-center gap-2">✏️ แก้ไขข้อมูลแผนและพิกัด</h3>
              <button onClick={() => setEditingPlan(null)} className="rounded-full bg-white/20 w-8 h-8 flex items-center justify-center hover:bg-white/30 transition font-bold">✕</button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="flex flex-col gap-4 md:gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">หมู่บ้าน</label>
                    <div className="relative">
                      <select value={editingPlan.village} onChange={(e) => setEditingPlan({...editingPlan, village: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition bg-slate-50 text-base appearance-none pr-10">
                        {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อแผน</label>
                    <input type="text" value={editingPlan.plan_name} onChange={(e) => setEditingPlan({...editingPlan, plan_name: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition text-base" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ประเภทงาน</label>
                  <div className="relative">
                    <select value={editingPlan.plan_type} onChange={(e) => setEditingPlan({...editingPlan, plan_type: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition bg-slate-50 text-base appearance-none pr-10">
                      {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {isRoadWork && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">ความกว้าง (เมตร)</label>
                      <input type="number" step="0.01" value={editingPlan.width || ''} onChange={(e) => setEditingPlan({...editingPlan, width: e.target.value ? parseFloat(e.target.value) : null})} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 text-base" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">ระยะทาง (คำนวณใหม่)</label>
                      <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-700 text-base">
                        {editDistance ? `${(editDistance / 1000).toFixed(3)} กม.` : '-'}
                      </div>
                    </div>
                  </div>
                )}

                {!isRoadWork && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">รายละเอียด</label>
                    <textarea value={editingPlan.details || ''} onChange={(e) => setEditingPlan({...editingPlan, details: e.target.value})} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 transition text-base" />
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <label className="mb-3 block text-sm font-bold text-slate-700">สถานะอุปสรรค</label>
                  <div className="flex gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setEditingPlan({...editingPlan, readiness: 'ไม่มีอุปสรรค'})}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base transition border shadow-sm ${
                        editingPlan.readiness === 'ไม่มีอุปสรรค'
                          ? 'bg-white text-emerald-600 border-emerald-300 ring-2 ring-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ไม่มีอุปสรรค
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPlan({...editingPlan, readiness: 'มีอุปสรรค'})}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base transition border shadow-sm ${
                        editingPlan.readiness === 'มีอุปสรรค'
                          ? 'bg-white text-red-600 border-red-300 ring-2 ring-red-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      มีอุปสรรค
                    </button>
                  </div>
                  {editingPlan.readiness === 'มีอุปสรรค' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <input type="text" value={editingPlan.problem || ''} onChange={(e) => setEditingPlan({...editingPlan, problem: e.target.value})} placeholder="ระบุรายละเอียดอุปสรรค..." className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-base outline-none focus:border-red-500" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">หมายเหตุเพิ่มเติม</label>
                  <textarea value={editingPlan.remarks || ''} onChange={(e) => setEditingPlan({...editingPlan, remarks: e.target.value})} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 transition text-base" placeholder="ระบุหมายเหตุ..." />
                </div>

                <div className="mt-auto pt-6 flex gap-3 border-t border-slate-200">
                  <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 rounded-xl border-2 border-slate-200 py-4 text-base font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
                  <button type="submit" className="flex-1 rounded-xl bg-amber-500 py-4 text-base font-bold text-white hover:bg-amber-600 shadow-md transition">💾 บันทึกการแก้ไข</button>
                </div>
              </div>

              <div className="flex flex-col h-[450px] lg:h-auto space-y-3">
                
                {isRoadWork && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-sm font-bold text-slate-700">โหมด:</span>
                      <div className="flex bg-slate-100 p-1 rounded-md">
                        <button type="button" onClick={() => setDrawMode(false)} className={`px-3 py-1.5 text-xs font-bold rounded transition ${!drawMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>ตามถนน</button>
                        <button type="button" onClick={() => setDrawMode(true)} className={`px-3 py-1.5 text-xs font-bold rounded transition ${drawMode ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>วาดเอง</button>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <button type="button" onClick={() => setPicking('start')} className={`text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดเริ่มต้น</button>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="any" placeholder="Lat" value={editStartLat} onChange={(e) => { setEditStartLat(e.target.value); applyCoords('start', e.target.value, editStartLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-emerald-500" />
                        <input type="number" step="any" placeholder="Lng" value={editStartLng} onChange={(e) => { setEditStartLng(e.target.value); applyCoords('start', editStartLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-emerald-500" />
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <button type="button" onClick={() => setPicking('end')} className={`text-sm px-3 py-2 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดสิ้นสุด</button>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="any" placeholder="Lat" value={editEndLat} onChange={(e) => { setEditEndLat(e.target.value); applyCoords('end', e.target.value, editEndLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-red-500" />
                        <input type="number" step="any" placeholder="Lng" value={editEndLng} onChange={(e) => { setEditEndLng(e.target.value); applyCoords('end', editEndLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-red-500" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPicking('waypoint')} className={`flex-1 text-xs px-2 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'waypoint' ? 'bg-amber-500 text-white ring-2 ring-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                        {editWaypoints.length > 0 ? '📍 เพิ่มจุดผ่าน' : '📍 เพิ่มจุดผ่าน'}
                      </button>
                      
                      {(editStart || editEnd || editWaypoints.length > 0) && (
                        <button type="button" onClick={handleClearAllPoints} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold hover:bg-red-200 transition shadow-sm border border-red-200 text-xs">
                          🗑️ ล้างจุด
                        </button>
                      )}
                    </div>
                    {picking === 'waypoint' && <p className="text-[10px] text-amber-600 font-bold text-center animate-pulse">* คลิกแผนที่เพื่อเพิ่มจุดผ่าน</p>}
                  </div>
                )}

                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 relative min-h-[300px]">
                  <MapPicker
                    mode={isRoadWork ? 'double' : 'single'}
                    start={isRoadWork ? editStart : editLocation}
                    end={editEnd}
                    waypoints={editWaypoints}
                    drawMode={drawMode}
                    onPick={handleMapPick}
                    onDrag={(which, p) => { 
                      if (which === 'start') { 
                        setEditStart(p); setEditStartLat(p.lat.toString()); setEditStartLng(p.lng.toString()); 
                      } else { 
                        setEditEnd(p); setEditEndLat(p.lat.toString()); setEditEndLng(p.lng.toString()); 
                      } 
                    }}
                    onWaypointDrag={(idx, p) => {
                      const newWp = [...editWaypoints]; newWp[idx] = p; setEditWaypoints(newWp);
                    }}
                    onWaypointDelete={(idx) => {
                      setEditWaypoints(editWaypoints.filter((_, i) => i !== idx));
                    }}
                    onClearStart={() => { setEditStart(null); setEditStartLat(''); setEditStartLng(''); }}
                    onClearEnd={() => { setEditEnd(null); setEditEndLat(''); setEditEndLng(''); }}
                    onClearLocation={() => setEditLocation(null)}
                    onRouteUpdate={(route) => setEditRoutePath(route)}
                    roadName={editingPlan.plan_name}
                    distanceKm={editDistance ? editDistance / 1000 : null}
                    fullHeight
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}