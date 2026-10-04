import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <BrandLogo tagline />
          </div>
          <nav className="footer-links" aria-label="Legal">
            <Link href="/schools">Schools</Link>
            <Link href="/questionnaire">Priorities</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <p className="footer-note">AI reconciles evidence. It does not recommend or rank schools.</p>
      </div>
    </footer>
  );
}
