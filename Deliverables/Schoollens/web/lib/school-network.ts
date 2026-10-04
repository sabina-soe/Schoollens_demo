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
