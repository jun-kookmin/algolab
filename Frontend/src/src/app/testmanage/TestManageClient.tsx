// ──── FILE: app/test-manage/page.tsx ────
"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StudentListRenderer from "@/components/testManage/StudentListRenderer";
import InProgressListRenderer from "@/components/testManage/InProgressListRenderer";
import CompletedListRenderer from "@/components/testManage/CompletedListRenderer";
import { useGetLectures } from "@/hooks/lectures/Get/useGetLectures";
import { useGetExams } from "@/hooks/lectures/Get/useGetExams";
import { useGetExamSubmissions } from "@/hooks/problems/get/exam/useGetExamSubmissions";
import { buildProctorGroups } from "@/components/testManage/proctorUtils";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import { usePostPost } from "@/hooks/board/Post/usePostPost";
import { usePutPost } from "@/hooks/board/Put/usePutPost";
import { usePostExamUnlock } from "@/hooks/solve/exam/POST/usePostExamUnlock";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import BaseApi from "@/utils/api";
import { useGetExam } from "@/hooks/lectures/Get/useGetExam";
import useExamNoticeToasts, {
  type NoticePost,
} from "@/hooks/board/useExamNoticeToast";
import { usePatchExam } from "@/hooks/lectures/Update/usePatchExam";
import { validateDateTimeRange } from "@/utils/dateTimeLocal";

const formatNoticeDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

const NOTICE_TAG_RE = /^\[시험공지:([0-9a-f-]{36})\]\s*/i;

const stripNoticePrefix = (title?: string | null): string => {
  return ((title ?? "").replace(NOTICE_TAG_RE, "") || "시험 공지").trim();
};

type ExamDateSource = {
  start_date?: string | null;
  due_date?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
};

