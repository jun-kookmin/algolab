import { formatNameFromParts } from "@/utils/name";

const MyInfo = ({ me, onChangePwd }: { me: any; onChangePwd: () => void }) => {
  return (
    <div className="w-full max-w-md bg-white p-6 rounded-lg shadow space-y-4">
      <h2 className="text-2xl font-bold font-kr">내 정보</h2>

      <div className="text-left space-y-2">
        <p>
          <span className="font-semibold">이름:</span>{" "}
          {formatNameFromParts(me?.first_name, me?.last_name)}
        </p>
        <p>
          <span className="font-semibold">아이디:</span> {me.username}
        </p>
      </div>

      <button
        onClick={onChangePwd}
        className="w-full bg-[#7181f8] text-white rounded-lg py-2 "
      >
        비밀번호 변경하기
      </button>
    </div>
  );
};
export default MyInfo;
