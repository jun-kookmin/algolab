import { cookies } from "next/headers";

import { formatDisplayName } from "@/utils/name";

const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL || "http://backend:8000";

type QueryValue = string | number | boolean | null | undefined;

const buildQueryString = (params?: Record<string, QueryValue>): string => {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
};

const serverGetJson = async <T>(
  path: string,
  params?: Record<string, QueryValue>,
): Promise<T> => {
  const target = `${BACKEND_INTERNAL_URL.replace(/\/+$/, "")}${path}${buildQueryString(params)}`;
  const cookieHeader = await getCookieHeader();
  const response = await fetch(target, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Algolab-Client": "web-ssr",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Server API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
};

const serverGetJsonByUrl = async <T>(url: string): Promise<T> => {
  const cookieHeader = await getCookieHeader();
  const target = url.startsWith("http")
    ? url
    : `${BACKEND_INTERNAL_URL.replace(/\/+$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
  const response = await fetch(target, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Algolab-Client": "web-ssr",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Server API request failed: ${response.status} ${url}`);
  }

  return response.json() as Promise<T>;
};

export interface ServerLectureSummary {
  id: string;
  uuid: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  problem_count: number;
  section_count: number;
  lecture_language: number[];
  language?: Array<{ id: number; language_name: string }>;
  curriculum_locked?: boolean;
}

export interface ServerLecturesResponse {
  total: number;
  page?: number;
  size: number;
  data: ServerLectureSummary[];
  lectures: ServerLectureSummary[];
}

export const getServerLectures = async (params: {
  page?: number;
  size?: number;
  all?: boolean;
  status?: "all" | "current" | "done";
} = {}): Promise<ServerLecturesResponse> => {
  const { page = 1, size = 10, all, status } = params;
  const requestStatus = status === "current" ? "active" : status;
  const payload = await serverGetJson<any>("/api/v1/instructor/lectures/", {
    page,
    size,
    ...(all ? { all: "1" } : {}),
    ...(requestStatus ? { status: requestStatus } : {}),
  });

  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.lectures)
      ? payload.lectures
      : [];

  const normalized = items.map((lecture: any) => ({
    ...lecture,
    uuid: String(lecture.uuid ?? lecture.id ?? ""),
    id: String(lecture.uuid ?? lecture.id ?? ""),
    description: String(lecture.description ?? ""),
    language: Array.isArray(lecture.language) ? lecture.language : [],
  }));

  return {
    total: payload?.total ?? normalized.length,
    size: payload?.size ?? normalized.length,
    page: payload?.page,
    data: normalized,
    lectures: normalized,
  };
};

export interface ServerLecture {
  id: string;
  uuid: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  created_date?: string;
  weeks?: number;
  lecture_language?: number[];
  language?: Array<{ id: number; language_name: string }>;
  is_delete?: boolean;
  code?: string;
  curriculum_locked?: boolean;
  server_time?: string;
}

export const getServerLecture = async (
  lectureId: string,
): Promise<ServerLecture> => {
  const payload = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/`,
  );
  const raw =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : payload;
  const uuid = String(raw?.uuid ?? raw?.id ?? "");
  return {
    ...raw,
    uuid,
    id: uuid,
  } as ServerLecture;
};

export interface ServerLectureMember {
  user_id: number;
  name: string;
  role: "PROFESSOR" | "STUDENT";
  joined_at: string;
  full_name?: string;
  student_code?: string;
}

export interface ServerLectureMembersResponse {
  total: number;
  page: number;
  size: number;
  members: ServerLectureMember[];
}

export const getServerLectureMembers = async (
  lectureId: string,
): Promise<ServerLectureMembersResponse> => {
  const payload = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/members/`,
  );
  return {
    total: Number(payload?.total ?? 0),
    page: Number(payload?.page ?? 1),
    size: Number(payload?.size ?? 0),
    members: (Array.isArray(payload?.data) ? payload.data : []).map((member: any) => {
      const rawName = member.full_name ?? member.name ?? "";
      const normalizedName = formatDisplayName(rawName);
      return {
        ...member,
        name: member.name ? formatDisplayName(member.name) : normalizedName,
        full_name: normalizedName,
      };
    }),
  };
};

