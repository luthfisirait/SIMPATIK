import { PenggunaClient } from "@/app/(dashboard)/pengguna/PenggunaClient";
import { listUsers } from "@/lib/queries";

export default function PenggunaPage() {
  const rows = listUsers();

  return <PenggunaClient initialRows={rows} />;
}
