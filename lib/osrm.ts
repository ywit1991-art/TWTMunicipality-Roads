export type LatLng = { lat: number; lng: number };

export async function getRoadDistance(start: LatLng, end: LatLng, waypoints: LatLng[] = []) {
  // ⭐ ประกอบ URL เพื่อให้วิ่งผ่าน waypoints ทั้งหมด
  let coords = `${start.lng},${start.lat}`;
  waypoints.forEach(wp => { coords += `;${wp.lng},${wp.lat}`; });
  coords += `;${end.lng},${end.lat}`;

  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&alternatives=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM request failed');

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('ไม่สามารถหาเส้นทางได้');
  }

  return {
    distance_m: data.routes[0].distance as number,
    duration_s: data.routes[0].duration as number,
  };
}