export interface ServerHomeworkSection {
  id: string;
  uuid: string;
  title: string;
  description?: string;
  problem_count?: number;
  start_date?: string;
  end_date?: string;
}

export interface ServerHomeworksResponse {
  homeworks: ServerHomeworkSection[];
}

export const getServerHomeworks = async (
  lectureId: string,
): Promise<ServerHomeworksResponse> => {
  const payload = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/homework/`,
  );
  const items = Array.isArray(payload?.homeworks) ? payload.homeworks : [];
  return {
    homeworks: items.map((item: any) => ({
      ...item,
      uuid: String(item?.uuid ?? item?.id ?? ""),
      id: String(item?.uuid ?? item?.id ?? ""),
    })),
  };
};

export interface ServerExamItem {
  id: string;
  uuid: string;
  exam_name: string;
  title?: string;
  description?: string;
  problem_count?: number;
  start_date?: string;
  due_date?: string;
}

export interface ServerExamsResponse {
  exam: ServerExamItem[];
  results?: ServerExamItem[];
}

const parseDateMs = (value?: string): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
};

const compareServerExamDesc = (
  a: ServerExamItem,
  b: ServerExamItem,
): number => {
  const startDiff = parseDateMs(b.start_date) - parseDateMs(a.start_date);
  if (startDiff !== 0) return startDiff;

  const dueDiff = parseDateMs(b.due_date) - parseDateMs(a.due_date);
  if (dueDiff !== 0) return dueDiff;

  return String(b.id ?? "").localeCompare(String(a.id ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const pickDateTimeValue = (raw: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
};

export const getServerExams = async (
  lectureId: string,
): Promise<ServerExamsResponse> => {
  const payload = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/exams/`,
  );
  const items = Array.isArray(payload?.exam)
    ? payload.exam
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
  const normalized = items.map((item: any) => {
    const source = item ?? {};
    return {
      ...item,
      uuid: String(source.uuid ?? source.id ?? ""),
      id: String(source.uuid ?? source.id ?? ""),
      start_date: pickDateTimeValue(source, [
        "start_date",
        "startDate",
        "start_at",
        "startAt",
      ]),
      due_date: pickDateTimeValue(source, [
        "due_date",
        "dueDate",
        "due_at",
        "dueAt",
      ]),
    };
  }).sort(compareServerExamDesc);
  return {
    exam: normalized,
    results: normalized,
  };
};

export interface ServerPostUser {
  id?: number;
  username: string;
}

export interface ServerPostItem {
  id: string;
  uuid: string;
  board_uuid: string;
  title: string;
  content?: string;
  user: ServerPostUser;
  user_id?: number;
  created_date: string;
  updated_date?: string;
  problem_uuid: string | null;
  problem_name: string;
  is_noticed?: boolean;
  is_exam_notice?: boolean;
  can_edit: boolean;
  can_open_submission?: boolean;
}

export interface ServerPostListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  data: ServerPostItem[];
  total: number;
}

export const getServerPosts = async (params: {
  class_id?: string;
  class_uuid?: string;
  is_noticed?: boolean;
  page?: number;
  size?: number;
  problem_id?: string;
  problem_uuid?: string;
  exclude_exam_notice?: boolean;
  title?: string;
  author?: string;
  search?: string;
} = {}): Promise<ServerPostListResponse> => {
  const payload = await serverGetJson<any>("/api/v1/instructor/posts/", {
    ...params,
    class_uuid: params.class_uuid ?? params.class_id,
    problem_uuid: params.problem_uuid ?? params.problem_id,
  });
  return {
    ...payload,
    data: (payload?.data ?? []).map((post: any) => ({
      ...post,
      uuid: String(post.uuid ?? post.id ?? ""),
      id: String(post.uuid ?? post.id ?? ""),
      board_uuid: String(post.board_uuid ?? post.board ?? ""),
      user_id:
        typeof post?.user_id === "number"
          ? post.user_id
          : typeof post?.user?.id === "number"
            ? post.user.id
            : undefined,
      problem_uuid: post.problem_uuid ?? post.problem_id ?? null,
      updated_date: post.updated_date,
      is_exam_notice: Boolean(post.is_exam_notice),
      is_noticed: Boolean(post.is_noticed),
      can_open_submission: Boolean(post.can_open_submission),
    })),
  };
};

