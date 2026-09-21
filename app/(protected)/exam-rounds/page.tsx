"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Users2 } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";

// รอบสอบ + ผลสอบจริงของลูกค้า (2026-09-20)
// ดูเหตุผลของระบบที่ backend/src/controllers/examOutcome.controller.js — สั้นๆ คือมันเป็นข้อมูลเดียว
// ที่บอกได้ว่า "เนื้อหาเราตรงสนามจริงไหม" และเป็นหลักฐานที่คู่แข่งลอกไม่ได้
type Round = {
    er_id: string;
    er_name: string;
    er_exam_date: string;
    er_result_date: string | null;
    er_status: "open" | "closed";
    invited: number;
    answered: number;
    passed: number;
    failed: number;
    pending_result: number;
    decided: number;
    pass_rate: number | null;
    publishable: boolean;
    min_responses_for_public: number;
};

const thaiDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "—";

export default function ExamRoundsPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [rounds, setRounds] = useState<Round[]>([]);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ er_name: "", er_exam_date: "", er_result_date: "" });
    const [deleteTarget, setDeleteTarget] = useState<Round | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(() => {
        startTransition(async () => {
            const res = await fetch(`${api}/exam-rounds`, { headers: authHeader() });
            if (!res.ok) return;
            setRounds((await res.json()).data);
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCreate() {
        if (!form.er_name.trim() || !form.er_exam_date) return toast.error("กรอกชื่อรอบสอบและวันสอบก่อน");
        setCreating(true);
        try {
            const res = await fetch(`${api}/exam-rounds`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ ...form, er_result_date: form.er_result_date || null }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.message ?? "สร้างไม่สำเร็จ");
            toast.success(data.message);
            setForm({ er_name: "", er_exam_date: "", er_result_date: "" });
            load();
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/exam-rounds/${deleteTarget.er_id}`, { method: "DELETE", headers: authHeader() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.message ?? "ลบไม่สำเร็จ");
            toast.success(data.message);
            load();
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">รอบสอบ &amp; ผลสอบจริง</h1>
            <p className="text-sm text-gray-400 mb-6">
                ถามลูกค้าหลังวันสอบว่าผลเป็นยังไง — ใช้ดูว่าเนื้อหาของเราตรงกับสนามจริงแค่ไหน
                และเป็นตัวเลขที่เอาไปแสดงบนหน้าเว็บได้เมื่อมีผู้ตอบมากพอ
            </p>

            <div className="rounded-2xl border border-gray-100 p-4 sm:p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                        <CalendarCheck className="w-4 h-4" />
                    </span>
                    <h2 className="font-medium text-gray-800">สร้างรอบสอบใหม่</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                    <Field label="ชื่อรอบสอบ">
                        <Input
                            value={form.er_name}
                            onChange={(e) => setForm((p) => ({ ...p, er_name: e.target.value }))}
                            placeholder="เช่น ก.พ. ภาค ก 2569 รอบที่ 1"
                            className="w-full"
                        />
                    </Field>
                    <Field label="วันสอบ">
                        <Input
                            type="date"
                            value={form.er_exam_date}
                            onChange={(e) => setForm((p) => ({ ...p, er_exam_date: e.target.value }))}
                            className="w-full"
                        />
                    </Field>
                    <Field label="วันประกาศผล (ถ้ารู้)">
                        <Input
                            type="date"
                            value={form.er_result_date}
                            onChange={(e) => setForm((p) => ({ ...p, er_result_date: e.target.value }))}
                            className="w-full"
                        />
                    </Field>
                    <Button onClick={handleCreate} disabled={creating}>{creating ? "กำลังสร้าง…" : "สร้างรอบ"}</Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    ใส่วันประกาศผลไว้ ระบบจะกลับไปถามซ้ำให้เองตอนผลออก (ถ้าไม่ใส่จะถามซ้ำหลังจากส่งครั้งแรก 21 วัน)
                </p>
            </div>

            {isPending && rounds.length === 0 ? (
                <p className="text-sm text-gray-400">กำลังโหลด…</p>
            ) : rounds.length === 0 ? (
                <p className="text-sm text-gray-400">ยังไม่มีรอบสอบ — สร้างรอบแรกด้านบนได้เลย</p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rounds.map((r) => (
                        <div key={r.er_id} className="rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition-colors">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <button
                                    type="button"
                                    onClick={() => router.push(`/exam-rounds/${r.er_id}`)}
                                    className="text-left font-medium text-gray-800 hover:text-blue-600 transition-colors"
                                >
                                    {r.er_name}
                                </button>
                                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs ${r.er_status === "open" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                                    {r.er_status === "open" ? "เปิดรับคำตอบ" : "ปิดแล้ว"}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">
                                สอบ {thaiDate(r.er_exam_date)}{r.er_result_date ? ` · ประกาศผล ${thaiDate(r.er_result_date)}` : ""}
                            </p>

                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1 text-gray-500">
                                    <Users2 className="w-3.5 h-3.5" /> ส่ง {r.invited}
                                </span>
                                <span className="text-gray-500">ตอบแล้ว {r.answered}</span>
                                {/* อัตราผ่านคิดจากคนที่รู้ผลแล้วเท่านั้น — คนที่ตอบว่ายังไม่ประกาศผลยังไม่นับ */}
                                <span className={r.pass_rate === null ? "text-gray-300" : "font-semibold text-gray-800"}>
                                    {r.pass_rate === null ? "ยังไม่มีผล" : `ผ่าน ${r.pass_rate}%`}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                                <span className={`text-xs ${r.publishable ? "text-green-600" : "text-gray-400"}`}>
                                    {r.publishable
                                        ? "เอาตัวเลขขึ้นหน้าเว็บได้แล้ว"
                                        : `ต้องมีผู้รู้ผลอีก ${r.min_responses_for_public - r.decided} คนถึงจะขึ้นหน้าเว็บได้`}
                                </span>
                                {r.answered === 0 && <DeleteButton onClick={() => setDeleteTarget(r)} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบรอบสอบนี้?"
                description={deleteTarget ? `"${deleteTarget.er_name}" จะถูกลบ (ลบได้เพราะยังไม่มีใครตอบ)` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

// ป้ายชื่อช่องกรอก — Input กลางของโปรเจกต์รับแค่ props ของ <input> ไม่มี label ในตัว
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">{label}</span>
            {children}
        </label>
    );
}
