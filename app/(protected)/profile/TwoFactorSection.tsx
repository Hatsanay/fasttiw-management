"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/app/constans";
import { authHeader, currentUserId } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";

// ยืนยันตัวตนสองชั้นของบัญชีตัวเอง (2026-09-20) — **เปิด/ปิดเองได้ ไม่บังคับ**
// เปิดแล้วครั้งต่อไปที่เข้าสู่ระบบ ต้องกรอกรหัส 6 หลักที่ส่งไปทางอีเมลเพิ่มอีกชั้น
//
// การเปิดต้องยืนยันด้วยรหัสจากอีเมลก่อนเสมอ (backend บังคับ) — พิสูจน์ว่าเจ้าตัวเข้าอีเมลได้จริง
// ไม่งั้นเปิดไว้แล้วเข้าอีเมลไม่ได้ = ล็อกตัวเองออกจากระบบถาวร ต้องให้แอดมินอีกคนมาแก้ให้
export default function TwoFactorSection() {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [otp, setOtp] = useState("");
    const [awaitingOtp, setAwaitingOtp] = useState(false);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        const userId = currentUserId();
        if (!userId) return;
        (async () => {
            const res = await fetch(`${api}/users/me?user_id=${userId}`, { headers: authHeader() });
            if (!res.ok) return;
            const data = await res.json();
            setEnabled(!!data.user_2fa_enabled);
        })();
    }, []);

    async function send(body: Record<string, unknown>) {
        setPending(true);
        try {
            const res = await fetch(`${api}/auth/2fa`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message ?? "ดำเนินการไม่สำเร็จ");
                return null;
            }
            return data;
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
            return null;
        } finally {
            setPending(false);
        }
    }

    async function startEnable() {
        const data = await send({ enabled: true });
        if (!data) return;
        setAwaitingOtp(true);
        toast.success(data.message);
    }

    async function confirmEnable() {
        const data = await send({ enabled: true, otp });
        if (!data) return;
        setEnabled(true);
        setAwaitingOtp(false);
        setOtp("");
        toast.success(data.message);
    }

    async function disable() {
        const data = await send({ enabled: false });
        if (!data) return;
        setEnabled(false);
        toast.success(data.message);
    }

    if (enabled === null) return null; // ยังไม่รู้สถานะ — ไม่ขึ้นอะไรดีกว่าขึ้นผิด

    return (
        <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">ยืนยันตัวตนสองชั้น</h2>
            <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                            {enabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
                        </span>
                        <div className="min-w-0">
                            <p className={`font-medium ${enabled ? "text-green-700" : "text-gray-700"}`}>
                                {enabled ? "เปิดอยู่" : "ปิดอยู่"}
                            </p>
                            <p className="mt-0.5 text-sm text-gray-500">
                                เปิดไว้แล้วทุกครั้งที่เข้าสู่ระบบ ต้องกรอกรหัส 6 หลักที่ส่งไปทางอีเมลเพิ่มอีกชั้น —
                                ถึงมีคนรู้รหัสผ่านของคุณก็เข้าบัญชีไม่ได้ถ้าไม่มีอีเมลของคุณ
                            </p>
                        </div>
                    </div>

                    {!awaitingOtp && (
                        <Button type="button" onClick={enabled ? disable : startEnable} disabled={pending}>
                            {pending ? "กำลังดำเนินการ..." : enabled ? "ปิดการใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                    )}
                </div>

                {awaitingOtp && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="mb-2 text-sm text-gray-600">
                            กรอกรหัส 6 หลักที่เพิ่งส่งไปทางอีเมล เพื่อยืนยันว่าคุณเข้าอีเมลนี้ได้จริงก่อนเปิดใช้งาน
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                type="text" inputMode="numeric" maxLength={6} autoFocus
                                placeholder="รหัส 6 หลัก" value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                className="w-40 tracking-[0.3em] text-center"
                            />
                            <Button type="button" onClick={confirmEnable} disabled={pending || otp.length !== 6}>
                                {pending ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}
                            </Button>
                            <button
                                type="button"
                                onClick={() => { setAwaitingOtp(false); setOtp(""); }}
                                className="text-sm text-gray-500 hover:text-blue-500 hover:underline"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
