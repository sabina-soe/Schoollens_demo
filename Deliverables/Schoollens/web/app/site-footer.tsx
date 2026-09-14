import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-mark">SchoolLens</p>
      <p className="footer-note">AI reconciles evidence. It does not recommend or rank schools.</p>
      <nav className="footer-links" aria-label="Legal">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
    </footer>
  );
}
