import type { FacilityRecord } from "@/lib/school-facilities";

export function FacilityList({ record }: { record: FacilityRecord }) {
  return (
    <div className="cca-programmes">
      {record.summary ? <p className="profile-section-lead">{record.summary}</p> : null}
      <div className="cca-grid">
        {record.groups.map((group) => (
          <article key={group.id} className="cca-card">
            <header className="cca-card-head">
              <h3>{group.name}</h3>
              <span>{group.items.length}</span>
            </header>
            <ol className="curriculum-subject-list">
              {group.items.map((item, index) => (
                <li key={item}>
                  <span className="curriculum-subject-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="curriculum-subject-name">{item}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      {record.notes?.length ? (
        <ul className="curriculum-note-list">
          {record.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <a className="fee-card-source" href={record.source_url} target="_blank" rel="noreferrer">
        {record.source_label}
      </a>
    </div>
  );
}
