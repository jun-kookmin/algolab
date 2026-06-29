import StudentDashboardClient from "@/app/studentdashboard/StudentDashboardClient";
import { getServerLectures } from "../../lib/serverApi";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const readSingle = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const page = Number(readSingle(resolvedSearch.page)) || 1;

  let initialData = undefined;
  try {
    initialData = await getServerLectures({ page, size: 8 });
  } catch {
    initialData = undefined;
  }

  return <StudentDashboardClient initialData={initialData} />;
}
