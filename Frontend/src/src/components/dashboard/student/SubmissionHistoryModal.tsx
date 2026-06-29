"use client";

import React, { useEffect, useState } from "react";
import SubmissionDetailContent from "@/app/submission/[userid]/components/SubmissionDetailContent";
import Modal from "@/components/common/modal";
type SubmitCategory = "HOMEWORK" | "EXAM";
interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  lectureId: string;
  name: string;
  selectedTab?: SubmitCategory;
}

export default function SubmissionHistoryModal({
  open,
  onClose,
  userId,
  lectureId,
  name,
  selectedTab = "EXAM",
}: Props) {
  const [tab, setTab] = useState<SubmitCategory>(selectedTab);

  useEffect(() => {
    if (open) {
      setTab(selectedTab);
    }
  }, [open, selectedTab]);

  if (!open) return null;

  return (
    <Modal title="제출기록" onClose={onClose}>
      {/* 처음에는 exam/homework 선택 */}
      {
        <div className="min-h-0 px-4 py-6 sm:px-6 sm:py-8">
          <SubmissionDetailContent
            userId={userId}
            lectureId={lectureId}
            tab={tab}
            name={name}
          />
        </div>
      }
    </Modal>
  );
}
