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
  loading: () => <div className="flex h-[300px] md:h-[600px] w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-400">กำลังโหลดแผนที่...</div>
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

  const [editStart, setEditStart] = useState<LatLng | null>(null);
  const [editEnd, setEditEnd] = useState<LatLng | null>(null);
  const [editWaypoints, setEditWaypoints] = useState<LatLng[]>([]); 
  const [editRoutePath, setEditRoutePath] = useState<[number, number][]>([]); 
  const [drawMode, setDrawMode] = useState(false); 
  const [picking, setPicking] = useState<'start' | 'end' | 'waypoint'>('start');

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
    return matchSearch && matchVillage && matchType;
  });

  const clearFilters = () => { setSearchQuery(''); setFilterVillage('ทั้งหมด'); setFilterType('ทั้งหมด'); };
  const hasFilter = searchQuery !== '' || filterVillage !== 'ทั้งหมด' || filterType !== 'ทั้งหมด';

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
    setEditingPlan(plan);
    setEditStart(plan.start_lat && plan.start_lng ? { lat: plan.start_lat, lng: plan.start_lng } : null);
    setEditEnd(plan.end_lat && plan.end_lng ? { lat: plan.end_lat, lng: plan.end_lng } : null);
    setEditLocation(plan.location_lat && plan.location_lng ? { lat: plan.location_lat, lng: plan.location_lng } : null);
    setEditDistance(plan.distance_m); 
    
    setEditWaypoints(plan.waypoints || []);
    setEditRoutePath(plan.route_path || []);
    
    // ⭐ ถ้าเคยมีจุดผ่าน ให้เปิดโหมดวาดเองอัตโนมัติ เพื่อไม่ให้โดน OSRM ทับ
    if (plan.waypoints && plan.waypoints.length > 0) {
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
        setPicking('end'); 
      }
      else if (picking === 'waypoint') { 
        setEditWaypoints([...editWaypoints, p]); 
        if (!drawMode) setDrawMode(true); 
      }
      else { 
        setEditEnd(p); 
      }
    } else { 
      setEditLocation(p); 
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    const isRoad = ROAD_WORK_TYPES.includes(editingPlan.plan_type);

    let finalRoutePath = editRoutePath;
    if (isRoad) {
      if (drawMode) {
        // ⭐ ถ้าเป็นโหมดวาดเอง ให้บันทึกเส้นตรงตามจุดที่ปักไว้
        const points = [editStart, ...editWaypoints, editEnd].filter(p => p !== null) as LatLng[];
        finalRoutePath = points.map(p => [p.lat, p.lng]);
      } else if (editStart && editEnd) {
        // ⭐ ถ้าเป็นโหมดตามถนน ให้ดึง OSRM
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
        problem: editingPlan.problem, 
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
    <div className="min-h-screen pb-10 bg-slate-100/50">
      
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-800 to-indigo-900 px-3 py-3 md:px-6 md:py-5 text-white shadow-lg z-10 relative">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-2xl md:text-3xl bg-white/20 p-1.5 md:p-2 rounded-xl backdrop-blur-sm shrink-0">📊</span>
            <div>
              <h1 className="text-base md:text-2xl font-black tracking-tight leading-tight">
                รายงานผลการสำรวจ
              </h1>
              <p className="text-blue-200 mt-0.5 text-[10px] md:text-sm font-medium leading-tight">
                เทศบาลตำบลท่าวังทอง (พย.11)
              </p>
            </div>
          </div>
          <Link href="/" className="shrink-0 rounded-xl bg-white/10 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-bold hover:bg-white/20 transition shadow-sm border border-white/10 backdrop-blur-sm flex items-center gap-1.5 md:gap-2">
            <span>⬅️</span> <span className="hidden md:inline">กลับหน้าสำรวจ</span><span className="md:hidden">กลับ</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl mt-4 md:mt-8 px-3 md:px-4 space-y-4 md:space-y-8">
        
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input type="text" placeholder="ค้นหาชื่อแผน..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border-none bg-slate-50 py-2.5 md:py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
          </div>
          <select value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)} className="rounded-xl border-none bg-slate-50 px-4 py-2.5 md:py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
            <option value="ทั้งหมด">🏘️ ทุกหมู่บ้าน</option>
            {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-xl border-none bg-slate-50 px-4 py-2.5 md:py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
            <option value="ทั้งหมด">🛠️ ทุกประเภทงาน</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilter && (
            <button onClick={clearFilters} className="rounded-xl bg-red-50 text-red-600 px-5 py-2.5 md:py-3 text-sm font-bold hover:bg-red-100 transition whitespace-nowrap">✕ ล้างค่า</button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-5">
          <div className="group relative overflow-hidden rounded-2xl bg-white p-3 md:p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:-translate-y-1">
            <div className="hidden md:block absolute -right-4 -top-4 text-blue-500/10 text-8xl transition group-hover:scale-110 group-hover:rotate-12">📋</div>
            <div className="relative">
              <div className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 text-[10px] md:text-sm font-bold text-slate-500 mb-1 md:mb-2 text-center md:text-left">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 hidden md:block"></span> แผนที่พบ
              </div>
              <div className="text-2xl md:text-5xl font-black text-slate-800 text-center md:text-left">{filteredPlans.length} <span className="text-[10px] md:text-lg font-bold text-slate-400 block md:inline">รายการ</span></div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl bg-white p-3 md:p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:-translate-y-1">
            <div className="hidden md:block absolute -right-4 -top-4 text-emerald-500/10 text-8xl transition group-hover:scale-110 group-hover:rotate-12">✅</div>
            <div className="relative">
              <div className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 text-[10px] md:text-sm font-bold text-slate-500 mb-1 md:mb-2 text-center md:text-left">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 hidden md:block"></span> พร้อมดำเนินการ
              </div>
              <div className="text-2xl md:text-5xl font-black text-emerald-600 text-center md:text-left">{filteredPlans.filter(p => p.readiness === 'พร้อม').length} <span className="text-[10px] md:text-lg font-bold text-slate-400 block md:inline">รายการ</span></div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-white p-3 md:p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:-translate-y-1">
            <div className="hidden md:block absolute -right-4 -top-4 text-red-500/10 text-8xl transition group-hover:scale-110 group-hover:rotate-12">❌</div>
            <div className="relative">
              <div className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 text-[10px] md:text-sm font-bold text-slate-500 mb-1 md:mb-2 text-center md:text-left">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 hidden md:block"></span> ไม่พร้อมดำเนินการ
              </div>
              <div className="text-2xl md:text-5xl font-black text-red-600 text-center md:text-left">{filteredPlans.filter(p => p.readiness === 'ไม่พร้อม').length} <span className="text-[10px] md:text-lg font-bold text-slate-400 block md:inline">รายการ</span></div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-2 shadow-sm border border-slate-200">
          <div className="p-3 md:p-4 flex items-center gap-2">
            <span className="text-xl md:text-2xl">🗺️</span>
            <h2 className="text-base md:text-lg font-bold text-slate-800">แผนที่รวมทุกเส้นทาง</h2>
          </div>
          <div className="rounded-2xl overflow-hidden h-[300px] md:h-[600px]">
            {loading ? (
              <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400 font-medium">กำลังโหลดข้อมูล...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400 font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
            ) : (
              <ReportsMap plans={filteredPlans} />
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl">📋</span>
              <h2 className="text-base md:text-lg font-bold text-slate-800">รายการสำรวจ</h2>
            </div>
            <span className="text-xs md:text-sm font-bold text-blue-600 bg-blue-50 px-2 md:px-3 py-1 rounded-lg">พบ {filteredPlans.length} รายการ</span>
          </div>
          
          {loading ? (
            <div className="p-10 text-center text-slate-400 font-medium">กำลังโหลด...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-medium">ไม่พบข้อมูล</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4">หมู่บ้าน</th>
                      <th className="px-6 py-4">ชื่อแผน / ประเภท</th>
                      <th className="px-6 py-4">ความพร้อม</th>
                      <th className="px-6 py-4">รายละเอียด</th>
                      <th className="px-6 py-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlans.map((plan, index) => (
                      <tr key={plan.id} className={`transition-colors hover:bg-blue-50/50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-6 py-4 font-black text-slate-700">{plan.village}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 text-base mb-1">{plan.plan_name}</div>
                          <div className="text-xs font-bold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md border border-slate-200">{plan.plan_type}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${plan.readiness === 'พร้อม' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                            {plan.readiness === 'พร้อม' ? '✅ พร้อม' : '❌ ไม่พร้อม'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {plan.distance_m ? (
                            <div className="text-slate-800 font-bold font-mono bg-slate-100 inline-block px-2 py-1 rounded-md border border-slate-200 mb-1">
                              {(plan.distance_m / 1000).toFixed(3)} กม.
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                          {plan.width && <div className="text-xs font-bold text-slate-500">กว้าง {plan.width} ม.</div>}
                          {plan.problem && <div className="text-xs text-red-600 mt-1 max-w-[200px] truncate font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100" title={plan.problem}>⚠️ {plan.problem}</div>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => requestAuth('edit', plan)} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 shadow-sm transition">✏️ แก้ไข</button>
                            <button onClick={() => requestAuth('delete', plan)} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 shadow-sm transition">🗑️ ลบ</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50">
                {filteredPlans.map((plan) => (
                  <div key={plan.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <div className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block mb-1">{plan.village}</div>
                        <div className="font-bold text-slate-800 text-sm leading-tight">{plan.plan_name}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${plan.readiness === 'พร้อม' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                        {plan.readiness === 'พร้อม' ? '✅ พร้อม' : '❌ ไม่พร้อม'}
                      </span>
                    </div>
                    
                    <div className="text-[11px] font-bold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded border border-slate-200 mb-3">{plan.plan_type}</div>
                    
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                      {plan.distance_m && (
                        <div className="text-xs text-slate-600 font-bold">
                          <span className="text-slate-400 font-medium">ระยะทาง:</span> <span className="font-mono text-slate-800">{(plan.distance_m / 1000).toFixed(3)} กม.</span>
                        </div>
                      )}
                      {plan.width && (
                        <div className="text-xs text-slate-600 font-bold">
                          <span className="text-slate-400 font-medium">กว้าง:</span> <span className="text-slate-800">{plan.width} ม.</span>
                        </div>
                      )}
                      {plan.problem && (
                        <div className="w-full text-xs text-red-600 font-bold mt-1">
                          ⚠️ {plan.problem}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => requestAuth('edit', plan)} className="flex-1 rounded-xl bg-amber-50 py-2 text-xs font-bold text-amber-600 border border-amber-200 active:bg-amber-100 transition">✏️ แก้ไข</button>
                      <button onClick={() => requestAuth('delete', plan)} className="flex-1 rounded-xl bg-red-50 py-2 text-xs font-bold text-red-600 border border-red-200 active:bg-red-100 transition">🗑️ ลบ</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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
            <div className="sticky top-0 z-20 flex items-center justify-between bg-amber-500 p-5 text-white">
              <h3 className="font-bold text-lg md:text-xl flex items-center gap-2">✏️ แก้ไขข้อมูลแผนและพิกัด</h3>
              <button onClick={() => setEditingPlan(null)} className="rounded-full bg-white/20 w-8 h-8 flex items-center justify-center hover:bg-white/30 transition font-bold">✕</button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">หมู่บ้าน</label>
                    <select value={editingPlan.village} onChange={(e) => setEditingPlan({...editingPlan, village: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition bg-slate-50">
                      {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อแผน</label>
                    <input type="text" value={editingPlan.plan_name} onChange={(e) => setEditingPlan({...editingPlan, plan_name: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ประเภทงาน</label>
                  <select value={editingPlan.plan_type} onChange={(e) => setEditingPlan({...editingPlan, plan_type: e.target.value})} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition bg-slate-50">
                    {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {isRoadWork && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">ความกว้าง (เมตร)</label>
                      <input type="number" step="0.01" value={editingPlan.width || ''} onChange={(e) => setEditingPlan({...editingPlan, width: e.target.value ? parseFloat(e.target.value) : null})} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">ระยะทาง (คำนวณใหม่)</label>
                      <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 font-bold text-blue-700">
                        {editDistance ? `${(editDistance / 1000).toFixed(3)} กม.` : '-'}
                      </div>
                    </div>
                  </div>
                )}

                {!isRoadWork && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">รายละเอียด</label>
                    <textarea value={editingPlan.details || ''} onChange={(e) => setEditingPlan({...editingPlan, details: e.target.value})} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500 transition" />
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <label className="mb-2 block text-sm font-bold text-slate-700">ความพร้อม</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <input type="radio" checked={editingPlan.readiness === 'พร้อม'} onChange={() => setEditingPlan({...editingPlan, readiness: 'พร้อม'})} className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-bold">✅ พร้อม</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <input type="radio" checked={editingPlan.readiness === 'ไม่พร้อม'} onChange={() => setEditingPlan({...editingPlan, readiness: 'ไม่พร้อม'})} className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-bold">❌ ไม่พร้อม</span>
                    </label>
                  </div>
                  {editingPlan.readiness === 'ไม่พร้อม' && (
                    <div className="mt-3">
                      <input type="text" value={editingPlan.problem || ''} onChange={(e) => setEditingPlan({...editingPlan, problem: e.target.value})} placeholder="ระบุปัญหาที่ไม่พร้อม..." className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm outline-none focus:border-red-500" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col h-[450px] lg:h-auto space-y-3">
                
                {isRoadWork && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-sm font-bold text-slate-700">โหมด:</span>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button type="button" onClick={() => setDrawMode(false)} className={`px-3 py-1 text-xs font-bold rounded-md transition ${!drawMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'}`}>ตามถนน</button>
                        <button type="button" onClick={() => setDrawMode(true)} className={`px-3 py-1 text-xs font-bold rounded-md transition ${drawMode ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>วาดเอง</button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPicking('start')} className={`flex-1 text-xs px-2 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 เริ่มต้น</button>
                      <button type="button" onClick={() => setPicking('end')} className={`flex-1 text-xs px-2 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>📍 สิ้นสุด</button>
                    </div>

                    <button type="button" onClick={() => setPicking('waypoint')} className={`w-full text-xs px-2 py-2 rounded-lg font-bold transition shadow-sm ${picking === 'waypoint' ? 'bg-amber-500 text-white ring-2 ring-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                      {editWaypoints.length > 0 ? '📍 คลิกเพิ่มจุดผ่านต่อ' : '📍 เพิ่มจุดผ่าน'}
                    </button>
                    {picking === 'waypoint' && <p className="text-[10px] text-amber-600 font-bold text-center animate-pulse">* คลิกแผนที่เพื่อเพิ่มจุดผ่าน</p>}
                  </div>
                )}

                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 relative">
                  <MapPicker
                    mode={isRoadWork ? 'double' : 'single'}
                    start={isRoadWork ? editStart : editLocation}
                    end={editEnd}
                    waypoints={editWaypoints}
                    drawMode={drawMode}
                    onPick={handleMapPick}
                    onDrag={(which, p) => { if (which === 'start') setEditStart(p); else setEditEnd(p); }}
                    onWaypointDrag={(idx, p) => {
                      const newWp = [...editWaypoints]; newWp[idx] = p; setEditWaypoints(newWp);
                    }}
                    onWaypointDelete={(idx) => {
                      setEditWaypoints(editWaypoints.filter((_, i) => i !== idx));
                    }}
                    onRouteUpdate={(route) => setEditRoutePath(route)}
                    roadName={editingPlan.plan_name}
                    distanceKm={editDistance ? editDistance / 1000 : null}
                    fullHeight
                  />
                </div>
              </div>

              <div className="col-span-1 lg:col-span-2 pt-4 flex gap-3 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">ยกเลิก</button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 shadow-md transition">💾 บันทึกการแก้ไข</button>
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
            <button onClick={() => setAlertInfo(null)} className={`w-full rounded-xl py-4 text-base font-bold text-white transition shadow-md ${alertInfo.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}