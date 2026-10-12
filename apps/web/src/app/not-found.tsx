import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="not-found container">
      <Radio size={40} aria-hidden="true" />
      <p className="eyebrow">404 · OFF THE FREQUENCY</p>
      <h1>This page isn&apos;t playing.</h1>
      <p>The link may be incomplete, or the page may have moved.</p>
      <Button asChild>
        <Link href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Back to AllPlay
        </Link>
      </Button>
    </main>
  );
}
