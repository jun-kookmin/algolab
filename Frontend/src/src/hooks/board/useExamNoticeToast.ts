import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PostItem, useGetPosts } from "@/hooks/board/Get/useGetPosts";
import BaseApi from "@/utils/api";

interface UseExamNoticeToastOptions {
  lectureId?: string | null;
  examId?: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  maxItems?: number;
}

export interface NoticePost {
  uuid: string;
  title?: string | null;
  content?: string | null;
  created_date?: string | null;
  updated_date?: string | null;
  can_edit?: boolean;
  raw_title?: string | null;
  isEdited?: boolean;
  editedCount?: number;
}

export interface ExamNoticeToastState {
  notices: NoticePost[];
  unreadCount: number;
  markAllAsRead: () => void;
}

interface NoticeDetailCache {
  content?: string | null;
  updated_date?: string | null;
}

type NoticeDetailMap = Record<string, NoticeDetailCache>;

const DEFAULT_POLL_MS = 8_000;
const NOTICE_TAG_RE = /^\[시험공지:([0-9a-f-]{36})\]\s*/i;

const parseDateTime = (value?: string | null): number => {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
};

const isEditedNotice = (
  createdDate?: string | null,
  updatedDate?: string | null
): boolean => {
  const createdTime = parseDateTime(createdDate);
  const updatedTime = parseDateTime(updatedDate);
  return (
    Number.isFinite(createdTime) &&
    Number.isFinite(updatedTime) &&
    updatedTime > createdTime
  );
};

const buildNoticeVersionKey = (
  uuid: string,
  createdDate?: string | null,
  updatedDate?: string | null
) => `${uuid}|${updatedDate ?? createdDate ?? ""}`;

