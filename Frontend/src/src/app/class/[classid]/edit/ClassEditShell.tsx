"use client";

import dynamicImport from "next/dynamic";

const ClassEditClient = dynamicImport(() => import("@/app/class/[classid]/edit/ClassEditClient"), {
  ssr: false,
});

export default function ClassEditShell() {
  return <ClassEditClient />;
}
