"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Form from "@/components/ui/form/Form";
import Input from "@/components/ui/Input/input";
import Button from "@/components/ui/Button/Button";
import { handleLogin } from "../actions";

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
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        if (!state) return;
        if ("error" in state) {
            toast.error(state.error);
        } else if ("token" in state) {
            localStorage.setItem("token", state.token);
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
        </Form>
    );
}
