import { isdFacts, type IsdRecord } from "@/lib/school-isd";

export function IsdListing({ record }: { record: IsdRecord }) {
  const facts = isdFacts(record);
  if (!facts.length) return null;
  const updated = record.source_updated ? record.source_updated.slice(0, 10) : null;

  return (
    <section className="profile-section" id="directory-listing">
      <div className="profile-section-head">
        <div>
          <span className="profile-section-kicker">Third-party directory</span>
          <h2 className="profile-section-title">International Schools Database</h2>
        </div>
        {updated ? <span className="profile-section-meta">Updated {updated}</span> : null}
      </div>
      <p className="profile-section-lead">
        Facts copied from this directory, not from SchoolLens ranking. Confirm with the school.
      </p>
      <dl className="snapshot-fact-list">
        {facts.map((fact) => (
          <div key={fact.label} className="snapshot-fact-row">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="isd-source-line">
        Source:{" "}
        <a href={record.source_url} target="_blank" rel="noreferrer">
          {record.source_name}
        </a>
        {record.official_website_url ? (
          <>
            {" · "}
            <a href={record.official_website_url} target="_blank" rel="noreferrer">
              School website
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
