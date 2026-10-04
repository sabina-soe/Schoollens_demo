import type { CampusOption } from "@/lib/school-branches";

export function CampusPicker({
  campuses,
  value,
  onChange,
  years,
  yearValue,
  onYearChange,
}: {
  campuses: CampusOption[];
  value: string;
  onChange: (id: string) => void;
  years?: string[];
  yearValue?: string;
  onYearChange?: (year: string) => void;
}) {
  if (campuses.length < 2 && !years?.length) return null;
  const selected = campuses.find((campus) => campus.id === value);

  return (
    <div className="campus-picker">
      <div className="campus-picker-copy">
        <p className="campus-picker-kicker">Viewing campus</p>
        <p className="campus-picker-lead">
          {selected?.name ?? "Select a campus"}. Fees and MOE listings below follow this campus.
        </p>
      </div>
      <div className="campus-picker-controls">
        {campuses.length > 1 ? (
          <label className="campus-picker-field">
            <span>Campus</span>
            <select value={value} onChange={(event) => onChange(event.target.value)}>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {years?.length && onYearChange ? (
          <label className="campus-picker-field">
            <span>Year</span>
            <select value={yearValue ?? ""} onChange={(event) => onYearChange(event.target.value)}>
              <option value="">All years</option>
              {(yearValue && !years.includes(yearValue) ? [yearValue, ...years] : years).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
