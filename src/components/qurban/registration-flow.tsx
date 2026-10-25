import Link from "next/link";
import { ArrowRight, Users, Beef } from "lucide-react";

export function RegistrationFlow({
  current,
  base,
}: {
  current: "participants" | "groups";
  base: string;
}) {
  return (
    <nav className="q-registration-flow" aria-label="Alur pendataan peserta">
      <Link
        href={`${base}/peserta`}
        aria-current={current === "participants" ? "step" : undefined}
        className={current === "participants" ? "is-current" : ""}
      >
        <span className="q-flow-number">1</span>
        <span>
          <strong>
            <Users size={14} /> Data peserta
          </strong>
          <small>Daftarkan identitas jamaah</small>
        </span>
      </Link>
      <ArrowRight className="q-flow-arrow" size={17} aria-hidden="true" />
      <Link
        href={`${base}/kelompok`}
        aria-current={current === "groups" ? "step" : undefined}
        className={current === "groups" ? "is-current" : ""}
      >
        <span className="q-flow-number">2</span>
        <span>
          <strong>
            <Beef size={15} /> Kelompok sapi
          </strong>
          <small>Buat kelompok dan pilih peserta</small>
        </span>
      </Link>
    </nav>
  );
}