export const useExamNoticeToasts = ({
  lectureId,
  examId,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_MS,
  maxItems = 5,
}: UseExamNoticeToastOptions): ExamNoticeToastState => {
  const canRun = !!lectureId && !!examId && !!enabled;
  const trackKey = `${lectureId ?? ""}|${examId ?? ""}`;

  const queryParams = useMemo(
    () => ({
      class_uuid: lectureId ?? "",
      is_noticed: true,
      page: 1,
      size: 30,
    }),
    [lectureId]
  );

  const { data: noticeResponse } = useGetPosts(queryParams, {
    enabled: canRun,
    refetchInterval: canRun ? pollIntervalMs : false,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  });

  const isFirstLoadRef = useRef(false);
  const seenNoticeVersionsRef = useRef<Set<string>>(new Set());
  const unreadNoticeVersionsRef = useRef<Set<string>>(new Set());
  const trackKeyRef = useRef<string>("");
  const [detailedNotices, setDetailedNotices] = useState<NoticeDetailMap>({});
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!canRun) {
      setDetailedNotices({});
      isFirstLoadRef.current = false;
      seenNoticeVersionsRef.current = new Set();
      unreadNoticeVersionsRef.current = new Set();
      trackKeyRef.current = "";
      setUnreadCount(0);
      return;
    }

    if (trackKeyRef.current !== trackKey) {
      isFirstLoadRef.current = false;
      seenNoticeVersionsRef.current = new Set();
      unreadNoticeVersionsRef.current = new Set();
      setDetailedNotices({});
      setUnreadCount(0);
      trackKeyRef.current = trackKey;
    }
  }, [canRun, trackKey, lectureId, examId]);

  const notices = useMemo<NoticePost[]>(
    () =>
      (noticeResponse?.data ?? []).map((post: PostItem) => ({
        uuid: String(post.uuid ?? ""),
        title: post.title,
        content: post.content,
        created_date: post.created_date,
        updated_date: post.updated_date,
        can_edit: Boolean(post.can_edit),
        raw_title: post.title,
      })),
    [noticeResponse?.data]
  );

  const filteredNotices = useMemo<NoticePost[]>(() => {
    const list = [...notices].filter((notice) => {
      const title = (notice.title ?? "").trim();
      const match = title.match(NOTICE_TAG_RE);
      if (!examId) {
        return false;
      }
      if (match) {
        return match[1] === examId;
      }
      return false;
    });

    list.sort((a, b) => {
      const aTime = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bTime = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bTime - aTime;
    });
    return list.slice(0, maxItems).map((notice) => ({ ...notice }));
  }, [notices, examId, maxItems]);

  useEffect(() => {
    if (!canRun) return;

    const missingDetailNotices = filteredNotices.filter((notice) => {
      if (!notice.uuid) return false;
      const detail = detailedNotices[notice.uuid];
      const shouldRefetchDetail =
        !detail ||
        detail.content == null ||
        detail?.updated_date !== notice.updated_date;
      return shouldRefetchDetail;
    });

    const missingNoticeIds = Array.from(
      new Set(
        missingDetailNotices
          .map((notice) => notice.uuid)
          .filter((uuid) => uuid)
      )
    );

    if (!missingNoticeIds.length) return;

    let cancelled = false;
    const fetchDetails = async () => {
      const results = await Promise.allSettled(
        missingNoticeIds.map(async (uuid) => {
          const { data } = await BaseApi.get<any>(`/instructor/posts/${uuid}/`, {
            params: { no_replies: 1 },
          });
          return {
            uuid,
            content: data?.content,
            updated_date: data?.updated_date,
          };
        })
      );

      if (cancelled) return;

      const nextNotices = { ...detailedNotices };
      let hasUpdate = false;

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const { uuid, content, updated_date: updatedDate } = result.value;
        const next: NoticeDetailCache = {
          content:
            content !== undefined && content !== null ? String(content) : "",
          updated_date:
            updatedDate !== undefined && updatedDate !== null
              ? String(updatedDate)
              : null,
        };
        const prev = nextNotices[uuid];
        if (
          prev?.content !== next.content ||
          prev?.updated_date !== next.updated_date
        ) {
          nextNotices[uuid] = next;
          hasUpdate = true;
        }
      });

      if (hasUpdate) {
        setDetailedNotices(nextNotices);
      }
    };

    void fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [canRun, filteredNotices, detailedNotices]);

  const visibleNotices = useMemo(
    () =>
      filteredNotices.map((notice) => {
        const detail = notice.uuid ? detailedNotices[notice.uuid] : undefined;
        const cleanedTitle = (notice.raw_title ?? "").replace(
          NOTICE_TAG_RE,
          ""
        ).trim();
        const content =
          notice.content != null
            ? notice.content
            : detail?.content ?? null;
        const updatedDate =
          notice.updated_date != null
            ? notice.updated_date
            : detail?.updated_date ?? null;
        const isEdited = isEditedNotice(notice.created_date, updatedDate);
        return {
          ...notice,
          content,
          updated_date: updatedDate,
          isEdited,
          editedCount: isEdited ? 1 : 0,
          title: cleanedTitle || "시험 공지",
          raw_title: notice.raw_title ?? notice.title,
        };
      }),
    [detailedNotices, filteredNotices]
  );

  useEffect(() => {
    if (!canRun) return;

    const versions = new Set<string>();
    visibleNotices.forEach((notice) => {
      const id = String(notice.uuid ?? "").trim();
      if (!id) return;
      versions.add(buildNoticeVersionKey(id, notice.created_date, notice.updated_date));
    });

    const visibleVersionSet = new Set(versions);

    if (!visibleVersionSet.size) {
      seenNoticeVersionsRef.current = new Set();
      unreadNoticeVersionsRef.current = new Set();
      setUnreadCount(0);
      return;
    }

    if (!isFirstLoadRef.current) {
      isFirstLoadRef.current = true;
      seenNoticeVersionsRef.current = new Set(visibleVersionSet);
      unreadNoticeVersionsRef.current = new Set();
      setUnreadCount(0);
      return;
    }

    visibleVersionSet.forEach((version) => {
      if (!seenNoticeVersionsRef.current.has(version)) {
        seenNoticeVersionsRef.current.add(version);
        unreadNoticeVersionsRef.current.add(version);
      }
    });

    seenNoticeVersionsRef.current = new Set(
      [...seenNoticeVersionsRef.current].filter((version) =>
        visibleVersionSet.has(version)
      )
    );
    unreadNoticeVersionsRef.current = new Set(
      [...unreadNoticeVersionsRef.current].filter((version) =>
        visibleVersionSet.has(version)
      )
    );

    setUnreadCount(unreadNoticeVersionsRef.current.size);
  }, [canRun, visibleNotices]);

  const markAllAsRead = useCallback(() => {
    unreadNoticeVersionsRef.current = new Set();
    setUnreadCount(0);
  }, []);

  return {
    notices: visibleNotices,
    unreadCount,
    markAllAsRead,
  };
};

export default useExamNoticeToasts;
