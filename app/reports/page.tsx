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
    <div className="min-h-screen pb-20 bg-slate-50/50 font-sans">
      
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">รายงานผลการสำรวจ</h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">เทศบาลตำบลท่าวังทอง (พย.11)</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden md:inline">กลับหน้าสำรวจ</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl mt-6 px-4 space-y-6 md:space-y-8">
        
        <div className="bg-white p-2 md:p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="ค้นหาชื่อแผน..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl border-none bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition" />
          </div>
          <select value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)} className="rounded-xl border-none bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
            <option value="ทั้งหมด">🏘️ ทุกหมู่บ้าน</option>
            {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-xl border-none bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer">
            <option value="ทั้งหมด">🛠️ ทุกประเภทงาน</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilter && (
            <button onClick={clearFilters} className="rounded-xl bg-red-50 text-red-600 px-5 py-3 text-sm font-bold hover:bg-red-100 transition whitespace-nowrap">✕ ล้างค่า</button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-6">
          <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 md:p-6 text-white shadow-lg transition hover:shadow-xl hover:-translate-y-1">
            <div className="absolute -right-6 -top-6 opacity-20 transition group-hover:scale-110 group-hover:rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 md:h-32 md:w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <div className="relative z-10">
              <div className="text-xs md:text-sm font-semibold text-blue-100 mb-1">แผนที่พบ</div>
              <div className="text-3xl md:text-5xl font-black">{filteredPlans.length}</div>
              <div className="text-[10px] md:text-sm font-medium text-blue-100 mt-1">รายการ</div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 md:p-6 text-white shadow-lg transition hover:shadow-xl hover:-translate-y-1">
            <div className="absolute -right-6 -top-6 opacity-20 transition group-hover:scale-110 group-hover:rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 md:h-32 md:w-32" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            </div>
            <div className="relative z-10">
              <div className="text-xs md:text-sm font-semibold text-emerald-100 mb-1">พร้อมดำเนินการ</div>
              <div className="text-3xl md:text-5xl font-black">{filteredPlans.filter(p => p.readiness === 'พร้อม').length}</div>
              <div className="text-[10px] md:text-sm font-medium text-emerald-100 mt-1">รายการ</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-red-500 to-red-700 p-4 md:p-6 text-white shadow-lg transition hover:shadow-xl hover:-translate-y-1">
            <div className="absolute -right-6 -top-6 opacity-20 transition group-hover:scale-110 group-hover:rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 md:h-32 md:w-32" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            </div>
            <div className="relative z-10">
              <div className="text-xs md:text-sm font-semibold text-red-100 mb-1">ไม่พร้อมดำเนินการ</div>
              <div className="text-3xl md:text-5xl font-black">{filteredPlans.filter(p => p.readiness === 'ไม่พร้อม').length}</div>
              <div className="text-[10px] md:text-sm font-medium text-red-100 mt-1">รายการ</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-2 md:p-4 shadow-sm border border-slate-200">
          <div className="p-2 md:p-0 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </span>
            <h2 className="text-base md:text-lg font-bold text-slate-800">แผนที่รวมทุกเส้นทาง</h2>
          </div>
          <div className="rounded-2xl overflow-hidden h-[400px] md:h-[600px] relative z-0">
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
              <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </span>
              <h2 className="text-base md:text-lg font-bold text-slate-800">รายการสำรวจ</h2>
            </div>
            <span className="text-xs md:text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">พบ {filteredPlans.length} รายการ</span>
          </div>
          
          {loading ? (
            <div className="p-10 text-center text-slate-400 font-medium">กำลังโหลด...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-medium">ไม่พบข้อมูล</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">หมู่บ้าน</th>
                      <th className="px-6 py-4">ชื่อแผน / ประเภท</th>
                      <th className="px-6 py-4 text-center">ระยะทาง (กม.)</th>
                      <th className="px-6 py-4 text-center">ความกว้าง (ม.)</th>
                      <th className="px-6 py-4 text-center">ความพร้อม</th>
                      <th className="px-6 py-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlans.map((plan, index) => (
                      <tr key={plan.id} className={`transition-colors hover:bg-blue-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                        <td className="px-6 py-4 font-black text-slate-700">{plan.village}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 text-base mb-1">{plan.plan_name}</div>
                          <div className="text-xs font-bold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded-md border border-slate-200">{plan.plan_type}</div>
                          {plan.problem && <div className="text-xs text-red-600 mt-1.5 max-w-[200px] truncate font-bold bg-red-50 px-2 py-1 rounded-md border border-red-100" title={plan.problem}>⚠️ {plan.problem}</div>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                            {plan.distance_m ? (plan.distance_m / 1000).toFixed(3) : '0.000'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600">
                          {plan.width ? plan.width : '-'}
                        </td>
                        
                        {/* ⭐ ปุ่มความพร้อม (แก้ให้เป็น Outline เหมือนปุ่มแก้ไข) */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow-sm border transition ${
                            plan.readiness === 'พร้อม' 
                              ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' 
                              : 'text-red-600 border-red-200 hover:bg-red-50'
                          }`}>
                            {plan.readiness === 'พร้อม' ? (
                              <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> พร้อม</>
                            ) : (
                              <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> ไม่พร้อม</>
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => requestAuth('edit', plan)} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 shadow-sm transition">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              แก้ไข
                            </button>
                            <button onClick={() => requestAuth('delete', plan)} className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 shadow-sm transition">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50/50">
                {filteredPlans.map((plan) => (
                  <div key={plan.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <div className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mb-1 border border-blue-100">{plan.village}</div>
                        <div className="font-bold text-slate-800 text-base leading-tight">{plan.plan_name}</div>
                      </div>
                      
                      {/* ⭐ ปุ่มความพร้อมบนมือถือ (Outline) */}
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold shadow-sm border ${
                        plan.readiness === 'พร้อม' 
                          ? 'text-emerald-600 border-emerald-200' 
                          : 'text-red-600 border-red-200'
                      }`}>
                        {plan.readiness === 'พร้อม' ? '✅ พร้อม' : '❌ ไม่พร้อม'}
                      </span>
                    </div>
                    
                    <div className="text-[11px] font-bold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded border border-slate-200 mb-3">{plan.plan_type}</div>
                    
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">ระยะทาง</div>
                        <div className="text-sm font-black text-blue-600 font-mono">{plan.distance_m ? `${(plan.distance_m / 1000).toFixed(3)} กม.` : '0.000 กม.'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">ความกว้าง</div>
                        <div className="text-sm font-bold text-slate-700">{plan.width ? `${plan.width} ม.` : '-'}</div>
                      </div>
                      {plan.problem && (
                        <div className="col-span-2 text-xs text-red-600 font-bold mt-1 bg-red-50 p-2 rounded border border-red-100">
                          ⚠️ {plan.problem}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => requestAuth('edit', plan)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 py-2.5 text-xs font-bold text-amber-600 border border-amber-200 active:bg-amber-100 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        แก้ไข
                      </button>
                      <button onClick={() => requestAuth('delete', plan)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5 text-xs font-bold text-red-600 border border-red-200 active:bg-red-100 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        ลบ
                      </button>
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
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl shadow-inner text-amber-500">🔒</div>
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
            
            <div className="mt-4 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
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
            <p className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl mb-6 w-full border border-red-100">
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlan({...editingPlan, readiness: 'พร้อม'})}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition border shadow-sm ${
                        editingPlan.readiness === 'พร้อม'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ✅ พร้อม
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPlan({...editingPlan, readiness: 'ไม่พร้อม'})}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition border shadow-sm ${
                        editingPlan.readiness === 'ไม่พร้อม'
                          ? 'bg-red-500 text-white border-red-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ❌ ไม่พร้อม
                    </button>
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
                    
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <button type="button" onClick={() => setPicking('start')} className={`text-sm px-3 py-1.5 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'start' ? 'bg-emerald-500 text-white ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดเริ่มต้น</button>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="any" placeholder="Lat" value={editStartLat} onChange={(e) => { setEditStartLat(e.target.value); applyCoords('start', e.target.value, editStartLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                        <input type="number" step="any" placeholder="Lng" value={editStartLng} onChange={(e) => { setEditStartLng(e.target.value); applyCoords('start', editStartLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <button type="button" onClick={() => setPicking('end')} className={`text-sm px-3 py-1.5 rounded-lg font-bold transition shadow-sm w-full mb-2 ${picking === 'end' ? 'bg-red-500 text-white ring-2 ring-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📍 เลือกจุดสิ้นสุด</button>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="any" placeholder="Lat" value={editEndLat} onChange={(e) => { setEditEndLat(e.target.value); applyCoords('end', e.target.value, editEndLng); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500" />
                        <input type="number" step="any" placeholder="Lng" value={editEndLng} onChange={(e) => { setEditEndLng(e.target.value); applyCoords('end', editEndLat, e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500" />
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

                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 relative">
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