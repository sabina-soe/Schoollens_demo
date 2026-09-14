export type Coord = { lat: number; lng: number };

export function parseLocation(value: unknown): Coord | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "x" in value && "y" in value) {
    const lng = Number((value as { x: unknown }).x);
    const lat = Number((value as { y: unknown }).y);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (typeof value === "string") {
    const match = value.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/);
    if (!match) return null;
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (Math.abs(a) > 90 || (a >= 8 && a <= 30 && b >= 90 && b <= 102)) {
      return Math.abs(a) > 90 ? { lng: a, lat: b } : { lat: a, lng: b };
    }
    return { lng: a, lat: b };
  }
  return null;
}

export function osmEmbedSrc(coords: Coord[], pad = 0.02) {
  if (!coords.length) return null;
  const lats = coords.map((item) => item.lat);
  const lngs = coords.map((item) => item.lng);
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const bbox = [minLng, minLat, maxLng, maxLat].join(",");
  const marker = `${coords[0].lat},${coords[0].lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

export function osmPinHref(coord: Coord) {
  return `https://www.openstreetmap.org/?mlat=${coord.lat}&mlon=${coord.lng}#map=16/${coord.lat}/${coord.lng}`;
}
