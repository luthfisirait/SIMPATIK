"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const digest = (error as Error & { digest?: string }).digest;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Data belum bisa ditampilkan</div>
          <div className="card-subtitle">
            Aplikasi berhasil terbuka, tetapi halaman ini belum mendapatkan data yang valid dari database.
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="alert">
          Kemungkinan paling umum: database SQLite masih kosong atau storage sementara ter-reset setelah deploy/cold
          start. Isi data melalui skrip import (npm run import:contoh / import:excel), lalu buka ulang halaman ini.
          {digest ? <div className="muted" style={{ marginTop: 8 }}>Kode diagnostik: {digest}</div> : null}
        </div>
        <div className="data-status-actions">
          <button className="btn btn-primary" type="button" onClick={reset}>
            <RotateCcw size={16} />
            Coba Lagi
          </button>
          <Link className="btn btn-secondary" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
