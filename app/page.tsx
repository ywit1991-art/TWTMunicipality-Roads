'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Road } from '@/components/RoadsMap';

const RoadsMap = dynamic(() => import('@/components/RoadsMap'), { ssr: false });

export default function HomePage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [filtered, setFiltered] = useState<Road[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusRoad, setFocusRoad] = useState<Road | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);

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
      if (result.length === 1) setFocusRoad(result[0]);
    }
  }, [search, roads]);

  const totalDistance = roads.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 1000;
  const longestRoad = roads.reduce<Road | null>(
    (max, r) => (!max || (r.distance_m ?? 0) > (max.distance_m ?? 0) ? r : max),
    null
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 px-6 py-8 text-white shadow-lg">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="โลโก้เทศบาลตำบลท่าวังทอง"
              className="h-16 w-16 rounded-full bg-white p-1 shadow-lg md:h-20 md:w-20"
            />
            <div>
              <h1 className="text-xl font-bold md:text-2xl">
                ระบบสารสนเทศข้อมูลถนนท้องถิ่น
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-white md:text-base">
                เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา จังหวัดพะเยา (พย.11)
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#map"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-blue-700 shadow transition hover:scale-105"
            >
              🗺️ ดูแผนที่
            </a>
            <Link
              href="/login"
              className="rounded-full border border-white/60 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              ⚙️ สำหรับเจ้าหน้าที่
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-md transition hover:shadow-xl">
            <div className="absolute -right-4 -top-4 text-7xl opacity-20 transition group-hover:scale-110">
              🛣️
            </div>
            <div className="relative">
              <div className="text-xs opacity-90">จำนวนถนนทั้งหมด</div>
              <div className="mt-1 text-4xl font-bold">{roads.length}</div>
              <div className="text-xs opacity-90">สาย</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-md transition hover:shadow-xl">
            <div className="absolute -right-4 -top-4 text-7xl opacity-20 transition group-hover:scale-110">
              📏
            </div>
            <div className="relative">
              <div className="text-xs opacity-90">ระยะทางรวม</div>
              <div className="mt-1 text-4xl font-bold">
                {totalDistance.toFixed(2)}
              </div>
              <div className="text-xs opacity-90">กิโลเมตร</div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-md transition hover:shadow-xl">
            <div className="absolute -right-4 -top-4 text-7xl opacity-20 transition group-hover:scale-110">
              🏆
            </div>
            <div className="relative">
              <div className="text-xs opacity-90">ถนนที่ยาวที่สุด</div>
              <div className="mt-1 truncate text-xl font-bold">
                {longestRoad?.name ?? '-'}
              </div>
              <div className="text-xs opacity-90">
                {longestRoad?.distance_m
                  ? `${(longestRoad.distance_m / 1000).toFixed(2)} กม.`
                  : 'ไม่มีข้อมูล'}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อถนน..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-10 outline-none transition focus:border-blue-500 focus:bg-white"
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
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
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

        {/* Map */}
        <div id="map" className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
            🗺️ แผนที่เส้นทางทั้งหมด
          </h2>
          {loading ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                กำลังโหลด...
              </div>
            </div>
          ) : roads.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              ยังไม่มีข้อมูลถนน
            </div>
          ) : (
            <RoadsMap roads={filtered} focusRoad={focusRoad} />
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-700">
                📋 รายการถนน
              </h2>
              <p className="text-sm text-slate-500">
                พบ {filtered.length} รายการ • คลิกเพื่อดูรายละเอียด
              </p>
            </div>
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
                    const isSelected = selectedRoad?.id === road.id;
                    return (
                      <tr
                        key={road.id}
                        onClick={() => setSelectedRoad(road)}
                        className={`cursor-pointer border-b border-slate-100 transition ${
                          isSelected ? 'bg-blue-100' : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {road.name}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="pb-10 pt-6 text-center text-sm text-slate-400">
          <p>
            © {new Date().getFullYear()} เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา
            จังหวัดพะเยา (พย.11)
          </p>
          <p className="mt-1 text-xs">Powered by Next.js • Supabase • Vercel</p>
        </footer>
      </main>

      {/* Popup รายละเอียด — มุมล่างขวา ไม่ทับแผนที่ */}
      {selectedRoad && (
        <div className="fixed bottom-4 right-4 z-50 w-[340px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 md:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white">
            <h3 className="truncate text-base font-bold">
              🛣️ {selectedRoad.name}
            </h3>
            <button
              onClick={() => setSelectedRoad(null)}
              className="rounded-full bg-white/20 p-1 text-sm hover:bg-white/30"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="space-y-2 p-4 text-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-100 p-2.5">
                <div className="text-xs text-slate-500">ระยะทาง</div>
                <div className="text-base font-bold text-blue-600">
                  {selectedRoad.distance_m
                    ? `${(selectedRoad.distance_m / 1000).toFixed(3)} กม.`
                    : '-'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-100 p-2.5">
                <div className="text-xs text-slate-500">วันที่</div>
                <div className="text-sm font-bold">
                  {new Date(selectedRoad.created_at).toLocaleDateString('th-TH')}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 p-2.5">
              <div className="text-xs text-slate-500">พิกัดเริ่มต้น</div>
              <div className="font-mono text-xs">
                🟢 {selectedRoad.start_lat.toFixed(6)},{' '}
                {selectedRoad.start_lng.toFixed(6)}
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 p-2.5">
              <div className="text-xs text-slate-500">พิกัดสิ้นสุด</div>
              <div className="font-mono text-xs">
                🔴 {selectedRoad.end_lat.toFixed(6)},{' '}
                {selectedRoad.end_lng.toFixed(6)}
              </div>
            </div>

            {selectedRoad.note && (
              <div className="rounded-lg bg-slate-100 p-2.5">
                <div className="text-xs text-slate-500">หมายเหตุ</div>
                <div className="text-sm">{selectedRoad.note}</div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${selectedRoad.start_lat},${selectedRoad.start_lng}&destination=${selectedRoad.end_lat},${selectedRoad.end_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-blue-700"
              >
                🧭 Google Maps
              </a>
              <button
                onClick={() => {
                  setFocusRoad(selectedRoad);
                  setSelectedRoad(null);
                  setTimeout(() => {
                    document
                      .getElementById('map')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium transition hover:bg-slate-100"
              >
                🗺️ ดูแผนที่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}