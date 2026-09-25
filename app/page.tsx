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
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // โหลดค่าธีมจาก localStorage
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') setDarkMode(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 px-6 py-16 text-white shadow-xl">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition hover:bg-white/30"
          title={darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        <div className="relative mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
            ระบบออนไลน์
          </div>
          <h1 className="mt-4 text-4xl font-bold drop-shadow-md md:text-6xl">
            🛣️ ระบบสารสนเทศถนน
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-blue-100 md:text-xl">
            ข้อมูลถนนในเขตเทศบาล พร้อมพิกัด GPS และระยะทางตามจริง
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#map"
              className="rounded-full bg-white px-6 py-2.5 font-semibold text-blue-700 shadow-lg transition hover:scale-105 hover:shadow-xl"
            >
              🗺️ ดูแผนที่
            </a>
            <a
              href="/admin"
              className="rounded-full border-2 border-white/60 bg-white/10 px-6 py-2.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              ⚙️ สำหรับเจ้าหน้าที่
            </a>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path
              d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 27.5C1200 25 1320 20 1380 17.5L1440 15V60H0Z"
              className="fill-slate-50 dark:fill-slate-900"
            />
          </svg>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1 */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg transition hover:shadow-2xl">
            <div className="absolute -right-6 -top-6 text-8xl opacity-20 transition group-hover:scale-110">
              🛣️
            </div>
            <div className="relative">
              <div className="text-sm opacity-90">จำนวนถนนทั้งหมด</div>
              <div className="mt-2 text-5xl font-bold">{roads.length}</div>
              <div className="text-sm opacity-90">สาย</div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg transition hover:shadow-2xl">
            <div className="absolute -right-6 -top-6 text-8xl opacity-20 transition group-hover:scale-110">
              📏
            </div>
            <div className="relative">
              <div className="text-sm opacity-90">ระยะทางรวม</div>
              <div className="mt-2 text-5xl font-bold">{totalDistance.toFixed(2)}</div>
              <div className="text-sm opacity-90">กิโลเมตร</div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg transition hover:shadow-2xl">
            <div className="absolute -right-6 -top-6 text-8xl opacity-20 transition group-hover:scale-110">
              🏆
            </div>
            <div className="relative">
              <div className="text-sm opacity-90">ถนนที่ยาวที่สุด</div>
              <div className="mt-2 truncate text-2xl font-bold">
                {longestRoad?.name ?? '-'}
              </div>
              <div className="text-sm opacity-90">
                {longestRoad?.distance_m
                  ? `${(longestRoad.distance_m / 1000).toFixed(2)} กม.`
                  : 'ไม่มีข้อมูล'}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-slate-800">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อถนน..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-10 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-700 dark:text-white dark:focus:bg-slate-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          {focusRoad && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <span>📍 กำลังแสดง:</span>
              <span className="font-semibold">{focusRoad.name}</span>
              <button
                onClick={() => setFocusRoad(null)}
                className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ล้างการโฟกัส
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div id="map" className="rounded-2xl bg-white p-4 shadow-lg dark:bg-slate-800">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-slate-700 dark:text-white">
            🗺️ แผนที่เส้นทางทั้งหมด
          </h2>
          {loading ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
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
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-slate-700 dark:text-white">
                📋 รายการถนน
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                พบ {filtered.length} รายการ • คลิกเพื่อดูรายละเอียด
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">ชื่อถนน</th>
                    <th className="px-4 py-3 text-left">หมายเหตุ</th>
                    <th className="px-4 py-3 text-right">ระยะทาง</th>
                    <th className="px-4 py-3 text-right">วันที่</th>
                  </tr>
                </thead>
                <tbody className="dark:text-slate-200">
                  {filtered.map((road, i) => {
                    const isFocused = focusRoad?.id === road.id;
                    return (
                      <tr
                        key={road.id}
                        onClick={() => {
                          setFocusRoad(road);
                          setSelectedRoad(road);
                        }}
                        className={`cursor-pointer border-b border-slate-100 transition dark:border-slate-700 ${
                          isFocused
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-blue-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          {road.name}
                          {isFocused && (
                            <span className="ml-2 text-xs text-blue-600">📍</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {road.note || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {road.distance_m != null
                            ? `${(road.distance_m / 1000).toFixed(3)} กม.`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
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
          <p>© {new Date().getFullYear()} ระบบสารสนเทศถนน • เทศบาล</p>
          <p className="mt-1 text-xs">
            Powered by Next.js • Supabase • Vercel
          </p>
        </footer>
      </main>

      {/* Modal รายละเอียดถนน */}
      {selectedRoad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedRoad(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
              <h3 className="text-xl font-bold">🛣️ {selectedRoad.name}</h3>
              <button
                onClick={() => setSelectedRoad(null)}
                className="rounded-full bg-white/20 p-1.5 text-lg hover:bg-white/30"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-5 text-slate-700 dark:text-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ระยะทาง
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {selectedRoad.distance_m
                      ? `${(selectedRoad.distance_m / 1000).toFixed(3)} กม.`
                      : '-'}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    วันที่บันทึก
                  </div>
                  <div className="text-lg font-bold">
                    {new Date(selectedRoad.created_at).toLocaleDateString('th-TH')}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  พิกัดเริ่มต้น
                </div>
                <div className="font-mono text-sm">
                  🟢 {selectedRoad.start_lat.toFixed(6)}, {selectedRoad.start_lng.toFixed(6)}
                </div>
              </div>

              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  พิกัดสิ้นสุด
                </div>
                <div className="font-mono text-sm">
                  🔴 {selectedRoad.end_lat.toFixed(6)}, {selectedRoad.end_lng.toFixed(6)}
                </div>
              </div>

              {selectedRoad.note && (
                <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    หมายเหตุ
                  </div>
                  <div>{selectedRoad.note}</div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${selectedRoad.start_lat},${selectedRoad.start_lng}&destination=${selectedRoad.end_lat},${selectedRoad.end_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center font-medium text-white transition hover:bg-blue-700"
                >
                  🧭 นำทางด้วย Google Maps
                </a>
                <button
                  onClick={() => {
                    setFocusRoad(selectedRoad);
                    setSelectedRoad(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  🗺️ ดูบนแผนที่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}