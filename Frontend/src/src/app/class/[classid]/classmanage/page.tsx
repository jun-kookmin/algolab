import ClassManageClient from "@/app/class/[classid]/classmanage/ClassManageClient";
import {
  getServerLecture,
  getServerLectureMembers,
} from "../../../../lib/serverApi";

export const dynamic = "force-dynamic";

export default async function ClassManagePage({
  params,
}: {
  params: Promise<{ classid: string }>;
}) {
  const { classid } = await params;

  let initialLecture = undefined;
  let initialMembers = undefined;

  try {
    initialLecture = await getServerLecture(classid);
  } catch {
    initialLecture = undefined;
  }

  try {
    initialMembers = await getServerLectureMembers(classid);
  } catch {
    initialMembers = undefined;
  }

  return (
    <ClassManageClient
      initialLecture={initialLecture}
      initialMembers={initialMembers}
    />
  );
}
