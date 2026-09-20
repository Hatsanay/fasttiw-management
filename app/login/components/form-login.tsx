"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Form from "@/components/ui/form/Form";
import Input from "@/components/ui/Input/input";
import Button from "@/components/ui/Button/Button";
import { handleLogin, handleLogin2fa } from "../actions";

type FormErrors = { user_email?: string; user_password?: string };

function validate(email: string, password: string): FormErrors {
    const errors: FormErrors = {};
    if (!email.trim())                                    errors.user_email = "กรุณากรอกอีเมล";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))    errors.user_email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!password) errors.user_password = "กรุณากรอกรหัสผ่าน";
    return errors;
}

export default function LoginForm() {
    const router = useRouter();
    const [state, formAction, pending] = useActionState(handleLogin, null);
    // บัญชีที่เปิดยืนยันสองชั้นจะมาหยุดที่ขั้นนี้ก่อนได้ token (2026-09-20)
    // อ่านค่าจาก state ของ action ตรงๆ ไม่ก๊อปมาเก็บเป็น state ซ้ำ (ทำให้ render ซ้อนโดยไม่จำเป็น) —
    // มีแค่ปุ่ม "ย้อนกลับ" เท่านั้นที่สั่งยกเลิกขั้นนี้ได้ จึงเก็บเป็นธงแยกตัวเดียว
    const [dismissed, setDismissed] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpPending, setOtpPending] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        if (!state) return;
        if ("error" in state) {
            toast.error(state.error);
        } else if ("require2fa" in state) {
            toast.info(state.message);
        } else if ("ok" in state) {
            // หน้านี้ไม่เคยเห็นตัว token เลย — Server Action ตั้ง cookie httpOnly ให้ที่ฝั่งเซิร์ฟเวอร์
            // (JS อ่านไม่ได้ = XSS ขโมยไปใช้ไม่ได้) ทุกคำขอจากหน้าเว็บวิ่งผ่านตัวกลาง /api/be ที่แนบ token ให้เอง
            router.push("/dashboard");
        }
    }, [state, router]);

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.target.value);
        if (errors.user_email) setErrors((prev) => ({ ...prev, user_email: undefined }));
    }

    function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setPassword(e.target.value);
        if (errors.user_password) setErrors((prev) => ({ ...prev, user_password: undefined }));
    }

    // ตรวจฝั่ง client ก่อนปล่อยให้ formAction (server action) ทำงาน — preventDefault ถ้ามี field ผิด
    // เพื่อกันยิง request ไปเซิร์ฟเวอร์ทั้งที่รู้อยู่แล้วว่าข้อมูลไม่ครบ/ผิดรูปแบบ
    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        const fieldErrors = validate(email, password);
        if (Object.keys(fieldErrors).length > 0) {
            e.preventDefault();
            setErrors(fieldErrors);
        }
    }

    const challengeToken = !dismissed && state && "require2fa" in state ? state.challengeToken : null;

    async function submitOtp(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!challengeToken || otp.length !== 6) return;
        setOtpPending(true);
        const result = await handleLogin2fa(challengeToken, otp);
        setOtpPending(false);
        if (result && "error" in result) {
            toast.error(result.error);
            setOtp("");
        } else if (result && "ok" in result) {
            router.push("/dashboard");
        }
    }

    // ขั้นยืนยันสองชั้น — แทนที่ฟอร์มอีเมล/รหัสผ่านไปเลย กันกรอกรหัสผ่านซ้ำโดยไม่จำเป็น
    if (challengeToken) {
        return (
            <Form cols={1} className="max-w-md mx-auto" onSubmit={submitOtp}>
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-2 text-blue-400">ยืนยันการเข้าสู่ระบบ</h1>
                    <p className="text-sm text-gray-500 mb-2">กรอกรหัส 6 หลักที่ส่งไปทางอีเมลของคุณ</p>
                </div>
                <Input
                    type="text" inputMode="numeric" maxLength={6} autoFocus
                    placeholder="รหัส 6 หลัก" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="tracking-[0.4em] text-center"
                />
                <Button type="submit" disabled={otpPending || otp.length !== 6}>
                    {otpPending ? "กำลังยืนยัน..." : "ยืนยัน"}
                </Button>
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => { setDismissed(true); setOtp(""); }}
                        className="text-sm text-gray-500 hover:text-blue-500 hover:underline"
                    >
                        ย้อนกลับไปเข้าสู่ระบบใหม่
                    </button>
                </div>
            </Form>
        );
    }

    return (
        <Form cols={1} className="max-w-md mx-auto" action={formAction} onSubmit={handleSubmit}>
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4 text-blue-400">Login</h1>
            </div>
            <div className="flex flex-col gap-1">
                <Input
                    type="email" name="user_email" placeholder="อีเมล"
                    value={email} onChange={handleEmailChange}
                    error={!!errors.user_email}
                />
                {errors.user_email && <p className="text-xs text-red-500">{errors.user_email}</p>}
            </div>
            <div className="flex flex-col gap-1">
                <Input
                    type="password" name="user_password" placeholder="รหัสผ่าน"
                    value={password} onChange={handlePasswordChange}
                    error={!!errors.user_password}
                />
                {errors.user_password && <p className="text-xs text-red-500">{errors.user_password}</p>}
            </div>
            <Button type="submit" disabled={pending}>
                {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
            <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-blue-500 hover:underline">
                    ลืมรหัสผ่าน?
                </Link>
            </div>
        </Form>
    );
}
