'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Road } from '@/components/RoadsMap';

const RoadsMap = dynamic(() => import('@/components/RoadsMap'), { ssr: false });

export default function HomePage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusRoad, setFocusRoad] = useState<Road | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);

  useEffect(() => {
    fetch('/api/roads')
      .then((r) => r.json())
      .then((d) => setRoads(d.roads ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totalDistance = roads.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 1000;
  const longestRoad = roads.reduce<Road | null>(
    (max, r) => (!max || (r.distance_m ?? 0) > (max.distance_m ?? 0) ? r : max),
    null
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
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
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                if (!v.trim()) {
                  setFocusRoad(null);
                } else {
                  const found = roads.find((r) =>
                    r.name.toLowerCase().includes(v.toLowerCase())
                  );
                  if (found) setFocusRoad(found);
                }
              }}
              placeholder="ค้นหาชื่อถนน..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-10 outline-none transition focus:border-blue-500 focus:bg-white"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setFocusRoad(null);
                }}
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
                onClick={() => {
                  setFocusRoad(null);
                  setSearch('');
                }}
                className="ml-auto text-slate-400 hover:text-slate-700"
              >
                ล้างการโฟกัส
              </button>
            </div>
          )}
        </div>

        {/* Map + Popup */}
        <div id="map" className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-700">
            🗺️ แผนที่เส้นทางทั้งหมด
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            💡 คลิกที่เส้นสีเพื่อดูรายละเอียดถนน
          </p>

          {loading ? (
            <div className="flex h-[700px] items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                กำลังโหลด...
              </div>
            </div>
          ) : roads.length === 0 ? (
            <div className="flex h-[700px] items-center justify-center text-slate-400">
              ยังไม่มีข้อมูลถนน
            </div>
          ) : (
            <div className="relative">
              <RoadsMap
                roads={roads}
                focusRoad={focusRoad}
                onRoadClick={(road) => setSelectedRoad(road)}
              />

              {/* Popup — ลอยมุมขวาในกรอบแผนที่ */}
              {selectedRoad && (
                <div className="absolute right-3 top-3 z-[1000] w-[320px] max-w-[calc(100%-24px)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 md:w-[360px]">
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

                  <div className="space-y-2 p-4 text-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-100 p-2.5">
                        <div className="text-[10px] text-slate-500">ระยะทาง</div>
                        <div className="text-base font-bold text-blue-600">
                          {selectedRoad.distance_m
                            ? `${(selectedRoad.distance_m / 1000).toFixed(3)} กม.`
                            : '-'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-100 p-2.5">
                        <div className="text-[10px] text-slate-500">วันที่</div>
                        <div className="text-xs font-bold">
                          {new Date(selectedRoad.created_at).toLocaleDateString(
                            'th-TH'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-100 p-2.5">
                      <div className="text-[10px] text-slate-500">
                        พิกัดเริ่มต้น
                      </div>
                      <div className="font-mono text-[11px]">
                        🟢 {selectedRoad.start_lat.toFixed(5)},{' '}
                        {selectedRoad.start_lng.toFixed(5)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-100 p-2.5">
                      <div className="text-[10px] text-slate-500">
                        พิกัดสิ้นสุด
                      </div>
                      <div className="font-mono text-[11px]">
                        🔴 {selectedRoad.end_lat.toFixed(5)},{' '}
                        {selectedRoad.end_lng.toFixed(5)}
                      </div>
                    </div>

                    {selectedRoad.note && (
                      <div className="rounded-lg bg-slate-100 p-2.5">
                        <div className="text-[10px] text-slate-500">
                          หมายเหตุ
                        </div>
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
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium transition hover:bg-slate-100"
                      >
                        🗺️ ซูม
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
    </div>
  );
}