export interface ServerPostReply {
  id: string;
  reply_content: string;
  user_name: string;
  user_id?: number;
  parent_uuid?: string | null;
  reply_date: string;
  can_edit: boolean;
  can_open_submission?: boolean;
}

export interface ServerPostDetail {
  id: string;
  uuid: string;
  board_uuid: string;
  title: string;
  content: string;
  user_id?: number;
  username: string;
  problem_uuid: string | null;
  problem_name: string | null;
  created_date: string;
  updated_date: string;
  is_noticed?: boolean;
  replies: ServerPostReply[];
  can_edit: boolean;
  can_open_submission?: boolean;
}

export const getServerPostDetail = async (
  postId: string,
  params?: Record<string, QueryValue>,
): Promise<ServerPostDetail> => {
  const data = await serverGetJson<any>(`/api/v1/instructor/posts/${postId}/`, params);
  const uuid = String(data?.uuid ?? data?.id ?? "");
  return {
    ...data,
    uuid,
    id: uuid,
    board_uuid: String(data?.board_uuid ?? data?.board ?? ""),
    user_id:
      typeof data?.user_id === "number"
        ? data.user_id
        : undefined,
    problem_uuid: data?.problem_uuid ?? data?.problem_id ?? null,
    is_noticed: Boolean(data?.is_noticed),
    can_open_submission: Boolean(data?.can_open_submission),
    replies: (data?.replies ?? []).map((reply: any) => ({
      ...reply,
      id: String(reply?.uuid ?? reply?.id ?? ""),
      user_id:
        typeof reply?.user_id === "number"
          ? reply.user_id
          : undefined,
      parent_uuid: reply?.parent_uuid ?? null,
      can_open_submission: Boolean(reply?.can_open_submission),
    })),
  };
};

export const getServerPostReplies = async (
  postId: string,
): Promise<ServerPostReply[]> => {
  const endpoint = `/api/v1/instructor/posts/${postId}/replies/?page=1&size=100`;
  const firstPayload = await serverGetJsonByUrl<any>(endpoint);
  if (Array.isArray(firstPayload)) {
    return firstPayload.map((reply: any) => ({
      ...reply,
      id: String(reply?.uuid ?? reply?.id ?? ""),
      user_id:
        typeof reply?.user_id === "number"
          ? reply.user_id
          : undefined,
      parent_uuid: reply?.parent_uuid ?? null,
      can_open_submission: Boolean(reply?.can_open_submission),
    }));
  }

  const normalizePage = (payload: any): ServerPostReply[] =>
    (Array.isArray(payload?.results) ? payload.results : []).map((reply: any) => ({
      ...reply,
      id: String(reply?.uuid ?? reply?.id ?? ""),
      user_id:
        typeof reply?.user_id === "number"
          ? reply.user_id
          : undefined,
      parent_uuid: reply?.parent_uuid ?? null,
      can_open_submission: Boolean(reply?.can_open_submission),
    }));

  let merged = normalizePage(firstPayload);
  let nextUrl: string | null =
    typeof firstPayload?.next === "string" ? firstPayload.next : null;
  let guard = 0;

  while (nextUrl && guard < 50) {
    guard += 1;
    const nextPayload = await serverGetJsonByUrl<any>(nextUrl);
    merged = merged.concat(normalizePage(nextPayload));
    nextUrl = typeof nextPayload?.next === "string" ? nextPayload.next : null;
  }

  return merged;
};

