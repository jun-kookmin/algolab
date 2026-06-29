import AuthApi from "@/utils/authApi";
import { useForm } from "react-hook-form";

const ChangePassword = ({ onBack }: { onBack: () => void }) => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<{
    new_password: string;
    new_password2: string;
  }>();

  const onSubmit = async (values: any) => {
    try {
      await AuthApi.post("/auth/password/change/", {
        new_password1: values.new_password,
        new_password2: values.new_password2,
      });

      alert("비밀번호가 변경되었습니다.");
      onBack();
    } catch (err: any) {
      const data = err.response?.data;

      // 🔥 new_password1 에러 처리
      if (data?.new_password1) {
        setError("new_password", {
          message: data.new_password1[0],
        });
      }

      // 🔥 new_password2 에러 처리
      if (data?.new_password2) {
        setError("new_password2", {
          message: data.new_password2[0],
        });
      }
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow space-y-4">
      <h2 className="text-xl font-bold font-kr">비밀번호 변경</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <input
            type="password"
            placeholder="새 비밀번호"
            {...register("new_password", { required: "필수 입력입니다." })}
            className="w-full border rounded-lg px-3 py-2"
          />
          {errors.new_password && (
            <p className="text-red-500 text-sm mt-1">
              {errors.new_password.message}
            </p>
          )}
        </div>

        <div>
          <input
            type="password"
            placeholder="새 비밀번호 확인"
            {...register("new_password2", { required: "필수 입력입니다." })}
            className="w-full border rounded-lg px-3 py-2"
          />
          {errors.new_password2 && (
            <p className="text-red-500 text-sm mt-1">
              {errors.new_password2.message}
            </p>
          )}
        </div>

        <button className="w-full bg-[#7181f8] text-white py-2 rounded-lg">
          변경하기
        </button>

        <button
          type="button"
          className="w-full border border-[#7181f8] bg-white text-[#7181f8] py-2 rounded-lg"
          onClick={onBack}
        >
          돌아가기
        </button>
      </form>
    </div>
  );
};

export default ChangePassword;
