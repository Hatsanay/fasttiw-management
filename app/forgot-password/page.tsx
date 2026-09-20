import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = { title: "ลืมรหัสผ่าน | Fasttiw Admin" };

// จัดกรอบกลางจอแบบเดียวกับหน้าเข้าสู่ระบบ (app/page.tsx) — สองหน้านี้ผู้ใช้สลับไปมา ถ้าเลย์เอาต์ไม่เหมือนกัน
// จะเห็นหน้ากระโดดตอนกดลิงก์
export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <ForgotPasswordForm />
            </div>
        </div>
    );
}
