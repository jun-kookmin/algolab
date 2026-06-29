// app/submission/[memberId]/page.tsx
import SubmissionDetailContent from "@/app/submission/[userid]/components/SubmissionDetailContent";
import MySubmissionDetailContent from "@/app/submission/[userid]/MySubmissionDetailContent";
import {
  getServerExamUserSubmissions,
  getServerHomeworkUserSubmissions,
  getServerUnifiedUserSubmissions,
} from "../../../lib/serverApi";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const readSingle = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export default async function SubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ userid: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};

  const userId = Number(resolvedParams.userid);
  const lectureId = readSingle(resolvedSearch.lid);
  const examId = readSingle(resolvedSearch.examId);
  const rawTab = readSingle(resolvedSearch.tab).toLowerCase();
  const tab = rawTab === "exam" || (!rawTab && examId) ? "EXAM" : "HOMEWORK";
  const name = readSingle(resolvedSearch.name);

  let initialHomeworkData = undefined;
  let initialExamData = undefined;
  let initialUnifiedData = undefined;
  if (lectureId && Number.isFinite(userId)) {
    try {
      if (tab === "EXAM") {
        initialExamData = await getServerExamUserSubmissions(lectureId, userId, examId);
      } else {
        initialHomeworkData = await getServerHomeworkUserSubmissions(lectureId, userId);
      }
    } catch {
      initialHomeworkData = undefined;
      initialExamData = undefined;
    }
  } else if (Number.isFinite(userId)) {
    try {
      initialUnifiedData = await getServerUnifiedUserSubmissions(userId, false);
    } catch {
      initialUnifiedData = undefined;
    }
  }

  return (
    <section className="min-h-full w-full bg-[rgba(237,239,254,1)]">
      <div className="fluid-container pb-20 pt-3">
        {lectureId ? (
          <SubmissionDetailContent
            userId={userId}
            lectureId={lectureId}
            examId={examId}
            tab={tab}
            name={name}
            initialHomeworkData={initialHomeworkData}
            initialExamData={initialExamData}
          />
        ) : (
          <MySubmissionDetailContent
            userId={userId}
            userName={name}
            initialData={initialUnifiedData}
          />
        )}
      </div>
    </section>
  );
}