const toDatetimeInputValue = (value?: string | null): string => {
  if (!value) return "";
  const directMatch = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const resolveExamDate = (exam: ExamDateSource | undefined | null, key: "start" | "due") => {
  const startDate = exam?.start_date ?? exam?.startDate ?? exam?.start_at ?? exam?.startAt;
  const dueDate = exam?.due_date ?? exam?.dueDate ?? exam?.due_at ?? exam?.dueAt;
  return toDatetimeInputValue(key === "start" ? startDate : dueDate);
};

const buildNoticePayloadTitle = (examId: string, title: string): string => {
  const trimmed = title.trim();
  return `[시험공지:${examId}] ${trimmed || "시험 공지"}`;
};

/* -------------------- 페이지 -------------------- */
const TestManagePage: React.FC = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const lectureParam =
        searchParams.get("lectureId") ||
        searchParams.get("lecture_uuid") ||
        searchParams.get("lecture") ||
        "";
    const examParam =
        searchParams.get("examId") ||
        searchParams.get("exam_uuid") ||
        searchParams.get("exam") ||
        "";

    const [showAbsent, setShowAbsent] = useState(false);
    const [selectedLectureId, setSelectedLectureId] = useState<string>(lectureParam);
    const [selectedExamId, setSelectedExamId] = useState<string>(examParam);
    const { me } = useAuth();
    const group = me?.group?.toLowerCase() ?? "";
    const canUnlock = group === "administrator" || group === "professor";
    const queryClient = useQueryClient();
    const isAdmin = (me?.group ?? "").toLowerCase() === "administrator";

    const { data: lecturesData } = useGetLectures(
        {
            all: isAdmin,
            page: 1,
            size: 200,
        },
        { enabled: !!me }
    );
    const lectures = lecturesData?.data ?? [];

    const lectureDetail = useMemo(
        () => lectures.find((lec) => lec.id === selectedLectureId),
        [lectures, selectedLectureId]
    );

    const { data: exams = [] } = useGetExams(selectedLectureId);
    const examOptions = useMemo(() => exams ?? [], [exams]);

    const selectedExamName = useMemo(
      () =>
        examOptions.find((exam) => exam.id === selectedExamId)?.exam_name ??
        examOptions.find((exam) => exam.id === selectedExamId)?.title ??
        "시험",
      [examOptions, selectedExamId]
    );
    const selectedExam = useMemo(
      () => examOptions.find((exam) => exam.id === selectedExamId),
      [examOptions, selectedExamId]
    );
    const [examStartDateTime, setExamStartDateTime] = useState("");
    const [examDueDateTime, setExamDueDateTime] = useState("");

    const [noticeTitle, setNoticeTitle] = useState(
      `시험 공지 (${selectedExamName})`
    );
    const [noticeContent, setNoticeContent] = useState("");
  const [editingNoticeUuid, setEditingNoticeUuid] = useState<string | null>(null);
  const [editingNoticeTitle, setEditingNoticeTitle] = useState("");
  const [editingNoticeContent, setEditingNoticeContent] = useState("");
  const [isEditingNoticeLoading, setIsEditingNoticeLoading] = useState(false);
  const editingNoticeRequestId = useRef<string | null>(null);
  const noticeSubmittingRef = useRef(false);
  const hasInitializedSelectionFromStorage = useRef(false);
  const { mutate: postNotice, isPending: isPostingNotice } = usePostPost();
    const { mutate: updateNotice, isPending: isUpdatingNotice } = usePutPost();
    const showExamNotice = !!selectedLectureId && !!selectedExamId;
    const {
      notices: examNotices,
    } = useExamNoticeToasts({
      lectureId: selectedLectureId,
      examId: selectedExamId,
      enabled: showExamNotice,
      pollIntervalMs: 7000,
      maxItems: 10,
    });
    const noticePanelStorageKey = `testManageNoticePanelOpen:${selectedLectureId || "none"}:${selectedExamId || "none"}`;
    const [showNoticePanel, setShowNoticePanel] = useState(() => {
      if (typeof window === "undefined") return false;
      const stored = window.localStorage.getItem(noticePanelStorageKey);
      if (!stored) return false;
      return stored === "1";
    });

    useEffect(() => {
      if (typeof window === "undefined") return;
      if (!showExamNotice) {
        setShowNoticePanel(false);
        return;
      }
      const stored = window.localStorage.getItem(noticePanelStorageKey);
      if (!stored) {
        setShowNoticePanel(false);
        return;
      }
      setShowNoticePanel(stored === "1");
    }, [showExamNotice, noticePanelStorageKey]);

    useEffect(() => {
      if (!showExamNotice || !selectedLectureId || !selectedExamId) return;
      if (typeof window === "undefined") return;
      window.localStorage.setItem(noticePanelStorageKey, showNoticePanel ? "1" : "0");
    }, [showNoticePanel, showExamNotice, selectedLectureId, selectedExamId, noticePanelStorageKey]);

    const syncQuery = useCallback(
      (nextLectureId: string, nextExamId: string) => {
        const params = new URLSearchParams();
        if (nextLectureId) {
          params.set("lectureId", nextLectureId);
        }
        if (nextExamId) {
          params.set("examId", nextExamId);
        }
        const nextSearch = params.toString();
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
          scroll: false,
        });
      },
      [pathname, router]
    );

    useEffect(() => {
      setNoticeTitle(`시험 공지 (${selectedExamName})`);
    }, [selectedExamName]);

    useEffect(() => {
      setEditingNoticeUuid(null);
      setEditingNoticeTitle("");
      setEditingNoticeContent("");
    }, [selectedLectureId, selectedExamId]);

    useEffect(() => {
        const hasQueryLecture = !!lectureParam;
        const hasQueryExam = !!examParam;

        if (hasQueryLecture || hasQueryExam) {
          if (hasQueryLecture && lectureParam !== selectedLectureId) {
            setSelectedLectureId(lectureParam);
          }
          if (hasQueryExam) {
            if (examParam !== selectedExamId) {
              setSelectedExamId(examParam);
            }
          } else if (selectedExamId !== "") {
            setSelectedExamId("");
          }
          return;
        }

        if (typeof window === "undefined" || hasInitializedSelectionFromStorage.current) {
          return;
        }
        hasInitializedSelectionFromStorage.current = true;

        const savedLecture = window.localStorage.getItem("testManage:lastLectureId") ?? "";
        if (savedLecture) {
          if (savedLecture !== selectedLectureId) {
            setSelectedLectureId(savedLecture);
          }
          const savedExam =
            window.localStorage.getItem(`testManage:lastExamId:${savedLecture}`) ?? "";
          if (savedExam && savedExam !== selectedExamId) {
            setSelectedExamId(savedExam);
          }
        }
    }, [lectureParam, examParam]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!selectedLectureId) return;
        window.localStorage.setItem("testManage:lastLectureId", selectedLectureId);
        if (selectedExamId) {
            window.localStorage.setItem(
                `testManage:lastExamId:${selectedLectureId}`,
                selectedExamId
            );
        }
    }, [selectedLectureId, selectedExamId]);

    useEffect(() => {
        if (!selectedLectureId) {
            if (selectedExamId) {
                setSelectedExamId("");
                syncQuery("", "");
            }
            return;
        }
        if (selectedExamId && examOptions.length > 0) {
            const exists = examOptions.some((exam) => exam.id === selectedExamId);
            if (!exists) {
                setSelectedExamId("");
                syncQuery(selectedLectureId, "");
            }
        }
    }, [selectedLectureId, selectedExamId, examOptions, syncQuery]);

    useEffect(() => {
      if (!selectedLectureId || lectures.length === 0) {
        return;
      }
      const exists = lectures.some((lec) => lec.id === selectedLectureId);
      if (!exists) {
        setSelectedLectureId("");
        setSelectedExamId("");
        syncQuery("", "");
      }
    }, [lectures, selectedLectureId, syncQuery]);

    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
      const timer = setInterval(() => setNowMs(Date.now()), 10000);
      return () => clearInterval(timer);
    }, []);

    const canLoadSubmissions = !!selectedLectureId && !!selectedExamId;
    const { data: examSubmissions } = useGetExamSubmissions(
        selectedLectureId,
        selectedExamId,
        canLoadSubmissions,
        {
          lite: true,
          refetchIntervalMs: canLoadSubmissions ? 5_000 : false,
        }
    );
    const { data: examDetail } = useGetExam(selectedLectureId, selectedExamId, {
        enabled: !!selectedLectureId && !!selectedExamId,
    });
    const {
      mutate: unlockExam,
      mutateAsync: unlockExamAsync,
      isPending: isUnlockingExam,
    } = usePostExamUnlock();
    const [isBulkUnlocking, setIsBulkUnlocking] = useState(false);
    const { mutate: patchExam, isPending: isPatchingExam } = usePatchExam(
      selectedLectureId,
      selectedExamId
    );

    const resolvedSelectedExam = useMemo<ExamDateSource>(() => {
      const listSource = selectedExam as unknown as ExamDateSource | undefined;
      const detailSource = examDetail as unknown as ExamDateSource | undefined;

      return {
        start_date:
          listSource?.start_date ??
          listSource?.startDate ??
          listSource?.start_at ??
          listSource?.startAt ??
          detailSource?.start_date ??
          detailSource?.startDate ??
          detailSource?.start_at ??
          detailSource?.startAt ??
          "",
        due_date:
          listSource?.due_date ??
          listSource?.dueDate ??
          listSource?.due_at ??
          listSource?.dueAt ??
          detailSource?.due_date ??
          detailSource?.dueDate ??
          detailSource?.due_at ??
          detailSource?.dueAt ??
          "",
        startDate: listSource?.startDate ?? detailSource?.startDate,
        dueDate: listSource?.dueDate ?? detailSource?.dueDate,
        start_at: listSource?.start_at ?? detailSource?.start_at,
        due_at: listSource?.due_at ?? detailSource?.due_at,
        startAt: listSource?.startAt ?? detailSource?.startAt,
        dueAt: listSource?.dueAt ?? detailSource?.dueAt,
      };
    }, [selectedExam, examDetail]);

    const examProblemIds = useMemo(
        () => (examSubmissions?.problem_ids ?? []).map((p) => String(p ?? "")),
        [examSubmissions?.problem_ids]
    );

    const { notStarted, inProgress, completed } = useMemo(() => {
        const dueDateMs = Date.parse(resolvedSelectedExam.due_date ?? "");
        const isExamFinished =
          Number.isFinite(dueDateMs) && nowMs >= dueDateMs;
        return buildProctorGroups(examSubmissions?.data ?? [], examProblemIds, {
          examFinished: isExamFinished,
        });
    }, [examSubmissions?.data, examProblemIds, nowMs, resolvedSelectedExam.due_date]);

    const total = notStarted.length + inProgress.length + completed.length;
    const unlockableCompletedUsers = useMemo(
      () =>
        completed
          .filter((item) => !!item.finishedByUser)
          .map((item) => item.userId)
          .filter(
            (userId): userId is string =>
              typeof userId === "string" && userId.trim().length > 0
          ),
      [completed]
    );

    useEffect(() => {
      const nextStart = resolveExamDate(resolvedSelectedExam, "start");
      const nextDue = resolveExamDate(resolvedSelectedExam, "due");
      setExamStartDateTime(nextStart);
      setExamDueDateTime(nextDue);
    }, [resolvedSelectedExam]);

    const handleUnlock = (userId?: string) => {
      if (!canUnlock || !selectedExamId || !userId) return;
      if (!window.confirm("해당 학생의 시험 종료 상태를 해제하시겠습니까?")) return;
      unlockExam(
        { examId: selectedExamId, userId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ["examSubmissions", selectedLectureId, selectedExamId],
            });
            toast.success("시험 종료 상태가 해제되었습니다.");
          },
          onError: (err) => {
            toast.error((err as Error).message || "시험 해제에 실패했습니다.");
          },
        }
      );
    };

    const handleBulkUnlock = async () => {
      if (!canUnlock || !selectedExamId) return;
      if (unlockableCompletedUsers.length === 0) {
        toast.info("해제 가능한 학생이 없습니다.");
        return;
      }
      const confirmMessage = `시험 종료 상태를 전체 해제하시겠습니까? (총 ${unlockableCompletedUsers.length}명)`;
      if (!window.confirm(confirmMessage)) return;

      setIsBulkUnlocking(true);
      let successCount = 0;
      let failCount = 0;

      for (const userId of unlockableCompletedUsers) {
        try {
          await unlockExamAsync({ examId: selectedExamId, userId });
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["examSubmissions", selectedLectureId, selectedExamId],
      });

      if (failCount === 0) {
        toast.success(`${successCount}명의 시험 종료 상태가 해제되었습니다.`);
      } else if (successCount === 0) {
        toast.error("일괄 해제에 실패했습니다.");
      } else {
        toast.warn(`${successCount}명 성공, ${failCount}명 실패`);
      }
      setIsBulkUnlocking(false);
    };

    const sendNotice = () => {
      if (noticeSubmittingRef.current || isPostingNotice) return;

      if (!selectedLectureId) {
        toast.error("강의를 먼저 선택해 주세요.");
        return;
      }
      if (!selectedExamId) {
        toast.error("시험을 먼저 선택해 주세요.");
        return;
      }
      const title = noticeTitle.trim() || "시험 공지";
      const content = noticeContent.trim();
      if (!content) {
        toast.error("공지 내용을 입력해 주세요.");
        return;
      }

      noticeSubmittingRef.current = true;
      postNotice(
        {
          class_uuid: selectedLectureId,
          title: buildNoticePayloadTitle(selectedExamId, title),
          is_noticed: true,
          content,
        },
        {
          onSuccess: () => {
            toast.success("시험 공지를 등록했습니다.");
            setNoticeContent("");
          },
          onError: () => {
            // console.error("시험 공지 등록 실패:", err?.response?.data ?? err);
            toast.error("공지 등록 중 오류가 발생했습니다.");
          },
          onSettled: () => {
            noticeSubmittingRef.current = false;
          },
        }
      );
    };

    const startEditNotice = (notice: NoticePost) => {
      const targetUuid = notice.uuid;
      const fallbackTitle = stripNoticePrefix(notice.raw_title ?? notice.title);
      setEditingNoticeUuid(targetUuid);
      setEditingNoticeTitle(fallbackTitle);
      editingNoticeRequestId.current = targetUuid;
      if (notice.content != null) {
        setEditingNoticeContent(notice.content);
        setIsEditingNoticeLoading(false);
        return;
      }

      setIsEditingNoticeLoading(true);
      setEditingNoticeContent("");
      editingNoticeRequestId.current = targetUuid;

      BaseApi.get(`/instructor/posts/${targetUuid}/`)
        .then(({ data }) => {
          if (editingNoticeRequestId.current !== targetUuid) return;
          setEditingNoticeContent((data?.content ?? "").toString());
        })
        .catch(() => {
          if (editingNoticeRequestId.current !== targetUuid) return;
          // console.error("공지 상세 조회 실패:", err);
          toast.error("공지 내용을 불러오지 못해 빈 값으로 편집합니다.");
        })
        .finally(() => {
          if (editingNoticeRequestId.current === targetUuid) {
            setIsEditingNoticeLoading(false);
          }
        });
    };

    const cancelEditNotice = () => {
      setEditingNoticeUuid(null);
      setEditingNoticeTitle("");
      setEditingNoticeContent("");
      setIsEditingNoticeLoading(false);
      editingNoticeRequestId.current = null;
    };

    const saveEditNotice = () => {
      if (!selectedExamId) {
        toast.error("시험을 먼저 선택해 주세요.");
        return;
      }
      if (!editingNoticeUuid) return;
      const title = editingNoticeTitle.trim() || "시험 공지";
      const content = editingNoticeContent.trim();
      if (!content) {
        toast.error("공지 내용을 입력해 주세요.");
        return;
      }

      updateNotice(
        {
          postUuid: editingNoticeUuid,
          payload: {
            title: buildNoticePayloadTitle(selectedExamId, title),
            content,
            is_noticed: true,
          },
        },
        {
          onSuccess: () => {
            toast.success("시험 공지를 수정했습니다.");
            cancelEditNotice();
          },
          onError: () => {
            // console.error("시험 공지 수정 실패:", err?.response?.data ?? err);
            toast.error("시험 공지 수정 중 오류가 발생했습니다.");
          },
        }
      );
    };

    const handleSaveExamSchedule = () => {
      if (!selectedLectureId || !selectedExamId) {
        toast.error("강의와 시험을 먼저 선택해 주세요.");
        return;
      }
      if (!examStartDateTime || !examDueDateTime) {
        toast.error("시작 시간과 종료 시간을 모두 입력해 주세요.");
        return;
      }

      const validation = validateDateTimeRange(examStartDateTime, examDueDateTime);
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }

      const toastID = toast.info("시험 시간을 저장 중입니다...");
      patchExam(
        {
          start_date: examStartDateTime,
          due_date: examDueDateTime,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["exams", selectedLectureId] });
            queryClient.invalidateQueries({
              queryKey: ["exam", selectedLectureId, selectedExamId],
              exact: true,
            });
            toast.success("시험 시간이 수정되었습니다.");
          },
          onError: () => {
            toast.error("시험 시간 수정에 실패했습니다.");
          },
          onSettled: () => {
            toast.dismiss(toastID);
          },
        }
      );
    };

    return (
        <div className="w-full min-h-0 overflow-y-auto">
            <section className="fluid-container flex min-h-0 flex-col bg-white pt-3 pb-6">
            {/* 과목 정보 */}
            <div className="font-kr mb-3 pt-[2px] text-sm font-bold text-indigo-700">
                {lectureDetail?.name ?? "시험 감독"}
            </div>
            <div className="h-px shadow bg-gray-200" />

            {/* 헤더: 제목 + 통계 + 미응시 버튼 */}
            <div className="mb-3 flex flex-col gap-3 pt-10 lg:flex-row lg:items-start lg:justify-between lg:gap-2">
                <div>
                    <h1 className="font-kr mb-2 text-4xl font-bold text-gray-800">시험 감독 페이지</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500 lg:mt-0">
                        <select
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                            value={selectedLectureId}
                            onChange={(e) => {
                                const nextLectureId = e.target.value;
                                setSelectedLectureId(nextLectureId);
                                setSelectedExamId("");
                                setShowAbsent(false);
                                syncQuery(nextLectureId, "");
                            }}
                        >
                            <option value="" disabled>
                                강의 선택
                            </option>
                            {lectures.map((lec) => (
                                <option key={lec.id} value={lec.id}>
                                    {lec.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                            value={selectedExamId}
                            onChange={(e) => {
                                const nextExamId = e.target.value;
                                setSelectedExamId(nextExamId);
                                setShowAbsent(false);
                                syncQuery(selectedLectureId, nextExamId);
                            }}
                            disabled={!selectedLectureId}
                        >
                            <option value="" disabled>
                                시험 선택
                            </option>
                            {examOptions.map((exam) => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.exam_name ?? exam.title ?? "시험"}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 오른쪽 정렬 영역 */}
                <div className="flex items-center gap-4 font-kr text-sm font-medium lg:ml-auto">
                    <button
                        onClick={() => setShowAbsent((p) => !p)}
                        className="bg-[rgba(78,97,246,1)] text-white px-[12px] py-[8px] rounded-[12px] hover:bg-[#3745AF]"
                    >
                        미응시&nbsp;{notStarted.length}
                    </button>
                    <span>응시 대상자 수&nbsp;: {total}</span>
                </div>
            </div>

            {selectedLectureId && selectedExamId && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <h2 className="font-kr text-base font-semibold text-blue-900">
                        시험 기간 수정
                    </h2>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <label className="text-sm text-blue-900">시작</label>
                        <input
                            type="datetime-local"
                            value={examStartDateTime}
                            onChange={(e) => setExamStartDateTime(e.target.value)}
                            className="rounded border border-blue-300 bg-white px-2 py-1 text-sm"
                        />
                        <span className="text-gray-500">~</span>
                        <label className="text-sm text-blue-900">종료</label>
                        <input
                            type="datetime-local"
                            value={examDueDateTime}
                            onChange={(e) => setExamDueDateTime(e.target.value)}
                            className="rounded border border-blue-300 bg-white px-2 py-1 text-sm"
                        />
                        <button
                            onClick={handleSaveExamSchedule}
                            disabled={isPatchingExam}
                            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {isPatchingExam ? "저장 중..." : "시험 기간 저장"}
                        </button>
                    </div>
                </div>
            )}

            {/* 본문: (미응시 1/6) (응시 중 2/6) (응시 완료 3/6) */}
            {!canLoadSubmissions ? (
                <div className="mt-2 flex min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
                    강의와 시험을 선택해 주세요.
                </div>
            ) : (
                <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                    <div className="flex h-full min-h-0 w-full flex-col gap-4 lg:flex-row">
                    {/* ── 미응시 (1/6) ── */}
                    {showAbsent && (
                        <div className="flex h-full min-h-0 w-full flex-col rounded-lg border border-gray-200 bg-white lg:w-auto lg:flex-[1] lg:border-r">
                            <h2 className="font-kr px-6 pt-1 text-xl font-semibold mb-4">
                                미응시({notStarted.length})
                            </h2>
                            <div className="flex-1 overflow-auto">
                                <StudentListRenderer
                                    items={notStarted}
                                    lectureId={selectedLectureId}
                                    examId={selectedExamId}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 응시 중 (2/6) ── */}
                    <div className={`flex h-full min-h-0 w-full flex-col border border-gray-200 bg-white lg:w-auto lg:flex-1 lg:border-r ${showAbsent ? "" : "lg:rounded-l-lg"} ${showAbsent ? "lg:rounded-br-lg" : ""}`}>
                        <h2 className="font-kr px-6 pt-1 text-xl font-semibold mb-4">
                            응시 중({inProgress.length})
                        </h2>
                        <div className="flex-1 overflow-auto">
                            <InProgressListRenderer
                                items={inProgress}
                                lectureId={selectedLectureId}
                                examId={selectedExamId}
                            />
                        </div>
                    </div>

                    {/* ── 응시 완료 (3/6) ── */}
                    <div className={`flex h-full min-h-0 w-full flex-col border border-gray-200 bg-white lg:w-auto lg:flex-1 ${showAbsent ? "" : "lg:rounded-r-lg"} ${showAbsent ? "" : "lg:border-gray-200"}`}>
                        <div className="flex items-center justify-between px-6 pt-1 text-xl font-semibold">
                            <h2 className="font-kr">
                            응시 완료({completed.length})
                            </h2>
                            {canUnlock && unlockableCompletedUsers.length > 0 ? (
                              <button
                                type="button"
                                onClick={handleBulkUnlock}
                                disabled={isUnlockingExam || isBulkUnlocking}
                                className="rounded mt-1 bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {isBulkUnlocking
                                  ? "일괄 해제 중..."
                                  : "시험 종료 상태 전체 해제"}
                              </button>
                            ) : null}
                        </div>
                        <div className="flex-1 overflow-auto">
                                <CompletedListRenderer
                                    items={completed}
                                    lectureId={selectedLectureId}
                                    examId={selectedExamId}
                                    canUnlock={canUnlock}
                                    onUnlock={(item) => handleUnlock(item.userId)}
                                />
                            </div>
                    </div>
                    </div>
                </div>
            )}

            {selectedLectureId && selectedExamId && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <h2 className="font-kr text-base font-semibold text-amber-900">
                        시험 중 공지 알림
                    </h2>
                    <p className="mb-2 text-xs text-amber-800">
                        작성한 공지는 해당 과목의 시험 페이지에서 공지 목록으로 실시간 노출됩니다.
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                        <input
                            className="w-full rounded border border-amber-300 px-2 py-1 text-sm"
                            value={noticeTitle}
                            onChange={(e) => setNoticeTitle(e.target.value)}
                            placeholder="공지 제목"
                        />
                        <textarea
                            className="min-h-[84px] w-full rounded border border-amber-300 px-2 py-1 text-sm"
                            value={noticeContent}
                            onChange={(e) => setNoticeContent(e.target.value)}
                            placeholder="공지 내용을 입력해 주세요."
                        />
                        <div className="self-end">
                            <button
                                onClick={sendNotice}
                                disabled={isPostingNotice || isUpdatingNotice}
                                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {isPostingNotice ? "전송 중..." : "시험 공지 전송"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExamNotice && (
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
                <h2 className="font-kr text-base font-semibold text-sky-900">
                  현재 시험 공지 목록
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setShowNoticePanel((prev) => !prev)
                  }
                  className="mb-2 rounded border border-sky-300 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100"
                >
                  {showNoticePanel ? "공지 목록 닫기" : "공지 목록 열기"}
                </button>
                {showNoticePanel && (
                  <>
                    {examNotices.length === 0 ? (
                      <p className="mt-2 text-sm text-sky-800/80">
                        등록된 시험 공지가 없습니다.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {examNotices.map((notice) => (
                          <div
                            key={notice.uuid}
                            className="rounded border border-sky-200 bg-white px-2 py-1"
                          >
                            {editingNoticeUuid === notice.uuid ? (
                              <div className="space-y-2">
                                <input
                                  className="w-full rounded border border-sky-300 px-2 py-1 text-sm"
                                  value={editingNoticeTitle}
                                  onChange={(e) =>
                                    setEditingNoticeTitle(e.target.value)
                                  }
                                  placeholder="공지 제목"
                                />
                                <textarea
                                  className="min-h-[84px] w-full rounded border border-sky-300 px-2 py-1 text-sm"
                                  value={editingNoticeContent}
                                  onChange={(e) =>
                                    setEditingNoticeContent(e.target.value)
                                  }
                                  placeholder="공지 내용을 입력해 주세요."
                                  disabled={isEditingNoticeLoading}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditNotice}
                                    className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                                    disabled={isUpdatingNotice}
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditNotice}
                                    className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                                    disabled={isUpdatingNotice || isEditingNoticeLoading}
                                  >
                                    {isUpdatingNotice ? "수정 중..." : "수정 저장"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                                <>
                                  <div className="mb-1 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-sky-900">
                                        {notice.title}
                                      </p>
                                      {notice.isEdited ? (
                                        <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                          수정됨 {notice.editedCount ?? 1}
                                        </p>
                                      ) : null}
                                    </div>
                                  {notice.can_edit ? (
                                    <button
                                      type="button"
                                      onClick={() => startEditNotice(notice)}
                                      className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800"
                                      disabled={isUpdatingNotice}
                                    >
                                      수정
                                    </button>
                                  ) : null}
                                </div>
                                {notice.content ? (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-sky-900/90">
                                    {notice.content}
                                  </p>
                                ) : null}
                                {notice.created_date ? (
                                  <p className="mt-1 text-[11px] text-sky-700/70">
                                    {formatNoticeDate(notice.created_date)}
                                  </p>
                                ) : null}
                                {notice.isEdited && notice.updated_date ? (
                                  <p className="mt-1 text-[11px] text-amber-700/80">
                                    수정일: {formatNoticeDate(notice.updated_date)}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
        </section>
        </div>
    );
};

export default TestManagePage;
