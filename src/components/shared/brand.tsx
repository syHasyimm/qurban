import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5"
      aria-label="Qurban, beranda"
    >
      <Image
        src="/logo.png"
        alt=""
        width={56}
        height={56}
        className="size-14 shrink-0 object-contain"
      />
      <span className="text-xl font-semibold tracking-tight">
        Qurban<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
