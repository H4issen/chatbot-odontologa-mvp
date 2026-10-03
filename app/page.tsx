// app/page.tsx — redirige la raíz al login (fix criterio 1 T-46)
import { redirect } from "next/navigation";

export default function RootPage(): never {
  redirect("/login");
}
