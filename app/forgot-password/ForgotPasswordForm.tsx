"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/app/constans";
import Form from "@/components/ui/form/Form";
import Input from "@/components/ui/Input/input";
import Button from "@/components/ui/Button/Button";

// ลืมรหัสผ่านของผู้ใช้งานระบบหลังบ้าน (2026-09-20) — 2 ขั้นในหน้าเดียว
//   ขั้น 1 กรอกอีเมล → backend ส่งรหัส 6 หลักไปทางอีเมล
//   ขั้น 2 กรอกรหัส + รหัสผ่านใหม่ → ตั้งรหัสผ่านใหม่แล้วกลับไปหน้าเข้าสู่ระบบ
//
// **ยิงผ่าน fetch ตรงๆ ไม่ใช้ Server Action โดยตั้งใจ** — WAF ของโฮสต์ (ModSecurity) ตอบ 403 ให้ request
// ที่มีสตริง `$@` ซึ่ง Next แนบมากับฟอร์ม Server Action ทุกหน้า (ดู CLAUDE.md ข้อ 6.2) ฝั่งลูกค้าเคยเจอ
// ปัญหานี้จริงกับหน้าตั้งรหัสผ่านใหม่มาแล้ว หน้านี้จึงเลี่ยงตั้งแต่แรก
const RESEND_SECONDS = 60;

type Step = "email" | "otp";
type FormErrors = { email?: string; otp?: string; password?: string; confirm?: string };

export default function ForgotPasswordForm() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const [pending, setPending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // นับถอยหลังปุ่ม "ส่งรหัสอีกครั้ง" — กันคนกดรัวจนติดลิมิตฝั่ง backend โดยไม่รู้ตัว
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    async function post(path: string, body: Record<string, string>) {
        const res = await fetch(`${api}/auth/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, message: data.message as string | undefined };
    }

    async function requestOtp(isResend = false) {
        if (!email.trim()) return setErrors({ email: "กรุณากรอกอีเมล" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErrors({ email: "รูปแบบอีเมลไม่ถูกต้อง" });

        setPending(true);
        try {
            const { ok, message } = await post("forgot-password", { user_email: email.trim() });
            if (!ok) return toast.error(message ?? "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่");
            toast.success(message ?? "ส่งรหัสยืนยันแล้ว");
            setStep("otp");
            setCooldown(RESEND_SECONDS);
            if (isResend) setOtp("");
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setPending(false);
        }
    }

    async function resetPassword() {
        const fieldErrors: FormErrors = {};
        if (!/^\d{6}$/.test(otp.trim())) fieldErrors.otp = "กรอกรหัส 6 หลักที่ส่งไปทางอีเมล";
        if (password.length < 8) fieldErrors.password = "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
        else if (password !== confirm) fieldErrors.confirm = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
        if (Object.keys(fieldErrors).length > 0) return setErrors(fieldErrors);

        setPending(true);
        try {
            const { ok, message } = await post("reset-password", {
                user_email: email.trim(), otp: otp.trim(), new_password: password,
            });
            if (!ok) return toast.error(message ?? "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
            toast.success(message ?? "ตั้งรหัสผ่านใหม่สำเร็จ");
            router.push("/");
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setPending(false);
        }
    }

    return (
        <Form
            cols={1}
            className="max-w-md mx-auto"
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                if (step === "email") requestOtp();
                else resetPassword();
            }}
        >
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-2 text-blue-400">ลืมรหัสผ่าน</h1>
                <p className="text-sm text-gray-500 mb-2">
                    {step === "email"
                        ? "กรอกอีเมลของบัญชีผู้ใช้งานระบบ เราจะส่งรหัสยืนยัน 6 หลักไปให้"
                        : `กรอกรหัสที่ส่งไปที่ ${email} แล้วตั้งรหัสผ่านใหม่`}
                </p>
            </div>

            {step === "email" ? (
                <div className="flex flex-col gap-1">
                    <Input
                        type="email" placeholder="อีเมล" value={email} autoFocus
                        onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                        error={!!errors.email}
                    />
                    {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        <Input
                            type="text" inputMode="numeric" maxLength={6} placeholder="รหัส 6 หลัก" value={otp} autoFocus
                            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setErrors((p) => ({ ...p, otp: undefined })); }}
                            error={!!errors.otp}
                            className="tracking-[0.4em] text-center"
                        />
                        {errors.otp && <p className="text-xs text-red-500">{errors.otp}</p>}
                        <button
                            type="button"
                            onClick={() => requestOtp(true)}
                            disabled={pending || cooldown > 0}
                            className="self-start text-xs text-blue-500 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                            {cooldown > 0 ? `ส่งรหัสอีกครั้งได้ใน ${cooldown} วินาที` : "ส่งรหัสอีกครั้ง"}
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Input
                            type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)" value={password}
                            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                            error={!!errors.password}
                        />
                        {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                        <Input
                            type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirm}
                            onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                            error={!!errors.confirm}
                        />
                        {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
                    </div>
                </>
            )}

            <Button type="submit" disabled={pending}>
                {pending
                    ? "กำลังดำเนินการ..."
                    : step === "email" ? "ส่งรหัสยืนยัน" : "ตั้งรหัสผ่านใหม่"}
            </Button>

            <div className="text-center">
                <Link href="/" className="text-sm text-gray-500 hover:text-blue-500 hover:underline">
                    กลับไปหน้าเข้าสู่ระบบ
                </Link>
            </div>
        </Form>
    );
}
