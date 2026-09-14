"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInControl } from "./sign-in-control";
import { useSession } from "./session-context";

function navClass(href: string, pathname: string) {
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return active ? "site-nav-link site-nav-link-active" : "site-nav-link";
}

export function SiteNav({ open }: { open: boolean }) {
  const pathname = usePathname();
  const { role, status } = useSession();

  return (
    <nav id="site-nav" className={open ? "site-nav site-nav-open" : "site-nav"} aria-label="Site">
      <Link href="/schools" className={navClass("/schools", pathname)}>
        Schools
      </Link>
      <Link href="/questionnaire" className={navClass("/questionnaire", pathname)}>
        Priorities
      </Link>
      {status === "in" && role === "school_admin" ? (
        <Link href="/school-admin" className={navClass("/school-admin", pathname)}>
          Admin
        </Link>
      ) : null}
      {status === "in" && role === "moderator" ? (
        <Link href="/moderator" className={navClass("/moderator", pathname)}>
          Moderator
        </Link>
      ) : null}
      {status === "in" && role === "platform_operator" ? (
        <Link href="/operator" className={navClass("/operator", pathname)}>
          Operator
        </Link>
      ) : null}
      <SignInControl />
    </nav>
  );
}
