import DashboardClient from "@/app/dashboard/DashboardClient";
import { getServerLectures } from "../../lib/serverApi";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const readSingle = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const tabParam = readSingle(resolved?.tab);
  const pageParam = Number(readSingle(resolved?.page) ?? "1");
  const initialTab =
    tabParam === "done" || tabParam === "all" || tabParam === "current"
      ? tabParam
      : "current";
  const initialPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  let initialLecturesData = undefined;
  try {
    initialLecturesData = await getServerLectures({
      page: initialPage,
      size: 8,
      status: initialTab,
    });
  } catch {
    initialLecturesData = undefined;
  }

  return (
    <DashboardClient
      initialTab={initialTab}
      initialPage={initialPage}
      initialLecturesData={initialLecturesData}
    />
  );
}
