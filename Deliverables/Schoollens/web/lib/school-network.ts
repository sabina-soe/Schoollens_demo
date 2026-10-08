const PREFERRED_HUB: Record<string, string> = {
  "aaf8ab28-d86b-5a86-86d6-7a7fbd4d9591": "f6c7b97d-8959-4d0c-841f-8148d10dcd4d",
};

const NAME_HUB: Record<string, string> = {
  "name:ilbc": "f6c7b97d-8959-4d0c-841f-8148d10dcd4d",
  "name:pism": "d1e8deee-ed2c-43fb-a382-c3adb5d06861",
  "name:kings": "ba3c6f02-961b-42e1-8ef9-21d872abbda7",
  "name:helix": "5d88ea9c-c422-4696-88f3-5f2afb315530",
};

function nameNetworkKey(name: string) {
  if (/\bilbc\b/i.test(name)) return "name:ilbc";
  if (/\bpride ism\b|\bpism\b/i.test(name)) return "name:pism";
  if (/kings international/i.test(name)) return "name:kings";
  if (/^helix\b/i.test(name)) return "name:helix";
  return null;
}

export function collapseDirectorySchools<T extends { id: string; name: string; school_group_id?: string | null }>(
  schools: T[],
): (T & { campusCount: number })[] {
  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const school of schools) {
    const key = school.school_group_id
      ? `g:${school.school_group_id}`
      : nameNetworkKey(school.name) ?? `id:${school.id}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(school);
  }
  return order.map((key) => {
    const members = buckets.get(key) ?? [];
    const preferred = key.startsWith("g:") ? PREFERRED_HUB[key.slice(2)] : NAME_HUB[key];
    const hub =
      (preferred && members.find((row) => row.id === preferred)) ||
      [...members].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))[0];
    return {
      ...hub,
      id: preferred ?? hub.id,
      name: preferred && hub.id !== preferred && /\bilbc\b/i.test(hub.name) ? "ILBC International School" : hub.name,
      campusCount: members.length,
    };
  });
}

export function networkIds(schoolId: string, siblings?: { id: string }[] | null) {
  return [...new Set([schoolId, ...(siblings ?? []).map((row) => row.id)])];
}

export function pickBySchoolIds<T>(bySchool: Record<string, T> | null | undefined, ids: string[]): T | null {
  if (!bySchool) return null;
  for (const id of ids) {
    if (bySchool[id]) return bySchool[id];
  }
  return null;
}

export async function firstOkJson<T>(urls: string[], signal?: AbortSignal): Promise<T | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return (await response.json()) as T;
    } catch {
      continue;
    }
  }
  return null;
}
