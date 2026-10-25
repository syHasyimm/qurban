import Image from "next/image";
import {
  ArrowUpRight,
  MessageCircle,
  Users,
  Beef,
  CheckCircle2,
  HandCoins,
  ClipboardCheck,
  HeartHandshake,
  CalendarDays,
  ArrowRight,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { dateLabel, type SiteSettings, type Period } from "@/lib/qurban-demo";

export type PublicAggregate = {
  registered: number;
  grouped: number;
  planned: number;
  funded: number;
  purchased: number;
  slaughtered: number;
};
export function PublicContent({
  settings,
  period,
  aggregate,
  compact = false,
  demo = false,
}: {
  settings: SiteSettings;
  period: Period | null;
  aggregate: PublicAggregate | null;
  compact?: boolean;
  demo?: boolean;
}) {
  const canRegister = period?.status === "open";
  const whatsapp = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Assalamu’alaikum, saya ingin mendapatkan informasi dan ikut ${period?.name ?? "program qurban"}. Mohon informasinya, terima kasih.`)}`
    : "#kontak";
  return (
    <div className={`q-public ${compact ? "q-public-compact" : ""}`}>
      <section className="q-public-hero" id="tentang">
        <div className="q-public-hero-copy">
          <span className="q-public-eyebrow">
            <span />
            {period
              ? `${period.name} · ${canRegister ? "Pendaftaran dibuka" : "Informasi pelaksanaan"}`
              : "Bersama dalam kebaikan"}
          </span>
          <h1>
            Ringankan iuran.
            <br />
            Besarkan kebaikan.
          </h1>
          <p>{settings.description}</p>
          <div className="q-public-hero-actions">
            <a
              className="q-cta"
              href={canRegister ? whatsapp : "#perkembangan"}
              target={canRegister && settings.whatsapp ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {canRegister ? <MessageCircle size={19} /> : <Beef size={19} />}
              {canRegister
                ? "Hubungi Panitia untuk Ikut Qurban"
                : "Lihat perkembangan qurban"}
              <ArrowUpRight size={17} />
            </a>
            <a className="q-public-how-link" href="#cara-bergabung">
              Bagaimana caranya? <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <div className="q-public-hero-image">
          <Image
            src="/qurban-cow.jpg"
            alt="Sapi yang dirawat di padang rumput hijau"
            width={1400}
            height={1100}
            priority={!compact}
            className="q-cow-photo"
          />
          <div className="q-photo-frame" />
        </div>
      </section>
      <nav className="qm-public-actions" aria-label="Jelajahi program qurban">
        <a href="#perkembangan">
          <Beef size={21} />
          Perkembangan
        </a>
        <a href="#jadwal">
          <CalendarDays size={21} />
          Jadwal
        </a>
        <a href="#cara-bergabung">
          <Users size={21} />
          Cara ikut
        </a>
      </nav>
      {period && aggregate ? (
        <section id="perkembangan" className="q-public-stats">
          <div>
            <Users size={24} />
            <strong>
              {aggregate.registered}
              <small>jamaah</small>
            </strong>
            <p>Jamaah terdaftar</p>
          </div>
          <div>
            <Beef size={24} />
            <strong>
              {aggregate.planned}
              <small>ekor sapi</small>
            </strong>
            <p>Sapi direncanakan</p>
          </div>
          <div className="q-public-funded">
            <CheckCircle2 size={24} />
            <strong>
              {aggregate.funded}
              <small>ekor sapi</small>
            </strong>
            <p>Sapi sudah didanai</p>
          </div>
          <div className="q-public-stats-note">
            <ShieldCheck size={22} />
            <p>
              Terbuka angkanya.
              <br />
              Terjaga amanahnya.
            </p>
            <span>
              {demo ? "Data contoh" : "Informasi periode"} · {period.name}
            </span>
          </div>
        </section>
      ) : (
        <div id="perkembangan" className="q-public-no-period">
          <CalendarDays size={28} />
          <h2>Informasi periode qurban akan diumumkan panitia.</h2>
          <p>
            Silakan kembali atau hubungi narahubung untuk informasi berikutnya.
          </p>
        </div>
      )}
      <section className="q-public-how" id="cara-bergabung">
        <div className="q-public-section-title">
          <span className="q-public-kicker">
            MUDAH DIMULAI, RINGAN DIJALANI
          </span>
          <h2>
            Niat baik Anda,
            <br />
            kami bantu persiapkan.
          </h2>
          <p>
            Cukup hubungi panitia. Kami mendampingi dari pendaftaran hingga
            pelaksanaan.
          </p>
        </div>
        <div className="q-public-steps">
          {[
            {
              icon: MessageCircle,
              title: "Sampaikan niat Anda",
              text: "Hubungi panitia melalui WhatsApp. Panitia memverifikasi data dan mencatat kepesertaan.",
            },
            {
              icon: Users,
              title: "Bergabung dalam kelompok",
              text: "Satu sapi untuk maksimal tujuh jamaah. Target iuran disepakati bersama anggota kelompok.",
            },
            {
              icon: HandCoins,
              title: "Iuran tunai sesuai kemampuan",
              text: "Serahkan cicilan tunai kepada panitia. Setiap setoran tercatat dan memiliki kuitansi.",
            },
            {
              icon: HeartHandshake,
              title: "Wujudkan qurban bersama",
              text: "Setelah seluruh kewajiban selesai, panitia mempersiapkan sapi dan pelaksanaan qurban.",
            },
          ].map((step, i) => (
            <div className="q-public-step" key={step.title}>
              <span className="q-public-step-icon">
                <step.icon size={22} strokeWidth={1.6} />
              </span>
              <div>
                <small>0{i + 1}</small>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {period && (
        <section className="q-public-schedule" id="jadwal">
          <div>
            <CalendarDays size={29} />
            <h2>Catat tanggal baiknya.</h2>
            <p>Persiapkan niat dan iuran Anda untuk {period.name}.</p>
          </div>
          <div className="q-public-schedule-dates">
            <div>
              <small>Pendaftaran sampai</small>
              <strong>{dateLabel(period.end)}</strong>
            </div>
            <div>
              <small>Batas pelunasan</small>
              <strong>{dateLabel(period.due)}</strong>
            </div>
            <div>
              <small>Rencana pelaksanaan</small>
              <strong>{dateLabel(period.date)}</strong>
            </div>
          </div>
          <p className="q-public-schedule-note">
            Tanggal pelaksanaan mengikuti keputusan panitia dan dapat
            diperbarui.
          </p>
        </section>
      )}
      <section className="q-public-faq" id="pertanyaan">
        <div>
          <h2>
            Mungkin Anda
            <br />
            ingin tahu.
          </h2>
          <p>Beberapa hal sebelum ikut berqurban bersama.</p>
        </div>
        <div>
          {[
            {
              q: "Apakah saya perlu membuat akun?",
              a: "Tidak. Jamaah cukup menghubungi panitia melalui WhatsApp. Setelah data diverifikasi, panitia akan mencatat pendaftaran dan menyampaikan nomor kepesertaan.",
            },
            {
              q: "Berapa target iuran setiap peserta?",
              a: "Target mengikuti total biaya dan jumlah anggota yang disepakati dalam kelompok. Seluruh anggota satu kelompok memiliki target yang sama. Panitia menyampaikan jika target masih berupa estimasi.",
            },
            {
              q: "Bagaimana cara menyetor iuran?",
              a: "Iuran diserahkan secara tunai kepada panitia. Besaran dan waktu cicilan fleksibel sampai batas pelunasan. Panitia mencatat penerimaan dan menyiapkan kuitansi untuk setiap setoran.",
            },
            {
              q: "Bagaimana jika kelompok belum penuh?",
              a: "Panitia melengkapi anggota atau menyepakati pembagian biaya baru dengan anggota yang ada. Kelompok dapat berisi satu sampai tujuh peserta, sesuai kesepakatan.",
            },
            {
              q: "Apa yang terjadi jika ada kelebihan setoran?",
              a: "Jika target final turun sehingga setoran Anda berlebih, panitia mencatat dan menyelesaikan pengembalian tunai sebelum kelompok selesai secara keuangan.",
            },
          ].map((item) => (
            <details key={item.q}>
              <summary>
                {item.q}
                <PlusSymbol />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="q-public-contact" id="kontak">
        <div>
          <span className="q-contact-icon">
            <HeartHandshake size={32} strokeWidth={1.4} />
          </span>
          <h2>
            Satu niat baik.
            <br />
            Kebaikan untuk lebih banyak orang.
          </h2>
          <p>{settings.name} siap membantu langkah qurban Anda.</p>
          {settings.whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="q-cta"
            >
              <MessageCircle size={18} />
              Hubungi Panitia untuk Ikut Qurban
              <ArrowUpRight size={16} />
            </a>
          ) : (
            <p className="q-contact-unconfigured">
              {demo
                ? "Nomor WhatsApp panitia belum diatur pada pratinjau ini."
                : "Kontak WhatsApp akan diumumkan panitia."}
            </p>
          )}
        </div>
        <div className="q-public-contact-info">
          <span>Narahubung panitia</span>
          <strong>{settings.contact}</strong>
          {settings.whatsapp && <p>+{settings.whatsapp}</p>}
          <span>
            <MapPin size={15} />
            {settings.address}
          </span>
          <p>
            Pendaftaran dicatat setelah verifikasi panitia. Mengirim pesan belum
            otomatis menjadi peserta.
          </p>
        </div>
      </section>
      {aggregate && (
        <div className="q-public-execution">
          <ClipboardCheck size={17} />
          <span>
            Perkembangan pelaksanaan {period?.name}:{" "}
            <strong>{aggregate.purchased} sapi sudah dibeli</strong> ·{" "}
            <strong>{aggregate.slaughtered} sapi sudah dikurbankan</strong>
          </span>
        </div>
      )}
      {!compact && (
        <div className="qm-public-dock">
          {settings.whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={19} />
              {canRegister
                ? "Hubungi panitia untuk ikut qurban"
                : "Tanya informasi qurban"}
              <ArrowUpRight size={17} />
            </a>
          ) : (
            <span>Kontak panitia belum tersedia</span>
          )}
        </div>
      )}
    </div>
  );
}
function PlusSymbol() {
  return (
    <span aria-hidden="true" className="q-faq-plus">
      +
    </span>
  );
}
