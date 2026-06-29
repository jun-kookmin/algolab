// ──── FILE: app/login/page.tsx ────
"use client"; // 페이지 자체를 클라이언트 컴포넌트로 사용할 경우

import React from "react";
import LoginForm from "@/components/login/LoginForm"; // 경로는 실제 구조에 맞게 조정

const LoginPage: React.FC = () => {
    return (
        <section className="h-full w-full bg-[rgba(237,239,254,1)]">
            <LoginForm />
        </section>
    );
};

export default LoginPage;
