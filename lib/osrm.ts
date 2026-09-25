export type LatLng = { lat: number; lng: number };

export async function getRoadDistance(start: LatLng, end: LatLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=false&alternatives=false`;

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