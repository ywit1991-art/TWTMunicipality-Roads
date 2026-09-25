'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Road } from '@/components/RoadsMap';

const RoadsMap = dynamic(() => import('@/components/RoadsMap'), { ssr: false });

export default function HomePage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [filtered, setFiltered] = useState<Road[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusRoad, setFocusRoad] = useState<Road | null>(null);

  useEffect(() => {
    fetch('/api/roads')
      .then((r) => r.json())
      .then((d) => {
        setRoads(d.roads ?? []);
        setFiltered(d.roads ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(roads);
    } else {
      const result = roads.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      );
      setFiltered(result);
      // ถ้าค้นหาเหลือ 1 รายการ → auto-focus
      if (result.length === 1) {
        setFocusRoad(result[0]);
      }
    }
  }, [search, roads]);

  const totalDistance = roads.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 1000;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-10 text-white shadow-lg">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold md:text-4xl">🛣️ ระบบสารสนเทศถนน</h1>
          <p className="mt-2 text-blue-100">
            ข้อมูลถนนในเขตเทศบาล พร้อมพิกัดและระยะทางตามจริง
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">จำนวนถนนทั้งหมด</div>
            <div className="mt-1 text-3xl font-bold text-blue-600">{roads.length}</div>
            <div className="text-xs text-slate-400">สาย</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">ระยะทางรวม</div>
            <div className="mt-1 text-3xl font-bold text-emerald-600">
              {totalDistance.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400">กิโลเมตร</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">อัปเดตล่าสุด</div>
            <div className="mt-1 text-lg font-semibold text-slate-700">
              {roads[0]?.created_at
                ? new Date(roads[0].created_at).toLocaleDateString('th-TH', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-'}
            </div>
            <div className="text-xs text-slate-400">วันที่</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 ค้นหาชื่อถนน..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 outline-none focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>
          {focusRoad && (
            <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
              <span>📍 กำลังแสดง:</span>
              <span className="font-semibold">{focusRoad.name}</span>
              <button
                onClick={() => setFocusRoad(null)}
                className="ml-auto text-slate-400 hover:text-slate-700"
              >
                ล้างการโฟกัส
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold text-slate-700">
            🗺️ แผนที่เส้นทางทั้งหมด
          </h2>
          {loading ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              กำลังโหลด...
            </div>
          ) : roads.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              ยังไม่มีข้อมูลถนน
            </div>
          ) : (
            <RoadsMap roads={filtered} focusRoad={focusRoad} />
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-700">📋 รายการถนน</h2>
            <p className="text-sm text-slate-500">
              พบ {filtered.length} รายการ • คลิกแถวเพื่อดูบนแผนที่
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400">ไม่พบข้อมูล</div>
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((road, i) => {
                    const isFocused = focusRoad?.id === road.id;
                    return (
                      <tr
                        key={road.id}
                        onClick={() => setFocusRoad(road)}
                        className={`cursor-pointer border-b border-slate-100 transition ${
                          isFocused
                            ? 'bg-blue-100 ring-1 ring-blue-300'
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {road.name}
                          {isFocused && (
                            <span className="ml-2 text-xs text-blue-600">📍</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{road.note || '-'}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pb-10 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} ระบบสารสนเทศถนน • เทศบาล
        </div>
      </main>
    </div>
  );
}