export interface ServerProblemSummary {
  id: string;
  uuid: string;
  title: string;
}

export const getServerProblemSummary = async (
  problemId: string,
): Promise<ServerProblemSummary> => {
  const payload = await serverGetJson<any>(
    `/api/v1/instructor/problems/${problemId}/`,
  );
  const uuid = String(payload?.uuid ?? payload?.id ?? "");
  return {
    id: uuid,
    uuid,
    title: String(
      payload?.problem_name ?? payload?.problemName ?? payload?.title ?? "",
    ),
  };
};

export interface ServerHomeworkProgressProblem {
  uuid?: string;
  id?: string;
  problem_id: string;
  title: string;
  code: string;
  status: "CORRECT" | "WRONG" | "NOT_SUBMITTED";
  attempt_count: number;
  last_submitted_at: string | null;
  score: number;
  language: number[] | string[];
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

export interface ServerHomeworkUserSubmission {
  user_id?: number;
  name?: string;
  student_number?: string;
  solved_count: number;
  total_count: number;
  problems: ServerHomeworkProgressProblem[];
  language: number[] | string[];
  solved_rate: number;
}

export const getServerHomeworkUserSubmissions = async (
  lectureId: string,
  userId: number,
): Promise<ServerHomeworkUserSubmission> => {
  const data = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/submissions/homework/homework/${userId}/`,
  );

  const problems = (data?.problems ?? [])
    .map((problem: any) => ({
      id: problem?.uuid ? String(problem.uuid) : undefined,
      uuid: problem?.uuid ? String(problem.uuid) : undefined,
      problem_id: String(problem?.section_problem_uuid ?? problem?.problem_uuid ?? ""),
      title: String(problem?.title ?? ""),
      code: String(problem?.code ?? ""),
      status: String(problem?.status ?? ""),
      score: Number(problem?.score ?? 0),
      attempt_count: Number(problem?.attempt_count ?? 0),
      last_submitted_at: problem?.last_submitted_at ?? null,
      language: problem?.language ?? [],
      execution_time: Number(problem?.execution_time ?? 0),
      submission_time: String(problem?.submission_time ?? ""),
      memory: Number(problem?.memory ?? 0),
      code_length: Number(problem?.code_length ?? 0),
    }))
    .sort((a: ServerHomeworkProgressProblem, b: ServerHomeworkProgressProblem) =>
      a.problem_id.localeCompare(b.problem_id)
    );

  return {
    user_id: data?.user_id ?? userId,
    name: formatDisplayName(data?.name ?? ""),
    language: data?.language ?? [],
    student_number: String(data?.student_number ?? ""),
    solved_count: Number(data?.solved_count ?? 0),
    total_count: Number(data?.total_count ?? 0),
    problems,
    solved_rate:
      Number(data?.total_count ?? 0) > 0
        ? Number(data?.solved_count ?? 0) / Number(data?.total_count ?? 1)
        : 0,
  };
};

export interface ServerExamUserSubmission {
  user_id?: number;
  name?: string;
  student_number?: string;
  solved_count: number;
  total_count: number;
  problems: ServerHomeworkProgressProblem[];
  language: number[] | string[];
  solved_rate: number;
}

const isUuidLike = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

export const getServerExamUserSubmissions = async (
  lectureId: string,
  userId: number,
  examId?: string,
): Promise<ServerExamUserSubmission> => {
  const params: Record<string, QueryValue> = {};
  if (examId) {
    if (isUuidLike(examId)) {
      params.exam_uuid = examId;
    } else {
      params.exam_id = examId;
    }
  }

  const data = await serverGetJson<any>(
    `/api/v1/instructor/lectures/${lectureId}/submissions/exam/exam/${userId}/`,
    params,
  );

  const problems = (data?.problems ?? [])
    .map((problem: any) => ({
      id: problem?.uuid ? String(problem.uuid) : undefined,
      uuid: problem?.uuid ? String(problem.uuid) : undefined,
      problem_id: String(problem?.section_problem_uuid ?? problem?.problem_uuid ?? ""),
      title: String(problem?.title ?? ""),
      code: String(problem?.code ?? ""),
      status: String(problem?.status ?? ""),
      score: Number(problem?.score ?? 0),
      attempt_count: Number(problem?.attempt_count ?? 0),
      last_submitted_at: problem?.last_submitted_at ?? null,
      language: problem?.language ?? [],
      execution_time: Number(problem?.execution_time ?? 0),
      submission_time: String(problem?.submission_time ?? ""),
      memory: Number(problem?.memory ?? 0),
      code_length: Number(problem?.code_length ?? 0),
    }))
    .sort((a: ServerHomeworkProgressProblem, b: ServerHomeworkProgressProblem) =>
      a.problem_id.localeCompare(b.problem_id)
    );

  return {
    user_id: data?.user_id ?? userId,
    name: formatDisplayName(data?.name ?? ""),
    language: data?.language ?? [],
    student_number: String(data?.student_number ?? ""),
    solved_count: Number(data?.solved_count ?? 0),
    total_count: Number(data?.total_count ?? 0),
    problems,
    solved_rate:
      Number(data?.total_count ?? 0) > 0
        ? Number(data?.solved_count ?? 0) / Number(data?.total_count ?? 1)
        : 0,
  };
};

export interface ServerMe {
  pk: number;
  username: string;
  first_name: string;
  last_name: string;
  group: string;
}

export const getServerMe = async (): Promise<ServerMe> => {
  const data = await serverGetJson<any>("/api/auth/user/");
  return {
    pk: Number(data?.pk ?? 0),
    username: String(data?.username ?? ""),
    first_name: String(data?.first_name ?? ""),
    last_name: String(data?.last_name ?? ""),
    group: String(data?.group ?? ""),
  };
};

export interface ServerUnifiedSubmission {
  id: string;
  uuid: string;
  username?: string;
  student_number?: string;
  display_name?: string;
  problem_id: string;
  problem_uuid?: string;
  exam_problem_uuid?: string;
  exam_problem_id?: string | number;
  title: string;
  score: number;
  attempt_count: number;
  ju_count?: number;
  status: string;
  language: (number | null)[];
  code: string;
  execution_time: number;
  submission_time: string;
  memory: number;
  code_length: number;
}

export const getServerUnifiedUserSubmissions = async (
  userId: number,
  includeCode = false,
): Promise<ServerUnifiedSubmission[]> => {
  const data = await serverGetJson<any[]>(
    `/api/v1/instructor/submissions/user/${userId}/`,
    includeCode ? undefined : { include_code: 0 },
  );
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    ...row,
    id: String(row?.uuid ?? row?.id ?? ""),
    uuid: String(row?.uuid ?? row?.id ?? ""),
    username:
      row?.username != null ? String(row.username) : undefined,
    student_number:
      row?.student_number != null ? String(row.student_number) : undefined,
    display_name:
      row?.display_name != null ? String(row.display_name) : undefined,
    problem_id: String(row?.problem_uuid ?? row?.problem_id ?? ""),
    problem_uuid:
      row?.problem_uuid != null ? String(row.problem_uuid) : undefined,
    exam_problem_uuid:
      row?.exam_problem_uuid != null ? String(row.exam_problem_uuid) : undefined,
    exam_problem_id: row?.exam_problem_id ?? undefined,
    title: String(row?.title ?? ""),
    score: Number(row?.score ?? 0),
    attempt_count: Number(row?.attempt_count ?? 0),
    ju_count:
      row?.ju_count == null ? undefined : Number(row?.ju_count ?? 0),
    status: String(row?.status ?? ""),
    language: Array.isArray(row?.language) ? row.language : [],
    code: String(row?.code ?? ""),
    execution_time: Number(row?.execution_time ?? 0),
    submission_time: String(row?.submission_time ?? ""),
    memory: Number(row?.memory ?? 0),
    code_length: Number(row?.code_length ?? 0),
  }));
};
