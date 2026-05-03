"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Halaman gagal dimuat</div>
          <div className="card-subtitle">{error.message || "Terjadi masalah saat memproses data."}</div>
        </div>
      </div>
      <div className="card-body">
        <button className="btn btn-primary" type="button" onClick={reset}>
          <RotateCcw size={16} />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
