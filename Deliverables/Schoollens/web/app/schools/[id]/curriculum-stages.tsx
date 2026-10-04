import type { CurriculumRecord, CurriculumStage, CurriculumYear } from "@/lib/school-curriculum";

function SubjectColumn({
  title,
  items,
  tone = "core",
}: {
  title: string;
  items: string[];
  tone?: "core" | "optional";
}) {
  if (!items.length) return null;
  return (
    <section className={`curriculum-col curriculum-col-${tone}`}>
      <header className="curriculum-col-head">
        <h5>{title}</h5>
        <span>{items.length}</span>
      </header>
      <ol className="curriculum-subject-list">
        {items.map((item, index) => (
          <li key={item}>
            <span className="curriculum-subject-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="curriculum-subject-name">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function YearBlock({ year, focused }: { year: CurriculumYear; focused: boolean }) {
  const optional = year.optional ?? [];
  return (
    <article className={`curriculum-year ${focused ? "curriculum-year-focus" : ""}`} id={focused ? "curriculum-year-focus" : undefined}>
      <header className="curriculum-year-head">
        <h4 className="curriculum-year-title">{year.name}</h4>
        <p className="curriculum-year-count">
          {year.subjects.length} core{optional.length ? ` · ${optional.length} optional` : ""}
        </p>
      </header>
      {year.note ? <p className="curriculum-year-note">{year.note}</p> : null}
      <div className={`curriculum-year-grid ${optional.length ? "" : "curriculum-year-grid-single"}`}>
        <SubjectColumn title="Core" items={year.subjects} />
        <SubjectColumn title="Optional" items={optional} tone="optional" />
      </div>
    </article>
  );
}

function stageMatchesYear(stage: CurriculumStage, focusYear?: string) {
  if (!focusYear) return true;
  if (stage.years?.some((year) => year.name === focusYear)) return true;
  if (stage.years?.length) return false;
  return new RegExp(focusYear.replace(/\s+/g, "\\s+"), "i").test(`${stage.name} ${stage.duration ?? ""} ${stage.summary}`);
}

function StageCard({ stage, focusYear }: { stage: CurriculumStage; focusYear?: string }) {
  const years = stage.years ?? [];
  const visibleYears = focusYear ? years.filter((year) => year.name === focusYear) : years;
  if (!stageMatchesYear(stage, focusYear)) return null;

  return (
    <article className="curriculum-stage">
      <div className="curriculum-stage-head">
        <div>
          <h3 className="curriculum-stage-title">{stage.name}</h3>
          <p className="curriculum-stage-meta">
            {[stage.ages, stage.duration].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a className="fee-card-source" href={stage.source_url} target="_blank" rel="noreferrer">
          {stage.source_label}
        </a>
      </div>
      <p className="curriculum-stage-summary">{stage.summary}</p>
      {stage.subjects?.length || stage.skills?.length ? (
        <div className={`curriculum-year-grid ${stage.subjects?.length && stage.skills?.length ? "" : "curriculum-year-grid-single"}`}>
          <SubjectColumn title="Subjects" items={stage.subjects ?? []} />
          <SubjectColumn title="Skills" items={stage.skills ?? []} tone="optional" />
        </div>
      ) : null}
      {visibleYears.map((year) => (
        <YearBlock key={year.name} year={year} focused={year.name === focusYear} />
      ))}
      {stage.hours?.length ? (
        <ul className="curriculum-note-list">
          {stage.hours.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {stage.notes?.length ? (
        <ul className="curriculum-note-list">
          {stage.notes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function CurriculumStages({
  record,
  focusYear,
}: {
  record: CurriculumRecord;
  focusYear?: string;
}) {
  const visible = record.stages.filter((stage) => stageMatchesYear(stage, focusYear));

  return (
    <div className="curriculum-stages">
      <dl className="fee-card-chips">
        {record.framework ? (
          <div className="fee-chip">
            <dt>Framework</dt>
            <dd>{record.framework}</dd>
          </div>
        ) : null}
        {record.medium ? (
          <div className="fee-chip">
            <dt>Medium</dt>
            <dd>{record.medium}</dd>
          </div>
        ) : null}
        {record.academic_year ? (
          <div className="fee-chip">
            <dt>Academic year</dt>
            <dd>{record.academic_year}</dd>
          </div>
        ) : null}
      </dl>
      {visible.length ? (
        visible.map((stage) => <StageCard key={stage.id} stage={stage} focusYear={focusYear} />)
      ) : (
        <p className="profile-empty-copy">
          {focusYear ? `${focusYear} is not listed as a named year on the official curriculum pages.` : "No curriculum evidence on file yet."}
        </p>
      )}
    </div>
  );
}
