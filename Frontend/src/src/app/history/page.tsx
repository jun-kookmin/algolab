"use client";

import React from "react";

type Member = {
  batch: string;
  name: string;
};

type HistoryVersion = {
  label: string;
  members: Member[];
};

const HISTORY_VERSIONS: HistoryVersion[] = [
  {
    label: "2005 Grade Server Version 1.0",
    members: [
      { batch: "03", name: "Contributor A" },
      { batch: "03", name: "Contributor B" },
    ],
  },
  {
    label: "2006 Grade Server Version 1.1",
    members: [{ batch: "03", name: "Contributor A" }],
  },
  {
    label: "2008 Grade Server Version 1.2",
    members: [
      { batch: "06", name: "Contributor A" },
      { batch: "06", name: "Contributor B" },
    ],
  },
  {
    label: "2015 Grade Server Version 2.0",
    members: [
      { batch: "09", name: "Contributor A" },
      { batch: "09", name: "Contributor B" },
      { batch: "09", name: "Contributor C" },
      { batch: "09", name: "Contributor D" },
      { batch: "09", name: "Contributor E" },
    ],
  },
  {
    label: "2016 Grade Server Version 2.1",
    members: [
      { batch: "09", name: "Contributor A" },
      { batch: "13", name: "Contributor B" },
      { batch: "14", name: "Contributor C" },
      { batch: "14", name: "Contributor D" },
      { batch: "14", name: "Contributor E" },
    ],
  },
  {
    label: "2026 Grade Server Version 3.0",
    members: [
      { batch: "20", name: "Contributor A" },
      { batch: "20", name: "Contributor B" },
      { batch: "21", name: "Contributor C" },
      { batch: "21", name: "Contributor D" },
      { batch: "23", name: "Contributor E" },
    ],
  },
];

const extractYear = (label: string): number => {
  const year = Number.parseInt(label.slice(0, 4), 10);
  return Number.isFinite(year) ? year : 0;
};

export default function HistoryPage() {
  const orderedVersions = [...HISTORY_VERSIONS].sort(
    (a, b) => extractYear(b.label) - extractYear(a.label)
  );

  return (
    <section className="relative isolate min-h-screen w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,#eef2ff_0%,#edf3ff_48%,#e9f1ff_100%)]"
      />
      <div className="fluid-container pb-48 pt-10 font-kr md:pb-56">
        <h1 className="text-center text-[clamp(1.9rem,3vw,2.8rem)] font-extrabold tracking-tight text-slate-800">
          - History -
        </h1>

        <div className="mx-auto mt-10 flex max-w-[1240px] flex-col gap-6">
          {orderedVersions.map((version) => (
            <section
              key={version.label}
              className="overflow-hidden rounded-[28px] border border-white/80 bg-white/80 px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm"
            >
              <h2 className="text-[1.2rem] font-extrabold tracking-tight text-slate-800 md:text-[1.4rem]">
                {version.label}
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {version.members.map((member) => (
                  <div
                    key={`${version.label}-${member.batch}-${member.name}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_6px_18px_rgba(148,163,184,0.12)]"
                  >
                    {member.batch} {member.name}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
