export type RegisterSchool = {
  id: string;
  name: string;
  address: string | null;
  curriculum_type: string | null;
  school_group_id: string | null;
  moe_approved_from: string | null;
  moe_approved_to: string | null;
  official_website_url: string | null;
  official_facebook_url: string | null;
  location: unknown;
  geocode_confidence: string | null;
};

export function withTimeout<T>(promise: PromiseLike<T>, ms = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Failed to fetch")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message: unknown }).message ?? "");
  return String(error);
}

export function isRegisterUnreachable(error: unknown) {
  return /failed to fetch|fetch failed|ENOTFOUND|network error|TypeError/i.test(errorMessage(error));
}

export async function loadLocalSchools(): Promise<RegisterSchool[]> {
  const response = await fetch("/demo-register/schools.json", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { schools?: RegisterSchool[] };
  return payload.schools ?? [];
}

export async function loadLocalSchool(id: string): Promise<RegisterSchool | null> {
  const schools = await loadLocalSchools();
  return schools.find((school) => school.id === id) ?? null;
}
