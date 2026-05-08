import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { previewOpdImportFile } from "@/lib/import-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const formData = await request.formData();
  const dataset = String(formData.get("dataset") ?? "opd");
  const file = formData.get("file");

  if (dataset !== "opd") {
    return NextResponse.json({ message: "Dataset import belum didukung." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File wajib diunggah." }, { status: 400 });
  }

  try {
    const result = await previewOpdImportFile(file);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal membaca file import." },
      { status: 400 },
    );
  }
}
