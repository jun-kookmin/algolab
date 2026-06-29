import type { Metadata } from "next";
import React, { ReactNode } from "react";
import "./globals.css";
import "vditor/dist/index.css";
import BackGround from "@/components/layout/BackGround";
import NavigationBar from "@/components/layout/NavigationBar";
import Providers from "@/app/provider/provider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AuthGuardProvider from "@/hooks/auth/AuthGuardProvider";

export const metadata: Metadata = {
  title: "Algolab",
  description: "Algorithm learning and grading platform built with Next.js 15",
  icons: {
    icon: "/ALGOLAB_SUB_LOGO.svg",
    shortcut: "/ALGOLAB_SUB_LOGO.svg",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
    <html lang="ko">
      <body className="overflow-hidden">
        <Providers>
          <AuthGuardProvider>
            {/* React Query 가장 바깥 */}
            <div className="relative isolate flex h-dvh flex-col">
              <div className="relative z-0">
                <BackGround />
              </div>
              <div className="relative z-40 flex-none">
                <NavigationBar />
              </div>
              <main className="relative flex-1 min-h-0 overflow-auto">
                <div className="flex h-full w-full flex-col">
                  {children}
                </div>
              </main>
            </div>
            <ToastContainer position="bottom-center" autoClose={2000} />
          </AuthGuardProvider>
        </Providers>
      </body>
    </html>
  );
}
