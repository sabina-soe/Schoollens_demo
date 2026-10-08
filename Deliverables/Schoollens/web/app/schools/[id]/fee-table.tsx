import { parseFeeClaims } from "@/lib/fee-display";
import type { FeeAmountRow, FeePoster } from "@/lib/school-branches";

function hasSplitAmounts(rows: FeeAmountRow[]) {
  return rows.some((row) => row.on_campus || row.online);
}

function ProgrammeTable({
  rows,
  focusYear,
  sourceHref,
}: {
  rows: FeeAmountRow[];
  focusYear?: string;
  sourceHref?: string;
}) {
  const split = hasSplitAmounts(rows);
  const visible = focusYear ? rows.filter((row) => row.item === focusYear) : rows;
  if (!visible.length) {
    return (
      <p className="profile-empty-copy">
        {focusYear ? `${focusYear} is not listed for this campus on the official table.` : "No fee rows on file."}
      </p>
    );
  }

  return (
    <div className="fee-table-wrap">
      <table className="fee-table">
        <thead>
          <tr>
            <th scope="col">Year</th>
            {split ? (
              <>
                <th scope="col">On campus</th>
                <th scope="col">Online</th>
              </>
            ) : (
              <th scope="col">Amount</th>
            )}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const focused = Boolean(focusYear && row.item === focusYear);
            return (
              <tr key={row.item} className={focused ? "fee-row-focus" : undefined} id={focused ? "fee-year-focus" : undefined}>
                <td className="fee-table-item">{row.item}</td>
                {split ? (
                  <>
                    <td className="fee-table-amount">{row.on_campus || "—"}</td>
                    <td className="fee-table-amount">{row.online || "—"}</td>
                  </>
                ) : (
                  <td className="fee-table-amount">
                    {sourceHref && row.amount ? (
                      <a href={sourceHref} target="_blank" rel="noreferrer" className="fee-amount-link">
                        {row.amount}
                      </a>
                    ) : (
                      row.amount || "—"
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FeeTable({
  poster,
  focusYear,
}: {
  poster: FeePoster;
  focusYear?: string;
}) {
  const branch = poster.branches?.[0];
  const href = poster.source_url || (poster.file ? `/school-fees/${encodeURIComponent(poster.file)}` : undefined);
  const oneTime = [...(poster.shared ?? []), ...(branch?.one_time ?? [])];
  const programmes = branch?.programmes ?? [];
  const parsed = !programmes.length && poster.claims?.length ? parseFeeClaims(poster.claims) : null;
  const notes = poster.notes ?? parsed?.notes ?? [];

  return (
    <article className="fee-card">
      <div className="fee-card-head">
        <h3 className="fee-card-title">{poster.label || "Fee announcement"}</h3>
        {href ? (
          <a className="fee-card-source" href={href} target="_blank" rel="noreferrer">
            {poster.source_label || (poster.source_url ? "Source" : "View poster")}
          </a>
        ) : null}
      </div>

      {parsed?.chips.length ? (
        <dl className="fee-card-chips">
          {parsed.chips.map((chip) => (
            <div key={`${chip.label}-${chip.value}`} className="fee-chip">
              <dt>{chip.label}</dt>
              <dd>{chip.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {notes.length ? (
        <ul className="fee-card-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {oneTime.length ? (
        <div className="fee-onetime">
          <h4 className="fee-onetime-title">One-time fees</h4>
          <dl className="fee-card-chips">
            {oneTime.map((row) => (
              <div key={row.item} className="fee-chip">
                <dt>{row.item}</dt>
                <dd>{row.amount}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {programmes.length ? <ProgrammeTable rows={programmes} focusYear={focusYear} sourceHref={href} /> : null}

      {!programmes.length && parsed?.rows.length ? (
        <div className="fee-table-wrap">
          <table className="fee-table">
            <thead>
              <tr>
                <th scope="col">Programme</th>
                <th scope="col">Amount</th>
                {parsed.rows.some((row) => row.detail) ? <th scope="col">Detail</th> : null}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row) => (
                <tr key={`${row.item}-${row.amount}`}>
                  <td className="fee-table-item">{row.item}</td>
                  <td className="fee-table-amount">{row.amount}</td>
                  {parsed.rows.some((item) => item.detail) ? <td className="fee-table-detail">{row.detail || "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!programmes.length && !parsed?.rows.length && poster.claims?.length ? (
        <ul className="fee-poster-claims">
          {poster.claims.map((claim) => (
            <li key={claim}>{claim}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
