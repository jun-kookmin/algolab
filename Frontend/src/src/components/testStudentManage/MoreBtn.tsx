import React from "react";
import Image from "next/image";

const MoreBtn = () => {
  return (
    <div className="flex items-center gap-1 cursor-pointer">
      <span className="text-sm text-[#9EA2AE]">더보기</span>
      <Image
        src="/assets/icon/Icon_More.svg"
        alt="더보기 아이콘"
        width={16}
        height={16}
        className="w-4 h-4 inline-block"
      />
    </div>
  );
};

export default MoreBtn;
