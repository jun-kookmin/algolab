import React from "react";
import { MdConstruction } from "react-icons/md";

const noticeBoard = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
      <MdConstruction className="text-gray-400" size={64} />

      <div>
        <h1 className="text-3xl font-kr font-bold text-gray-700 mb-2">
          아직 준비 중입니다
        </h1>
        <p className="text-gray-500 font-kr text-lg">
          서비스 오픈을 위해 열심히 개발하고 있어요!
        </p>
      </div>
    </div>
  );
};

export default noticeBoard;
