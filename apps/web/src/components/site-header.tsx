"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  return (
    <header
      className="site-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
            Home
          </Link>
          <Link href="/#features">Features</Link>
          <Link href="/#how-it-works">How it works</Link>
        </nav>
        <Button asChild variant="outline" size="sm" className="header-join">
          <Link href="/join">
            Join a room <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </Button>
        <Button
          ref={toggleRef}
          variant="ghost"
          size="icon"
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>
      <nav
        id="mobile-navigation"
        className="mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          aria-current={pathname === "/" ? "page" : undefined}
        >
          Home
        </Link>
        <Link href="/#features" onClick={() => setOpen(false)}>
          Features
        </Link>
        <Link href="/#how-it-works" onClick={() => setOpen(false)}>
          How it works
        </Link>
        <Link href="/create" onClick={() => setOpen(false)}>
          Create a room
        </Link>
        <Link href="/join" onClick={() => setOpen(false)}>
          Join a room
        </Link>
      </nav>
    </header>
  );
}
