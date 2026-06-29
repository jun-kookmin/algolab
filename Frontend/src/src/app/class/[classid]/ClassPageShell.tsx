"use client";

import dynamicImport from "next/dynamic";

const ClassPageClient = dynamicImport(() => import("@/app/class/[classid]/ClassPageClient"), {
  ssr: false,
});

export default function ClassPageShell() {
  return <ClassPageClient />;
}
