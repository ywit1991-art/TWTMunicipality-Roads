'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRoadDistance, LatLng } from '@/lib/osrm';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

type Road = {
  id: number;
  name: string;
  note: string | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance_m: number | null;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [savedRoad, setSavedRoad] = useState<{ name: string; distance: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');

  const [roads, setRoads] = useState<Road[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // ตรวจสอบ login + โหลดข้อมูล
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
        return;
      }
      setCheckingAuth(false);
      loadRoads();
    }
    init();
  }, [router]);

  async function loadRoads() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('roads')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setRoads(data ?? []);
    setLoadingList(false);
  }

  async function handleLogout() {
    if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  }

  function syncInputs(s: LatLng | null, e: LatLng | null) {
    setStartLat(s ? String(s.lat) : '');
    setStartLng(s ? String(s.lng) : '');
    setEndLat(e ? String(e.lat) : '');
    setEndLng(e ? String(e.lng) : '');
  }

  function handlePick(p: LatLng) {
    if (picking === 'start') {
      setStart(p);
      setStartLat(String(p.lat));
      setStartLng(String(p.lng));
      setPicking('end');
    } else {
      setEnd(p);
      setEndLat(String(p.lat));
      setEndLng(String(p.lng));
    }
    setDistance(null);
  }

  function handleDrag(which: 'start' | 'end', p: LatLng) {
    if (which === 'start') {
      setStart(p);
      setStartLat(String(p.lat));
      setStartLng(String(p.lng));
    } else {
      setEnd(p);
      setEndLat(String(p.lat));
      setEndLng(String(p.lng));
    }
    setDistance(null);
    setMessage('');
  }

  function applyStartFromInput() {
    const lat = parseFloat(startLat);
    const lng = parseFloat(startLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setStart({ lat, lng });
    setDistance(null);
  }

  function applyEndFromInput() {
    const lat = parseFloat(endLat);
    const lng = parseFloat(endLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setEnd({ lat, lng });
    setDistance(null);
  }

  async function handleCalculate() {
    if (!start || !end) return alert('กรุณาเลือกจุดเริ่มต้นและสิ้นสุด');
    setLoading(true);
    try {
      const r = await getRoadDistance(start, end);
      setDistance(r.distance_m);
      setMessage(`ระยะทางตามถนน: ${(r.distance_m / 1000).toFixed(3)} กม.`);
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name || !start || !end) return alert('กรอกข้อมูลให้ครบก่อน');
    setLoading(true);
    try {
      let dist = distance;
      if (dist === null) {
        const r = await getRoadDistance(start, end);
        dist = r.distance_m;
      }

      const payload = {
        name,
        note,
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        distance_m: dist,
      };

      if (editingId) {
        const { error } = await supabase
          .from('roads')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        setMessage('✅ แก้ไขสำเร็จ!');
        setEditingId(null);
      } else {
        const { error } = await supabase.from('roads').insert(payload);
        if (error) throw error;
        setMessage('✅ บันทึกสำเร็จ!');
        setSavedRoad({ name, distance: dist });
      }

      setName('');
      setNote('');
      setPicking('start');
      setStart(null);
      setEnd(null);
      setDistance(null);
      syncInputs(null, null);
      await loadRoads();
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, roadName: string) {
    if (!confirm(`ยืนยันลบถนน "${roadName}" หรือไม่?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('roads').delete().eq('id', id);
      if (error) throw error;
      setMessage('🗑️ ลบสำเร็จ!');
      await loadRoads();
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(road: Road) {
    const s = { lat: road.start_lat, lng: road.start_lng };
    const e = { lat: road.end_lat, lng: road.end_lng };
    setName(road.name);
    setNote(road.note ?? '');
    setStart(s);
    setEnd(e);
    syncInputs(s, e);
    setDistance(road.distance_m);
    setEditingId(road.id);
    setSavedRoad(null);
    setPicking('start');
    setMessage(`✏️ กำลังแก้ไข: ${road.name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setNote('');
    setStart(null);
    setEnd(null);
    setDistance(null);
    syncInputs(null, null);
    setPicking('start');
    setMessage('');
  }

  function resetAll() {
    setStart(null);
    setEnd(null);
    setDistance(null);
    setSavedRoad(null);
    setPicking('start');
    setMessage('');
    setEditingId(null);
    setName('');
    setNote('');
    syncInputs(null, null);
  }

  // หน้าจอโหลดตอนตรวจสอบ auth
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-3 text-slate-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <img
              src="/logo.png"
              alt="โลโก้เทศบาล"
              className="h-16 w-16 rounded-full bg-white p-1 shadow-md"
            />
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-xl font-bold md:text-2xl">
                ระบบจัดการข้อมูลถนนท้องถิ่น
              </h1>
              <p className="mt-0.5 text-sm font-semibold">
                เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา จังหวัดพะเยา (พย.11)
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/30"
            >
              🚪 ออกจากระบบ
            </button>
          </div>
        </header>

        {/* Alert กำลังแก้ไข */}
        {editingId && (
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-amber-800">
                  ✏️ กำลังแก้ไขข้อมูล (ID: {editingId})
                </div>
                <div className="text-sm text-amber-700">
                  แก้ไขข้อมูลแล้วกด "บันทึก" หรือกด "ยกเลิก" เพื่อกลับ
                </div>
              </div>
              <button
                onClick={cancelEdit}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Grid หลัก */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* ฟอร์ม */}
          <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
            <div>
              <label className="mb-1 block text-sm font-medium">ชื่อถนน</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ถนนสุขุมวิท"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">หมายเหตุ</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="(ไม่บังคับ)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>

            {/* พิกัดเริ่มต้น */}
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-600">
                  🟢 จุดเริ่มต้น
                </span>
                <button
                  type="button"
                  onClick={() => setPicking('start')}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    picking === 'start'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  เลือกบนแผนที่
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={startLat}
                  onChange={(e) => setStartLat(e.target.value)}
                  onBlur={applyStartFromInput}
                  placeholder="ละติจูด (Lat)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <input
                  value={startLng}
                  onChange={(e) => setStartLng(e.target.value)}
                  onBlur={applyStartFromInput}
                  placeholder="ลองจิจูด (Lng)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* พิกัดสิ้นสุด */}
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-red-500">
                  🔴 จุดสิ้นสุด
                </span>
                <button
                  type="button"
                  onClick={() => setPicking('end')}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    picking === 'end'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  เลือกบนแผนที่
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={endLat}
                  onChange={(e) => setEndLat(e.target.value)}
                  onBlur={applyEndFromInput}
                  placeholder="ละติจูด (Lat)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                />
                <input
                  value={endLng}
                  onChange={(e) => setEndLng(e.target.value)}
                  onBlur={applyEndFromInput}
                  placeholder="ลองจิจูด (Lng)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>กำลังเลือกบนแผนที่:</span>
                <span className="font-semibold text-blue-600">
                  {picking === 'start' ? 'จุดเริ่มต้น' : 'จุดสิ้นสุด'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCalculate}
                disabled={loading || !start || !end}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                📏 คำนวณระยะทาง
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !name || !start || !end}
                className={`flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50 ${
                  editingId
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {editingId ? '💾 บันทึกการแก้ไข' : '💾 บันทึก'}
              </button>
            </div>

            {savedRoad && !editingId && (
              <button
                onClick={resetAll}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                ➕ เพิ่มถนนเส้นใหม่
              </button>
            )}

            <button
              onClick={resetAll}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              🔄 ล้างค่า
            </button>

            {message && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                {message}
              </div>
            )}

            <a
              href="/"
              className="block w-full rounded-lg border border-slate-300 px-4 py-2 text-center text-sm hover:bg-slate-50"
            >
              🏠 กลับหน้าแรก
            </a>
          </div>

          {/* แผนที่ */}
          <div className="overflow-hidden rounded-2xl shadow lg:h-full lg:min-h-[700px]">
            <MapPicker
              start={start}
              end={end}
              onPick={handlePick}
              onDrag={handleDrag}
              roadName={editingId ? name : savedRoad?.name ?? name}
              distanceKm={
                distance
                  ? distance / 1000
                  : savedRoad?.distance
                    ? savedRoad.distance / 1000
                    : null
              }
              fullHeight
            />
          </div>
        </div>

        {/* ตารางรายการถนน */}
        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-700">
                📋 รายการถนนที่บันทึกแล้ว
              </h2>
              <p className="text-sm text-slate-500">
                ทั้งหมด {roads.length} รายการ
              </p>
            </div>
          </div>

          {loadingList ? (
            <div className="p-10 text-center text-slate-400">กำลังโหลด...</div>
          ) : roads.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              ยังไม่มีข้อมูล — เพิ่มถนนเส้นแรกเลย!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">ชื่อถนน</th>
                    <th className="px-4 py-3 text-left">หมายเหตุ</th>
                    <th className="px-4 py-3 text-right">ระยะทาง</th>
                    <th className="px-4 py-3 text-right">วันที่</th>
                    <th className="px-4 py-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {roads.map((road, i) => (
                    <tr
                      key={road.id}
                      className={`border-b border-slate-100 ${
                        editingId === road.id
                          ? 'bg-amber-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {road.name}
                        {editingId === road.id && (
                          <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-800">
                            กำลังแก้ไข
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {road.note || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {road.distance_m != null
                          ? `${(road.distance_m / 1000).toFixed(3)} กม.`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {new Date(road.created_at).toLocaleDateString('th-TH', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleEdit(road)}
                            disabled={loading}
                            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => handleDelete(road.id, road.name)}
                            disabled={loading}
                            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}