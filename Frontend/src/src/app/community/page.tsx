// app/community/page.tsx
import Link from "next/link";
import { CommunityPostList } from "@/components/community/CommunityPostList";
import { getServerPosts } from "../../lib/serverApi";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
    let initialData = undefined;
    try {
        initialData = await getServerPosts({
            page: 1,
            size: PAGE_SIZE,
        });
    } catch {
        initialData = undefined;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="bg-white pt-4">
                <div className="fluid-container">
                    {/* 상단 헤더 + 질문 작성 버튼 */}
                    <div className="flex justify-between items-center py-10">
                        <h1 className="font-kr text-3xl font-semibold">
                            통합 게시판
                        </h1>
                        <div className="ml-auto">
                            <Link
                                href="/community/create"
                                className="font-kr rounded-[10px] border border-indigo-300 bg-white px-5 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 active:scale-95"
                            >
                                새 글 작성
                            </Link>
                        </div>
                    </div>
                    {/* 대시보드 탭 행과 동일한 높이 확보 */}
                    <div
                        className="mb-2 flex gap-6 invisible pointer-events-none select-none"
                        aria-hidden
                    >
                        <button className="font-kr pb-1 font-semibold border-b-2 border-primary text-primary">
                            이번학기
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full flex-1 overflow-auto bg-[rgba(237,239,254,1)]">
                <div className="fluid-container pt-4">
                    {/* 전체 질문 리스트 + 검색/페이지네이션 */}
                    <CommunityPostList
                        pageSize={PAGE_SIZE}
                        showSearch
                        origin="all"
                        initialData={initialData}
                    />
                </div>
            </div>
        </div>
    );
}
