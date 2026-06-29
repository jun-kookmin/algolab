import React from "react";
import StudentCurriculumCard from "@/components/dashboard/student/StudentCurriculumCard";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth/AuthGuardProvider";

type Card = {
  id: string;
  title: string;
  partCnt: number;
  problemCnt: number;
  term: string;
  curriculumLocked?: boolean;
};
interface HistorySectionProps {
  pageCards: Card[];
}

type SubmitCategory = "HOMEWORK" | "EXAM" | undefined;
const HistorySection = ({ pageCards }: HistorySectionProps) => {
  const { me } = useAuth();
  const router = useRouter();
  // const [openModal, setOpenModal] = useState(false);
  // const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  // const [selectedTab, setSelectedTab] = useState<SubmitCategory>("EXAM");
  const handleView = (card: Card, tab: SubmitCategory) => {
    if (!me) return;

    router.push(`/submission/${me.pk}?lid=${card.id}&tab=${tab ?? "EXAM"}`);
  };

  return (
    <div className="flex w-full flex-wrap items-stretch gap-2">
      {pageCards.map((card) => (
        <StudentCurriculumCard
          key={card.id}
          {...card}
          onView={(tab) => handleView(card, tab)}
          type="history"
        />
      ))}
      {/* 제출 기록 모달 */}
      {/* <SubmissionHistoryModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        userId={Number(me?.pk)}
        lectureId={selectedCard?.id ?? ""}
        name={selectedCard?.title ?? ""}
        selectedTab={selectedTab}
      /> */}
    </div>
  );
};

export default HistorySection;
