import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_INTERNAL_URL =
    process.env.BACKEND_INTERNAL_URL || "http://backend:8000";

type RequestInitWithDuplex = RequestInit & {
    duplex?: "half";
};

const BACKEND_PATH_REWRITE_MAP = new Map<string, string>([
    ["/api/v1/instructor/lectures", "/api/v1/instructor/lectures/"],
]);

const PUBLIC_API_ALLOWED_PREFIXES = [
    "/api/accounts/oauth/",
    "/api/auth/",
];

const REQUEST_SKIP_HEADERS = new Set([
    "connection",
    "upgrade",
    "proxy-connection",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
]);

const RESPONSE_SKIP_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "server",
    "x-powered-by",
]);

const sanitizeRequestHeaders = (headers: Headers): Headers => {
    const out = new Headers();
    for (const [key, value] of headers.entries()) {
        if (REQUEST_SKIP_HEADERS.has(key.toLowerCase())) {
            continue;
        }
        out.append(key, value);
    }

    return out;
};

const sanitizeResponseHeaders = (headers: Headers): Headers => {
    const out = new Headers();
    for (const [key, value] of headers.entries()) {
        const lower = key.toLowerCase();
        if (RESPONSE_SKIP_HEADERS.has(lower)) {
            continue;
        }
        out.append(key, value);
    }

    return out;
};

const isTopLevelNavigationRequest = (request: NextRequest): boolean => {
    const mode = (request.headers.get("sec-fetch-mode") || "").toLowerCase();
    const dest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
    const accept = (request.headers.get("accept") || "").toLowerCase();

    if (mode === "navigate" || dest === "document") {
        return true;
    }

    return accept.includes("text/html");
};

const shouldBlockTopLevelApiNavigation = (pathname: string): boolean => {
    if (!pathname.startsWith("/api/")) {
        return false;
    }

    return !PUBLIC_API_ALLOWED_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
    );
};

const rewriteBackendPath = (pathname: string): string => {
    const exactMatch = BACKEND_PATH_REWRITE_MAP.get(pathname);
    if (exactMatch) {
        return exactMatch;
    }

    if (pathname.startsWith("/api/accounts/oauth/")) {
        return pathname.replace(/^\/api\/accounts\//, "/accounts/");
    }

    return pathname;
};

const handler = async (request: NextRequest): Promise<NextResponse> => {
    if (
        shouldBlockTopLevelApiNavigation(request.nextUrl.pathname) &&
        isTopLevelNavigationRequest(request)
    ) {
        return NextResponse.json(
            { detail: "Direct browser navigation to this API is not allowed." },
            { status: 404 },
        );
    }

    const backendPath = rewriteBackendPath(request.nextUrl.pathname);
    const target = `${BACKEND_INTERNAL_URL.replace(/\/+$/, "")}${backendPath}${request.nextUrl.search}`;
    const headers = sanitizeRequestHeaders(request.headers);
    headers.set(
        "x-forwarded-proto",
        request.nextUrl.protocol.replace(":", ""),
    );
    headers.set("x-forwarded-host", request.headers.get("host") || "");
    const host = request.headers.get("host");
    if (host) {
        headers.set("host", host);
    }

    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
    const init: RequestInitWithDuplex = {
        method,
        headers,
        redirect: "manual",
    };
    if (hasBody && request.body) {
        init.body = request.body;
        init.duplex = "half";
    }

    const response = await fetch(target, init);
    const responseHeaders = sanitizeResponseHeaders(response.headers);

    return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
    });
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
    return handler(request);
}
