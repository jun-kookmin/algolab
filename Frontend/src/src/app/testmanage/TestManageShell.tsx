"use client";

import dynamicImport from "next/dynamic";

const TestManageClient = dynamicImport(() => import("@/app/testmanage/TestManageClient"), {
  ssr: false,
});

export default function TestManageShell() {
  return <TestManageClient />;
}
