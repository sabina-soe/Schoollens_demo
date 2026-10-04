export function BrandLogo({
  tagline = false,
}: {
  tagline?: boolean;
}) {
  return (
    <span className={tagline ? "brand-lockup brand-lockup-tagline" : "brand-lockup"}>
      <img src="/logo-mark.png" alt="" className="brand-mark" width={80} height={80} />
      <span className="brand-text">
        <span className="brand-wordmark">
          <span className="brand-school">School</span>
          <span className="brand-lens">Lens</span>
        </span>
        {tagline ? <span className="brand-tagline">Focus on education</span> : null}
      </span>
    </span>
  );
}
