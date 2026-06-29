import ClassPageClient from "@/app/class/[classid]/ClassPageClient";
import {
  getServerExams,
  getServerHomeworks,
  getServerLecture,
} from "../../../lib/serverApi";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ classid: string }>;
}) {
  const { classid } = await params;

  let initialLecture = undefined;
  let initialHomeworks = undefined;
  let initialExams = undefined;

  try {
    initialLecture = await getServerLecture(classid);
  } catch {
    initialLecture = undefined;
  }

  try {
    const homeworkData = await getServerHomeworks(classid);
    initialHomeworks = homeworkData.homeworks;
  } catch {
    initialHomeworks = undefined;
  }

  try {
    const examData = await getServerExams(classid);
    initialExams = examData.exam;
  } catch {
    initialExams = undefined;
  }

  return (
    <ClassPageClient
      initialLecture={initialLecture}
      initialHomeworks={initialHomeworks}
      initialExams={initialExams}
    />
  );
}
