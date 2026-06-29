"use client";

import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  stats: {
    correct: number;
    wrong: number;
    timeout: number;
    memoryOver: number;
    compileError: number;
    runtimeError: number;
    serverError: number;
  };
}

export default function DonutChart({ stats }: Props) {
  const labels = ["정답", "오답", "시간초과", "메모리초과", "컴파일오류", "런타임오류", "에러"];
  const colors = [
    "#60a5fa", // 정답 (JudgeBadge: blue)
    "#f87171", // 오답 (JudgeBadge: red)
    "#a78bfa", // 시간초과 (JudgeBadge: purple)
    "#f472b6", // 메모리 초과 (JudgeBadge: fuchsia)
    "#facc15", // 컴파일 오류 (JudgeBadge: yellow)
    "#fb923c", // 런타임 오류 (JudgeBadge: orange)
    "#94a3b8", // 에러 (JudgeBadge: gray)
  ];
  const legendEntries = labels.map((label, idx) => ({
    label,
    color: colors[idx],
  }));
  const legendRows = [legendEntries.slice(0, 4), legendEntries.slice(4)];

  const data = {
    labels,
    datasets: [
      {
        data: [
          stats.correct,
          stats.wrong,
          stats.timeout,
          stats.memoryOver,
          stats.compileError,
          stats.runtimeError,
          stats.serverError,
        ],
        backgroundColor: colors,
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="w-[260px]">
      <div className="mb-2 space-y-1">
        {legendRows.map((row, rowIdx) => (
          <div key={`legend-row-${rowIdx}`} className="flex items-center justify-center gap-3">
            {row.map((entry) => (
              <div key={entry.label} className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                <span
                  className="inline-block h-2 w-4 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="h-[220px]">
        <Doughnut
          data={data}
          options={{
            plugins: {
              legend: { display: false },
            },
          }}
        />
      </div>
    </div>
  );
}
