import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { analyzeSheets, buildTemplateBuffer, isTemplateKey, parseWorkbook } from "@/lib/import-data";
import { commitImportData } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const template = new URL(request.url).searchParams.get("template");
  if (!isTemplateKey(template)) {
    return NextResponse.json({ message: "Jenis template tidak dikenal." }, { status: 400 });
  }

  const buffer = await buildTemplateBuffer(template);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-simpatik-${template}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Payload harus berupa form-data dengan file Excel." }, { status: 400 });
  }

  const file = form.get("file");
  const mode = String(form.get("mode") ?? "preview");
  const template = String(form.get("template") ?? "");

  if (!isTemplateKey(template)) {
    return NextResponse.json({ message: "Pilih jenis template terlebih dahulu." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File Excel wajib diunggah." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ message: "File kosong." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "Ukuran file melebihi 10 MB." }, { status: 413 });
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ message: "Format harus .xlsx." }, { status: 415 });
  }

  let payload;
  let analysis;
  try {
    const sheets = await parseWorkbook(await file.arrayBuffer());
    ({ payload, analysis } = analyzeSheets(sheets, template));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? `Gagal membaca file: ${error.message}` : "Gagal membaca file." },
      { status: 400 },
    );
  }

  if (analysis.totalRows === 0) {
    return NextResponse.json(
      { message: "Tidak ada data yang dapat diimpor dari file ini.", analysis },
      { status: 422 },
    );
  }

  if (mode === "preview") {
    return NextResponse.json({ mode: "preview", analysis });
  }

  try {
    const result = await commitImportData(template, payload, {
      id: auth.session?.user.id,
      name: auth.session?.user.name,
    });
    return NextResponse.json({ mode: "commit", analysis, result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal menyimpan data import." },
      { status: 500 },
    );
  }
}
