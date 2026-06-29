"use client";

import dynamicImport from "next/dynamic";

const DashboardClient = dynamicImport(() => import("@/app/dashboard/DashboardClient"), {
  ssr: false,
});

export default function DashboardShell() {
  return <DashboardClient />;
}
