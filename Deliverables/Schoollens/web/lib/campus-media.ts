export type MediaItem = {
  kind: "photo" | "video";
  url: string;
  thumb?: string | null;
  source?: string;
  embed?: string;
};

export type CampusFact = {
  text: string;
  source: string;
};

export type CampusRecord = {
  school_name?: string;
  address?: string | null;
  items: CampusFact[];
};

export function youtubeId(url: string) {
  const match = url.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match?.[1] ?? "";
}

export function youtubeMedia(url: string, source: string, label?: string): MediaItem {
  const id = youtubeId(url);
  return {
    kind: "video",
    url: id ? `https://www.youtube.com/watch?v=${id}` : url,
    embed: id ? `https://www.youtube.com/embed/${id}` : url,
    thumb: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined,
    source: label ? `${source} — ${label}` : source,
  };
}

export function isUsableMedia(item: MediaItem) {
  if (item.embed && /youtube\.com\/embed|player\.vimeo/i.test(item.embed)) return true;
  const src = item.thumb || item.url;
  if (!src) return false;
  if (/facebook\.com\/.+\/(posts|permalink)\//i.test(src)) return false;
  if (/fbcdn\.net|scontent-/i.test(src)) return false;
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(src)) return true;
  if (/img\.youtube\.com/i.test(src)) return true;
  return false;
}

export function usableMedia(items: MediaItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!isUsableMedia(item)) return false;
    const key = item.embed || item.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
