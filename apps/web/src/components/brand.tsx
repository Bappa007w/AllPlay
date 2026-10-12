import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="AllPlay home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        All<span className="brand-light">Play</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
