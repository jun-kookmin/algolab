import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  color?: string;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  color = "bg-[#4E61F6] text-white",
  className = "",
  onClick,
  ...props
}) => {
  // color가 hex 코드(#)면 inline style로 처리
  const isHex = color.startsWith("#");

  return (
    <button
      onClick={onClick}
      className={`flex justify-center items-center px-3 py-2 rounded-[8px] font-kr text-12 transition-colors ${color} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
