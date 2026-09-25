'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [citizenId, setCitizenId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleaned = citizenId.replace(/[^0-9]/g, '');

    if (cleaned.length !== 13) {
      setError('หมายเลขประชาชนต้องมี 13 หลัก');
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('citizen_id', cleaned)
      .single();

    if (dbError || !data) {
      setError('หมายเลขประชาชนไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าใช้งาน');
      setLoading(false);
      return;
    }

    localStorage.setItem(
      'user',
      JSON.stringify({
        citizen_id: data.citizen_id,
        name: data.name,
        role: data.role,
      })
    );

    router.push('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center text-white">
          <img
            src="/logo.png"
            alt="โลโก้เทศบาล"
            className="mx-auto h-20 w-20 rounded-full bg-white p-1 shadow-md"
          />
          <h1 className="mt-3 text-lg font-bold">
            ระบบสารสนเทศข้อมูลถนนท้องถิ่น
          </h1>
          <p className="mt-1 text-xs opacity-90">
            เทศบาลตำบลท่าวังทอง อำเภอเมืองพะเยา จังหวัดพะเยา (พย.11)
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">
              หมายเลขประชาชน (13 หลัก)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={citizenId}
              onChange={(e) => setCitizenId(e.target.value)}
              required
              maxLength={17}
              placeholder="0 0000 00000 00 0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-mono tracking-widest outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              ตัวอย่าง: 1234567890123
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
          </button>

          <a
            href="/"
            className="block w-full rounded-lg border-2 border-blue-600 px-4 py-2.5 text-center font-medium text-blue-600 transition hover:bg-blue-600 hover:text-white"
          >
            📊 ไปหน้าสารสนเทศถนน
          </a>
        </form>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 p-3 text-center text-xs text-slate-400">
          สำหรับเจ้าหน้าที่เทศบาลเท่านั้น
        </div>
      </div>
    </div>
  );
}