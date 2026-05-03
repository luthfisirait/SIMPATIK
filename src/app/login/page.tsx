"use client";

import { Eye, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("kasiwas@simpatik.local");
  const [password, setPassword] = useState("simpatik123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (result?.error) {
      setError("Email atau password tidak sesuai.");
      return;
    }

    router.push(callbackUrl.startsWith("http") ? new URL(callbackUrl).pathname + new URL(callbackUrl).search : callbackUrl);
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-row">
          <span className="brand-mark">SP</span>
          <div>
            <div className="brand-title">SIMPATIK</div>
            <div className="brand-subtitle">KPP Pratama Padang Satu</div>
          </div>
        </div>
        <h1>Masuk ke ruang monitoring kepatuhan perpajakan.</h1>
        <p>Gunakan akun dummy role untuk melihat dashboard, modul monitoring, direktori, dan pengaturan.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <span style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--text-3)" }} />
              <input value={email} onChange={(event) => setEmail(event.target.value)} style={{ paddingLeft: 38 }} />
            </span>
          </label>
          <label className="field">
            <span>Password</span>
            <span style={{ position: "relative" }}>
              <LockKeyhole size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--text-3)" }} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ paddingLeft: 38 }}
              />
            </span>
          </label>
          {error ? <div className="badge badge-red">{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            <Eye size={16} />
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <div className="login-hint">
          Default: <strong>kasiwas@simpatik.local</strong> / <strong>simpatik123</strong>. Akun lain:{" "}
          <strong>kepala@simpatik.local</strong>, <strong>ar1@simpatik.local</strong>, <strong>teknisi1@simpatik.local</strong>.
        </div>
      </section>
      <section className="login-visual">
        <h2>Sistem Monitoring Terintegrasi Kepatuhan Perpajakan</h2>
        <p>Dashboard operasional untuk kepatuhan SPT PPh OP, PPh Pasal 21 bendahara, dan sosialisasi Coretax seluruh OPD.</p>
      </section>
    </main>
  );
}
