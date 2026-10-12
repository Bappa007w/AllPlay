import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div>
        <Brand />
        <p>Good music deserves good company.</p>
      </div>
      <div className="footer-links">
        <Link href="/#features">
          Explore AllPlay <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <span>Rooms are ready · Music coming soon</span>
      </div>
    </footer>
  );
}
