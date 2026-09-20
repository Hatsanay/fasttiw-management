"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import { deviceLabel } from "@/app/lib/device";
import Button from "@/components/ui/Button/Button";

// อุปกรณ์ที่ล็อกอินอยู่ของบัญชีตัวเอง (2026-09-20)
// ข้อมูลนี้มีใน tb_user_sessions ตั้งแต่ทำระบบ session แล้ว แต่ไม่มีหน้าจอให้ดู — เจ้าตัวจึงไม่มีทางรู้ว่ามี
// เครื่องแปลกปลอมค้างอยู่ไหม ทั้งที่นี่คือสัญญาณแรกสุดที่บอกว่าบัญชีถูกยึด
type Session = {
    usess_id: string;
    device_info: string | null;
    ip: string | null;
    created_at: string;
    last_seen_at: string | null;
    is_current: boolean;
};

export default function SessionsSection() {
    const [sessions, setSessions] = useState<Session[] | null>(null);
    const [pending, setPending] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`${api}/users/me/sessions`, { headers: authHeader() });
        if (!res.ok) return;
        const data = await res.json();
        setSessions(data.data);
    }, []);

    // เรียกใน async IIFE — setState เกิดหลัง await เสมอ ไม่ใช่ระหว่าง render รอบเดียวกัน
    useEffect(() => {
        (async () => { await load(); })();
    }, [load]);

    async function revoke(id: string) {
        setPending(id);
        try {
            const res = await fetch(`${api}/users/me/sessions/${id}`, { method: "DELETE", headers: authHeader() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.message ?? "ตัดการเชื่อมต่อไม่สำเร็จ");
            toast.success(data.message);
            await load();
        } catch {
            toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
        } finally {
            setPending(null);
        }
    }

    if (!sessions) return null;

    return (
        <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">อุปกรณ์ที่ล็อกอินอยู่</h2>
            <div className="bg-white shadow-sm border border-gray-100 rounded-xl divide-y divide-gray-100">
                {sessions.map((s) => (
                    <div key={s.usess_id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
                        <div className="flex items-start gap-3 min-w-0">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                                <Laptop size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm text-gray-800">
                                    {deviceLabel(s.device_info)}
                                    {s.is_current && (
                                        <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
                                            เครื่องนี้
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-400">
                                    เข้าสู่ระบบ {thaiDateTime(s.created_at)} · ใช้งานล่าสุด {thaiDateTime(s.last_seen_at)}
                                    {s.ip ? ` · IP ${s.ip}` : ""}
                                </p>
                            </div>
                        </div>
                        {!s.is_current && (
                            <Button type="button" onClick={() => revoke(s.usess_id)} disabled={pending === s.usess_id}>
                                <span className="inline-flex items-center gap-1.5">
                                    <LogOut size={15} />
                                    {pending === s.usess_id ? "กำลังตัด..." : "ตัดการเชื่อมต่อ"}
                                </span>
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">
                เห็นอุปกรณ์ที่ไม่ใช่ของคุณ ให้กดตัดการเชื่อมต่อแล้วเปลี่ยนรหัสผ่านทันที
                (การเปลี่ยนรหัสผ่านจะตัดทุกเครื่องออกให้เองอยู่แล้ว)
            </p>
        </div>
    );
}
