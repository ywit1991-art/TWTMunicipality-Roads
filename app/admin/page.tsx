'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { getRoadDistance, LatLng } from '@/lib/osrm';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

export default function AdminPage() {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState<LatLng | null>(null);
  const [end, setEnd] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [savedRoad, setSavedRoad] = useState<{ name: string; distance: number } | null>(null);

  function handlePick(p: LatLng) {
    if (picking === 'start') {
      setStart(p);
      setPicking('end');
    } else {
      setEnd(p);
    }
    setDistance(null);
  }

  function handleDrag(which: 'start' | 'end', p: LatLng) {
    if (which === 'start') setStart(p);
    else setEnd(p);
    setDistance(null);
    setMessage('');
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

      const { error } = await supabase.from('roads').insert({
        name,
        note,
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        distance_m: dist,
      });

      if (error) throw error;
      setMessage('✅ บันทึกสำเร็จ!');
      setSavedRoad({ name, distance: dist });
      setName('');
      setNote('');
      setPicking('start');
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStart(null);
    setEnd(null);
    setDistance(null);
    setSavedRoad(null);
    setPicking('start');
    setMessage('');
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">🛣️ ระบบจัดการข้อมูลถนน</h1>
          <p className="mt-1 text-sm opacity-90">
            คลิกบนแผนที่เพื่อเลือกจุดเริ่มต้น → จุดสิ้นสุด แล้วคำนวณระยะทาง
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
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

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>กำลังเลือก:</span>
                <span className="font-semibold text-blue-600">
                  {picking === 'start' ? 'จุดเริ่มต้น' : 'จุดสิ้นสุด'}
                </span>
              </div>
              {start && (
                <div className="mt-1 text-slate-600">
                  🟢 Start: {start.lat.toFixed(5)}, {start.lng.toFixed(5)}
                </div>
              )}
              {end && (
                <div className="text-slate-600">
                  🔴 End: {end.lat.toFixed(5)}, {end.lng.toFixed(5)}
                </div>
              )}
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
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                💾 บันทึก
              </button>
            </div>

            {savedRoad && (
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
          </div>

          <div className="overflow-hidden rounded-2xl shadow">
            <MapPicker
              start={start}
              end={end}
              onPick={handlePick}
              onDrag={handleDrag}
              roadName={savedRoad?.name ?? name}
              distanceKm={distance ? distance / 1000 : savedRoad?.distance ? savedRoad.distance / 1000 : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}