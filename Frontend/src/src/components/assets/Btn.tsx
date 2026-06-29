import React from "react";

type BtnProps = {
  /**
   * 버튼에 표시될 텍스트입니다.
   * @example "토픽 추가", "삭제"
   */
  text: string;

  /**
   * 버튼 클릭 시 실행할 함수입니다.
   * 필수로 입력해야 합니다.
   */
  onClick: () => void;

  /**
   * Tailwind 클래스 형태의 높이 설정입니다.
   * 단위 포함 없이 h-8, h-10 등의 형태로 입력하세요.
   * @default "h-10"
   * @example "h-8"
   */
  height?: string;

  /**
   * Tailwind 클래스 형태의 너비 설정입니다.
   * @default "w-24"
   * @example "w-20", "w-full"
   */
  width?: string;

  /**
   * Tailwind 클래스 형태의 텍스트 크기입니다.
   * @default "text-sm"
   * @example "text-xs", "text-base"
   */
  textSize?: string;

  /**
   * 버튼 내부 색을 채울지, 테두리 색만 채울지 결정합니다.
   * @default "default"
   * @example "default", "empty"
   */
  btnType?: "default" | "empty";

  /**
   * btnType이 "empty" 일 때 버튼의 색을 정합니다.
   * @default "red"
   * @example "red, "blue"
   */
  btnColor?: "red" | "blue";

  /**
   * 버튼 비활성화 여부입니다.
   * true일 경우 클릭 불가능 + 스타일 변경됩니다.
   * @default false
   */
  disabled?: boolean;
};


/**
 * 공통 버튼 컴포넌트입니다.
 *
 * @param text - 버튼에 표시할 텍스트 (예: "추가", "삭제")
 * @param onClick - 버튼 클릭 시 실행할 함수
 * @param height - Tailwind 높이 클래스 (예: "h-10")
 * @param width - Tailwind 너비 클래스 (예: "w-24", "w-full")
 * @param textSize - 텍스트 크기 클래스 (예: "text-sm", "text-xs")
 * @param btnType - 버튼 유형 (예: "default", "empty")
 * @param btnColor - 버튼 유형이 empty일 때, 버튼 색상 (예: "red", "blue")
 * @param disabled - 버튼 비활성화 여부 (기본값: false)
 *
 * @example
 * <Btn
 *   text="삭제"
 *   onClick={() => alert("삭제")}
 *   bgColor="[rgba(78,97,246,1)]"
 *   hoverColor="[rgba(55,69,175,1)]"
 *   textSize="text-xs"
 * />
 */
export const Btn: React.FC<BtnProps> = ({
  text,
  onClick,
  height = "h-10",
  width = "w-24",
  textSize = "text-sm",
  btnType = "default",
  btnColor = "red",
  disabled = false,
}) => {
  const base = "font-kr flex items-center justify-center rounded-md font-medium transition active:scale-95";

  const disabledClass = disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "";

  // default color : black
  // 검정 버튼이 나왔다면, 문제가 생긴 것.
  let bgColor = "bg-[white]";
  let hoverColor = "hover:bg-[gray]";
  let textColor = "text-black";
  let btnBorder = "border-2 border-black"

  if (btnType === "default"){
    bgColor = "bg-[rgba(78,97,246,1)]";
    hoverColor = "hover:bg-[rgba(55,69,175,1)]";
    textColor = "text-white";
    btnBorder = "border-0";
  }
  else if (btnType === "empty"){
    bgColor = "bg-[white]";
    if (btnColor === "red"){
      hoverColor = "hover:bg-[#FDECEC]";
      textColor = "text-[#EE443F]";
      btnBorder = "border-2 border-[#EE443F]";
    }
    else if (btnColor === "blue"){
      hoverColor = "hover:bg-indigo-50";
      textColor = "text-indigo-500";
      btnBorder = "border-2 border-indigo-500";
    }
  }

  return (
    <button
      onClick={onClick}
      className={`${base} ${height} ${width} ${textSize} ${bgColor} ${hoverColor} ${textColor} ${btnBorder} ${disabledClass}`}
      disabled={disabled}
    >
      {text}
    </button>
  );
};
