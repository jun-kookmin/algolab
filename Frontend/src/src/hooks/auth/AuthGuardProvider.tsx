"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/auth/get/useMe";
import { clearExamLock, getExamLock, shouldAlertExamLock } from "@/utils/examLock";
import { useSessionPresence } from "@/utils/sessionPresence";
import {
  clearDuplicateLoginAlertFlag,
  markDuplicateLoginAlertShown,
  shouldShowDuplicateLoginAlert,
  DUPLICATE_LOGIN_ALERT_MESSAGE,
} from "@/utils/duplicateLoginAlert";

interface User {
  first_name: string;
  last_name: string;
  group: string | null;
  pk: number;
  username: string;
}

interface AuthContextType {
  isLogin: boolean;
  setIsLogin: React.Dispatch<React.SetStateAction<boolean>>;
  me: User | null;
  setMe: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

export default function AuthGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalizePath = (value: string): string => {
    if (!value) return "";
    const [rawPath, rawQuery] = value.split("?");
    const path =
      rawPath && rawPath !== "/" ? rawPath.replace(/\/+$/, "") : rawPath;
    return rawQuery ? `${path}?${rawQuery}` : path;
  };

  const searchQuery = searchParams?.toString() ?? "";
  const currentPath = pathname ? (searchQuery ? `${pathname}?${searchQuery}` : pathname) : "";
  const isPublicPath =
    pathname === "/" ||
    pathname === "/history" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const [isLogin, setIsLogin] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  // 공개 페이지에서는 인증 조회로 리다이렉트가 발생하지 않도록 제외한다.
  // 루트 경로는 로그인된 사용자를 각 대시보드로 보내기 위해 예외적으로 조회를 유지한다.
  const shouldFetchMe =
    pathname !== "/history" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register");
  const { data: meData, isLoading } = useMe({
    enabled: shouldFetchMe,
  });
  useSessionPresence({
    enabled: shouldFetchMe && !!meData?.pk,
    userId: meData?.pk ?? null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const replaced = searchParams?.get("replaced_existing_session");
    if (replaced !== "1") {
      clearDuplicateLoginAlertFlag();
      return;
    }

    if (shouldShowDuplicateLoginAlert(true)) {
      markDuplicateLoginAlertShown();
      window.alert(DUPLICATE_LOGIN_ALERT_MESSAGE);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("replaced_existing_session");
    const nextSearch =
      url.searchParams.toString().length > 0 ? `?${url.searchParams.toString()}` : "";
    const nextPath = `${url.pathname}${nextSearch}${url.hash}`;
    window.history.replaceState({}, "", nextPath);
  }, [searchParams]);

  useEffect(() => {
    if (meData) setMe(meData);
  }, [meData]);

  useEffect(() => {
    if (isLoading) return; //  me 로딩 전에는 어떤 redirect도 하지 않음

    // #1 로그인 여부 판별
    if (!meData) {
      setIsLogin(false);
      clearExamLock();

      // 공개 페이지는 비로그인 접근 허용
      if (!isPublicPath) {
        router.replace("/login");
      }
      return;
    }

    setIsLogin(true);

    const group = meData.group?.toLowerCase() ?? "student"; //group:null → student 취급
    // console.log(group, "group");

    const isRoot = pathname === "/" || pathname === "" || pathname === "/login";

    if (group === "administrator") {
      if (isRoot) router.replace("/dashboard");
      return;
    }

    // 기본 권한 분기 (대시보드)
    //    ExternalOAuth 로그인도 여기서 자동 처리됨
    if (isRoot) {
      if (group === "student") router.replace("/studentdashboard");
      else router.replace("/dashboard");
      return;
    }

    if (pathname === "/dashboard" && group === "student") {
      router.replace("/studentdashboard");
      return;
    }

    if (pathname === "/studentdashboard" && group !== "student") {
      router.replace("/dashboard");
      return;
    }

    // ─────────────────────────────────────
    // #3 CLASS 관련 접근 제어
    // ─────────────────────────────────────
    const classViewMatch = pathname.match(/^\/class\/([^/]+)\/?$/);
    const classEditMatch = pathname.match(/^\/class\/([^/]+)\/edit\/?$/);
    const classManageMatch = pathname.match(/^\/class\/([^/]+)\/classmanage\/?$/);
    const classHomeworkSolveMatch = pathname.match(/^\/class\/([^/]+)\/([^/]+)\/solve\/homework\/([^/]+)\/?$/);
    const classHomeworkStatusMatch = pathname.match(/^\/class\/([^/]+)\/([^/]+)\/status\/homework\/([^/]+)\/?$/);
    const classExamSolveMatch = pathname.match(/^\/class\/([^/]+)\/solve\/exam\/([^/]+)\/?$/);

    if (pathname.startsWith("/class")) {
      if (group === "student") {
        // 학생은 class 조회/풀이 경로만 허용
        if (classEditMatch || classManageMatch) {
          const classId = classEditMatch?.[1] ?? classManageMatch?.[1];
          router.replace(`/class/${classId}`);
          return;
        }
        const studentAllowedClassPath =
          classViewMatch || classHomeworkSolveMatch || classHomeworkStatusMatch || classExamSolveMatch;
        if (!studentAllowedClassPath) {
          router.replace("/studentdashboard");
          return;
        }
      }

      // 교수/관리자는 존재하지 않는 패턴 제한
      if (group !== "student") {
        const valid =
          classViewMatch ||
          classEditMatch ||
          classManageMatch ||
          classHomeworkSolveMatch ||
          classHomeworkStatusMatch ||
          classExamSolveMatch;
        if (!valid) {
          router.replace("/dashboard");
          return;
        }
      }
    }

    // #4 학생 접근 제한 영역
    if (group === "student") {
      const blockedForStudents = [
        "/problem",
        "/studentmanage",
        "/classmanage",
        "/dashboard",
      ];

      if (blockedForStudents.some((p) => pathname.startsWith(p))) {
        router.replace("/studentdashboard");
        return;
      }
    }

    // ─────────────────────────────────────
    // #5 교수 접근 제한 영역 (옵션)
    // ─────────────────────────────────────
    if (group !== "student") {
      const blockedForProfessor = ["/studentdashboard"];
      if (blockedForProfessor.some((p) => pathname.startsWith(p))) {
        router.replace("/dashboard");
        return;
      }
    }

    // #6 기본 분기 끝 (불필요한 replace 제거)
  }, [isPublicPath, meData, isLoading, pathname, router, shouldFetchMe]);

  useEffect(() => {
    if (!meData) return;
    if (!pathname) return;
    const group = (meData.group ?? "").toLowerCase();
    const isPrivileged =
      group === "administrator" || group === "professor" || group === "instructor";
    if (isPrivileged) return;
    const lock = getExamLock();
    if (!lock.active || !lock.path) return;
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedLock = normalizePath(lock.path);
    if (normalizedCurrent === normalizedLock) return;
    if (shouldAlertExamLock()) {
      window.alert("다른 페이지로의 이동은 불가합니다.");
    }
    router.replace(lock.path);
  }, [currentPath, pathname, meData, router]);

  if (isLoading) return <div className="text-center mt-20">Loading...</div>;
  // if (!mounted) {
  //   return <div className="text-center mt-20">Loading...</div>;
  // }

  return (
    <AuthContext.Provider value={{ isLogin, setIsLogin, me, setMe }}>
      {children}
    </AuthContext.Provider>
  );
}
