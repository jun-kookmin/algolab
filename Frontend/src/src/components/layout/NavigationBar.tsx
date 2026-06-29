"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";
import AuthApi, {
  clearCsrfTokenCookie,
  ensureCsrfToken,
  resetCsrfState,
} from "@/utils/authApi";
import { useQueryClient } from "@tanstack/react-query";
import { clearExamLock, getExamLock, isExamLocked } from "@/utils/examLock";

const NavigationBar: React.FC = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { isLogin, setIsLogin, me, setMe } = useAuth();
  const group = me?.group?.toLowerCase() ?? "";
  const isPrivileged =
    group === "administrator" || group === "professor" || group === "instructor";
  const canManageProblems =
    group === "administrator" ||
    group === "professor" ||
    group === "instructor";
  const homePath =
    isLogin && group === "student"
      ? "/studentdashboard"
      : isLogin
        ? "/dashboard"
        : "/";
  const isSolvePage = pathname?.includes("/solve/") ?? false;

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const hasExamNavigationLock = () => !isPrivileged && isExamLocked();

  const blockIfExamNavigationLocked = (
    e: React.MouseEvent<HTMLElement>
  ): boolean => {
    if (!hasExamNavigationLock()) return false;
    e.preventDefault();
    window.alert("다른 페이지로의 이동은 불가합니다.");
    return true;
  };

  const resolveActiveExamId = () => {
    const fromPath = pathname?.match(/^\/class\/[^/]+\/solve\/exam\/([^/?#]+)/)?.[1];
    if (fromPath) return fromPath;
    const lock = getExamLock();
    if (lock.examId) return lock.examId;
    const fromLockPath = lock.path.match(/^\/class\/[^/]+\/solve\/exam\/([^/?#]+)/)?.[1];
    return fromLockPath ?? "";
  };

  const readErrorMessage = (error: unknown) => {
    const data = (error as any)?.response?.data;
    return (
      data?.detail ||
      data?.message ||
      (typeof data === "string" ? data : "") ||
      (error as Error)?.message ||
      "로그아웃 처리 중 오류가 발생했습니다."
    );
  };

  const handleLogout = async () => {
    const activeExamId = hasExamNavigationLock() ? resolveActiveExamId() : "";
    if (activeExamId) {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm(
              "로그아웃하면 현재 시험이 종료 처리되며, 감독 페이지에서 해제해야 다시 이어서 응시할 수 있습니다.\n로그아웃하시겠습니까?"
            )
          : true;
      if (!confirmed) return;
    }
    const finalizeLogout = () => {
      setIsLogin(false);
      setMe(null);
      clearExamLock();
      clearCsrfTokenCookie();
      resetCsrfState();
      queryClient.removeQueries({ queryKey: ["me"] });
      setOpen(false);
      router.replace("/login");
    };
    let shouldFinalizeLogout = false;
    try {
      await ensureCsrfToken(true);
      await AuthApi.post("/auth/logout/", activeExamId ? { exam_id: activeExamId } : {});
      shouldFinalizeLogout = true;
    } catch (err) {
      if (activeExamId) {
        if (typeof window !== "undefined") {
          window.alert(readErrorMessage(err));
        }
        return;
      }
      // console.warn("로그아웃 요청 실패, 클라이언트 로그아웃 처리:", err);
      shouldFinalizeLogout = true;
    } finally {
      if (shouldFinalizeLogout) {
        finalizeLogout();
      }
    }
  };

  // 🔻 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className={
        isSolvePage
          ? "bg-gray-900 text-white border-b border-gray-800"
          : "bg-white text-black border-b border-gray-200"
      }
    >
      <div
        className={
          isSolvePage
            ? "relative w-full fluid-space flex justify-between items-center"
            : "relative mx-auto w-full max-w-[1500px] fluid-space-x fluid-space-y flex justify-between items-center"
        }
      >
        <Link
          href={homePath}
          onClick={(e) => {
            if (blockIfExamNavigationLocked(e)) return;
            setOpen(false);
          }}
        >
          <Image
            src="/SmallLogo.svg"
            alt="Algolab Logo"
            width={120}
            height={16}
            className={`h-4 w-auto ${isSolvePage ? "[filter:brightness(0)_invert(1)]" : ""}`}
            priority
          />
        </Link>

        {/* 중앙 메뉴 */}
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
          {isLogin && (
            <>
              <Link
                href="/community"
                onClick={(e) => {
                  if (blockIfExamNavigationLocked(e)) return;
                  setOpen(false);
                }}
                className={`font-kr font-medium text-sm px-3 py-1 rounded ${
                  isSolvePage
                    ? "text-white hover:bg-white/20"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                게시판
              </Link>
              <Link
                href="/mysubmission"
                onClick={(e) => {
                  if (blockIfExamNavigationLocked(e)) return;
                  setOpen(false);
                }}
                className={`font-kr font-medium text-sm px-3 py-1 rounded ${
                  isSolvePage
                    ? "text-white hover:bg-white/20"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                제출 정보
              </Link>
            </>
          )}
          <Link
            href="/history"
            onClick={(e) => {
              if (blockIfExamNavigationLocked(e)) return;
              setOpen(false);
            }}
            className={`font-kr font-medium text-sm px-3 py-1 rounded ${
              isSolvePage
                ? "text-white hover:bg-white/20"
                : "text-black hover:bg-gray-100"
            }`}
          >
            연혁
          </Link>
        </div>

        {/* 오른쪽 영역 */}
        <div className="flex gap-4 items-center">
          {isLogin && (
            <>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpen((prev) => !prev)}
                  className={`font-kr font-medium text-sm px-3 py-1 rounded ${
                    isSolvePage
                      ? "text-white hover:bg-white/20"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  {me?.username}
                </button>
                {open && (
                  <div className="absolute right-0 mt-2 w-40 bg-white text-black rounded shadow-lg overflow-hidden z-[100]">
                    {canManageProblems && (
                      <Link href="/problem">
                        <div
                          onClick={(e) => {
                            if (blockIfExamNavigationLocked(e)) return;
                            setOpen(false);
                          }}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer font-kr"
                        >
                          문제 관리
                        </div>
                      </Link>
                    )}
                    <div
                      onClick={handleLogout}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer font-kr text-black"
                    >
                      로그아웃
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!isLogin && (
            <Link href="/login">
              <button
                className={`font-kr font-medium text-sm px-3 py-1 rounded ${
                  isSolvePage
                    ? "text-white hover:bg-white/20"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                로그인
              </button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;
