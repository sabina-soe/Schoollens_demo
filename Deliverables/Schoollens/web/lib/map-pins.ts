import { parseLocation, type Coord } from "./location";

export type BranchPin = {
  id: string;
  name: string;
  address: string | null;
  coord: Coord;
};

function mercator(coord: Coord) {
  const x = (coord.lng + 180) / 360;
  const lat = Math.max(-85, Math.min(85, coord.lat)) * (Math.PI / 180);
  const y = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2;
  return { x, y };
}

export function projectPins(coords: Coord[]) {
  if (!coords.length) return [];
  const points = coords.map(mercator);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const pad = 0.08;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.002);
  const spanY = Math.max(maxY - minY, 0.002);
  return points.map((point) => ({
    left: `${((point.x - minX) / spanX) * (1 - pad * 2) * 100 + pad * 100}%`,
    top: `${((point.y - minY) / spanY) * (1 - pad * 2) * 100 + pad * 100}%`,
  }));
}

export function staticMapSrc(coords: Coord[]) {
  if (!coords.length) return null;
  const midLat = coords.reduce((sum, item) => sum + item.lat, 0) / coords.length;
  const midLng = coords.reduce((sum, item) => sum + item.lng, 0) / coords.length;
  const spread = Math.max(
    ...coords.map((item) => Math.abs(item.lat - midLat)),
    ...coords.map((item) => Math.abs(item.lng - midLng)),
  );
  const zoom = spread > 4 ? 5 : spread > 1.5 ? 6 : spread > 0.4 ? 8 : 11;
  const markers = coords
    .slice(0, 12)
    .map((item) => `${item.lat},${item.lng},lightblue1`)
    .join("|");
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${midLat},${midLng}&zoom=${zoom}&size=800x360&maptype=mapnik&markers=${markers}`;
}

export function toPins(
  branches: Array<{ id: string; name: string; address: string | null; location: unknown }>,
): BranchPin[] {
  return branches
    .map((branch) => {
      const coord = parseLocation(branch.location);
      return coord ? { id: branch.id, name: branch.name, address: branch.address, coord } : null;
    })
    .filter((item): item is BranchPin => Boolean(item));
}
