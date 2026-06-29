import PostDetailClient from "@/app/community/posts/[postid]/PostDetailClient";
import {
    getServerPostDetail,
} from "../../../../lib/serverApi";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
    params,
}: {
    params: Promise<{ postid: string }>;
}) {
    const { postid } = await params;

    let initialPost = undefined;

    try {
        initialPost = await getServerPostDetail(postid);
    } catch {
        initialPost = undefined;
    }

    return (
        <PostDetailClient
            initialPost={initialPost}
            initialReplies={initialPost?.replies}
        />
    );
}
