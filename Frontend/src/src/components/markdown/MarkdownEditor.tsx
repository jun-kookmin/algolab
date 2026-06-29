// components/markdown/MarkdownEditor.tsx
"use client";

import { ContextStore } from "@uiw/react-md-editor";
import dynamic from "next/dynamic";
import React, { useEffect, useRef } from "react";
import rehypeRaw from "rehype-raw";
import rehypeSafeHtml from "@/components/markdown/rehypeSafeHtml";

// SSR 환경에서 오류 방지: next.js에서는 클라이언트에서만 동작하도록 설정
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export interface MarkdownEditorProps {
    value: string;
    onChange: (
        value?: string,
        event?: React.ChangeEvent<HTMLTextAreaElement>,
        state?: ContextStore
    ) => void;
    role?: "student" | "professor" | "free";
    initialContent?: string;
}

const templates: Record<NonNullable<MarkdownEditorProps["role"]>, string> = {
    student: `### 🙋 질문 요약  
<!-- 궁금한 점이나 막힌 부분을 간단히 적어주세요. -->

예: 반복문 조건에서 원하는 결과가 안 나옵니다.

---

### 💡 상세 설명  
<!-- 어떤 시도를 했고, 어디서 막혔는지 구체적으로 적어주세요.  
실행 환경이나 알고 있는 사실 등을 함께 적으면 좋아요. -->

(여기에 설명을 작성하세요)

---

### 🧑‍💻 작성한 코드  
<!-- 핵심 코드만 넣어도 괜찮습니다. -->

\`\`\`python
# 여기에 코드를 붙여 넣으세요
print("Hello World")
\`\`\`

---

### ⚠️ 실제 결과 / 에러 메시지  
<!-- 예상한 결과와 실제 결과가 다르다면 아래에 적어주세요.  
오류 메시지가 있다면 함께 포함해주세요. -->

예상 결과:  
실제 결과:  
오류 메시지:  
`,
    professor: `## 📝 문제 설명  
<!-- 문제의 개요와 목표를 작성하세요 -->

(여기에 문제 설명을 작성하세요)

---

## 📥 입력  
<!-- 입력 형식과 조건을 작성하세요 -->

예시 :  첫째 줄에 정수 N이 주어진다. (1 ≤ N ≤ 1,000)  

---

## 📤 출력  
<!-- 출력 형식과 조건을 작성하세요 -->

예시 : 조건을 만족하는 문자열을 한 줄에 출력한다.  

---

## 🔍 예제  

### 입력 예시
\`\`\`
5
1 2 3 4 5
\`\`\`

### 출력 예시
\`\`\`
15
\`\`\`

---

## 💬 추가 설명 (선택)  
<!-- 필요한 경우, 예제나 조건에 대한 보충 설명을 작성하세요 -->

예시 : Python의 "sum()" 함수를 사용해도 됩니다.
`,
    free: `
### ✍️ 내용
<!-- 자유롭게 글을 작성하세요. 형식 제한 없음. -->


### 🧑‍💻 작성한 코드  
<!-- 핵심 코드만 넣어도 괜찮습니다. -->
\`\`\`
여기에 코드를 붙여 넣으세요
\`\`\`
(여기에 내용을 작성하세요)

`,
};

/**
 * 공통 마크다운 에디터 컴포넌트입니다.
 *
 * - value: 부모가 관리하는 현재 내용
 * - initialContent: 수정 모드 등에서 한 번만 사용할 초기 내용
 * - role: 새 글 작성 시 사용할 템플릿 종류
 */
const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    role,
    initialContent,
}) => {
    const initializedRef = useRef(false);

    // 최초 한 번만 초기 값 결정해서 부모에게 알려 줌
    useEffect(() => {
        if (initializedRef.current) return;

        const trimmedValue = (value ?? "").trim();
        const trimmedInitial = (initialContent ?? "").trim();

        // 1) value가 이미 있으면 그대로 사용
        if (trimmedValue !== "") {
            initializedRef.current = true;
            return;
        }

        // 2) value는 비어 있고, initialContent가 있으면 그걸 사용
        if (trimmedInitial !== "") {
            onChange(trimmedInitial);
            initializedRef.current = true;
            return;
        }

        // 3) 둘 다 비어 있고 role이 있으면 템플릿 사용
        if (role) {
            const template = templates[role];
            onChange(template);
            initializedRef.current = true;
            return;
        }

        initializedRef.current = true;
    }, [value, initialContent, role, onChange]);

    const handleChange = (
        val?: string,
        event?: React.ChangeEvent<HTMLTextAreaElement>,
        state?: ContextStore
    ) => {
        onChange(val ?? "", event, state);
    };

    return (
        <div className="w-full" data-color-mode="light">
            <MDEditor
                height={500}
                value={value ?? ""}
                onChange={handleChange}
                previewOptions={{
                    rehypePlugins: [rehypeRaw, rehypeSafeHtml],
                    skipHtml: false,
                }}
            />
        </div>
    );
};

export default MarkdownEditor;
