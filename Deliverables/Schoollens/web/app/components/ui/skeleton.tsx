export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SchoolCardSkeleton() {
  return (
    <div className="school-card school-card-skeleton" aria-hidden="true">
      <div className="school-card-header">
        <Skeleton className="skeleton-title" style={{ width: "65%", height: "22px" }} />
        <Skeleton className="skeleton-badge" style={{ width: "80px", height: "24px", borderRadius: "9999px" }} />
      </div>
      <Skeleton className="skeleton-text" style={{ width: "45%", height: "16px", marginTop: "8px" }} />
      <div className="school-card-footer" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
        <Skeleton style={{ width: "90px", height: "22px", borderRadius: "6px" }} />
        <Skeleton style={{ width: "110px", height: "22px", borderRadius: "6px" }} />
      </div>
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="profile-hero-skeleton" aria-hidden="true">
      <Skeleton style={{ width: "140px", height: "16px", marginBottom: "16px" }} />
      <Skeleton style={{ width: "60%", height: "36px", marginBottom: "12px" }} />
      <Skeleton style={{ width: "40%", height: "20px", marginBottom: "20px" }} />
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Skeleton style={{ width: "120px", height: "32px", borderRadius: "9999px" }} />
        <Skeleton style={{ width: "100px", height: "32px", borderRadius: "9999px" }} />
        <Skeleton style={{ width: "140px", height: "32px", borderRadius: "9999px" }} />
      </div>
    </div>
  );
}
