"use client";

import { Eye, LockKeyhole, Mail } from "lucide-react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

function safeCallbackUrl(value: string | null) {
  if (!value) return "/dashboard";

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return "/dashboard";
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) return "/dashboard";
    return path;
  } catch {
    return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const callbackUrl = safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl"));

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

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-row login-brand">
          <Image
            src="/logos/simpatik-brand.svg"
            alt="Logo Kementerian Keuangan dan DJP"
            width={260}
            height={101}
            priority
            className="login-brand-logo"
          />
        </div>
        <h1>SIMPATIK</h1>
        <p>Sistem Monitoring Terintegrasi Kepatuhan Perpajakan untuk memantau kepatuhan dan tindak lanjut secara terpadu.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Username / Email</span>
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
          Default: <strong>demo</strong> / <strong>demo</strong>.
        </div>
      </section>
    </main>
  );
}
