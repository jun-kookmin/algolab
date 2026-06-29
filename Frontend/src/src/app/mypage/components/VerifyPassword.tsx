import { useForm } from "react-hook-form";
import AuthApi from "@/utils/authApi";

const VerifyPassword = ({ onSuccess }: { onSuccess: () => void }) => {
  const { register, handleSubmit } = useForm<{ password: string }>();

  const onSubmit = async (values: { password: string }) => {
    await AuthApi.post("/auth/verify-password/", values);
    onSuccess();
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold font-kr mb-4">비밀번호 확인</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input
          type="password"
          placeholder="현재 비밀번호"
          {...register("password")}
          className="w-full border rounded-lg px-3 py-2"
        />
        <button className="w-full bg-[#7181f8] text-white py-2 rounded-lg">
          확인
        </button>
      </form>
    </div>
  );
};
export default VerifyPassword;
