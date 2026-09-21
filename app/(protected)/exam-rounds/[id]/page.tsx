"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import Button from "@/components/ui/Button/Button";
import { toast } from "sonner";

type Round = {
    er_id: string; er_name: string; er_exam_date: string; er_result_date: string | null;
    er_status: "open" | "closed";
    invited: number; answered: number; passed: number; failed: number; pending_result: number;
    decided: number; pass_rate: number | null; publishable: boolean; min_responses_for_public: number;
};

type Outcome = {
    eo_id: string;
    eo_outcome: "passed" | "failed" | "pending_result" | "absent" | null;
    eo_score: string | null;
    eo_comment: string | null;
    eo_publish_consent: number;
    eo_display_name: string | null;
    eo_approved: number;
    eo_opted_out: number;
    eo_reminders_sent: number;
    eo_last_sent_at: string | null;
    eo_answered_at: string | null;
    cus_id: string; cus_username: string; cus_email: string | null; cus_fullname: string | null;
};

type Product = { prod_id: string; prod_name: string };

const OUTCOME_LABEL: Record<NonNullable<Outcome["eo_outcome"]>, string> = {
    passed: "ผ่าน",
    failed: "ไม่ผ่าน",
    pending_result: "ยังไม่ประกาศผล",
    absent: "ไม่ได้ไปสอบ",
};
const OUTCOME_TONE: Record<NonNullable<Outcome["eo_outcome"]>, string> = {
    passed: "text-green-600",
    failed: "text-red-600",
    pending_result: "text-amber-600",
    absent: "text-gray-400",
};

export default function ExamRoundDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const [isPending, startTransition] = useTransition();
    const [round, setRound] = useState<Round | null>(null);
    const [outcomes, setOutcomes] = useState<Outcome[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productId, setProductId] = useState("");
    const [inviteOpen, setInviteOpen] = useState(false);
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        startTransition(async () => {
            const res = await fetch(`${api}/exam-rounds/${id}`, { headers: authHeader() });
            if (!res.ok) return;
            const data = await res.json();
            setRound(data.round);
            setOutcomes(data.outcomes);
        });
    }, [id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        (async () => {
            const res = await fetch(`${api}/products?limit=200`, { headers: authHeader() });
            if (!res.ok) return;
            const data = await res.json();
            setProducts(data.data ?? []);
        })();
    }, []);

    async function handleInvite() {
        setSending(true);
        try {
            const res = await fetch(`${api}/exam-rounds/${id}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(productId ? { product_id: productId } : {}),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return toast.error(data.message ?? "ส่งไม่สำเร็จ");
            toast.success(data.message);
            setInviteOpen(false);
            load();
        } finally {
            setSending(false);
        }
    }

    async function toggleApprove(row: Outcome) {
        const res = await fetch(`${api}/exam-outcomes/${row.eo_id}/approve`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeader() },
            body: JSON.stringify({ approved: !row.eo_approved }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return toast.error(data.message ?? "ทำรายการไม่สำเร็จ");
        toast.success(data.message);
        load();
    }

    async function toggleStatus() {
        const next = round?.er_status === "open" ? "closed" : "open";
        const res = await fetch(`${api}/exam-rounds/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeader() },
            body: JSON.stringify({ er_status: next }),
        });
        if (!res.ok) return toast.error("ทำรายการไม่สำเร็จ");
        toast.success(next === "closed" ? "ปิดรับคำตอบแล้ว" : "เปิดรับคำตอบอีกครั้ง");
        load();
    }

    if (!round) return <div className="p-4 sm:p-6 text-sm text-gray-400">{isPending ? "กำลังโหลด…" : "ไม่พบรอบสอบนี้"}</div>;

    return (
        <div className="p-4 sm:p-6">
            <button
                type="button"
                onClick={() => router.push("/exam-rounds")}
                className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="w-4 h-4" /> กลับไปรายการรอบสอบ
            </button>

            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{round.er_name}</h1>
                    <p className="text-sm text-gray-400">
                        สอบ {new Date(round.er_exam_date).toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" })}
                        {round.er_status === "closed" && " · ปิดรับคำตอบแล้ว"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleStatus}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        {round.er_status === "open" ? "ปิดรับคำตอบ" : "เปิดรับคำตอบ"}
                    </button>
                    {round.er_status === "open" && (
                        <Button onClick={() => setInviteOpen(true)}>
                            <span className="flex items-center gap-1"><Send className="w-4 h-4" /> ส่งอีเมลถามผล</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                <Stat label="ส่งไปแล้ว" value={round.invited} />
                <Stat label="ตอบแล้ว" value={round.answered} />
                <Stat label="ผ่าน" value={round.passed} tone="text-green-600" />
                <Stat label="ไม่ผ่าน" value={round.failed} tone="text-red-600" />
                <Stat label="อัตราผ่าน" value={round.pass_rate === null ? "—" : `${round.pass_rate}%`} />
            </div>
            <p className="text-xs text-gray-400 mb-6">
                อัตราผ่านคิดจากผู้ที่รู้ผลแล้ว {round.decided} คน (คนที่ตอบว่ายังไม่ประกาศผลยังไม่ถูกนับ) ·{" "}
                {round.publishable
                    ? "จำนวนถึงเกณฑ์ที่เอาไปแสดงบนหน้าเว็บได้แล้ว"
                    : `ต้องมีผู้รู้ผลครบ ${round.min_responses_for_public} คนก่อนถึงจะแสดงบนหน้าเว็บได้`}
            </p>

            <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-400 text-left bg-gray-50">
                            <th className="px-4 py-2 font-medium">ลูกค้า</th>
                            <th className="px-4 py-2 font-medium">ผล</th>
                            <th className="px-4 py-2 font-medium">คะแนน</th>
                            <th className="px-4 py-2 font-medium">ข้อความ</th>
                            <th className="px-4 py-2 font-medium">ตอบเมื่อ</th>
                            <th className="px-4 py-2 font-medium text-right">แสดงบนเว็บ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {outcomes.map((o) => (
                            <tr key={o.eo_id} className="border-t border-gray-50 align-top">
                                <td className="px-4 py-3">
                                    <p className="text-gray-800">{o.cus_fullname ?? o.cus_username}</p>
                                    <p className="text-xs text-gray-400">
                                        {o.cus_email ?? "ไม่มีอีเมล"} · ส่งแล้ว {o.eo_reminders_sent} ฉบับ
                                        {o.eo_opted_out ? " · ขอไม่รับอีเมล" : ""}
                                    </p>
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap ${o.eo_outcome ? OUTCOME_TONE[o.eo_outcome] : "text-gray-300"}`}>
                                    {o.eo_outcome ? OUTCOME_LABEL[o.eo_outcome] : "ยังไม่ตอบ"}
                                </td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{o.eo_score ?? "—"}</td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs">
                                    {o.eo_comment ? (
                                        <>
                                            <p className="whitespace-pre-wrap">{o.eo_comment}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {o.eo_publish_consent ? `ยินยอมให้เผยแพร่ในชื่อ "${o.eo_display_name}"` : "ไม่ยินยอมให้เผยแพร่"}
                                            </p>
                                        </>
                                    ) : "—"}
                                </td>
                                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{thaiDateTime(o.eo_answered_at)}</td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    {/* อนุมัติได้เฉพาะคนที่ยินยอมไว้จริง — backend ปฏิเสธซ้ำอีกชั้นถ้าฝืนกด */}
                                    {o.eo_publish_consent && o.eo_comment ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleApprove(o)}
                                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                                                o.eo_approved
                                                    ? "bg-green-50 text-green-600 hover:bg-green-100"
                                                    : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                                            }`}
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {o.eo_approved ? "แสดงอยู่" : "อนุมัติให้แสดง"}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-gray-300">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {outcomes.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">ยังไม่ได้ส่งอีเมลถามใคร</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ConfirmDialog รับ children ไม่ได้ และกล่องนี้ต้องมีช่องเลือกกลุ่มผู้รับอยู่ข้างใน จึงเขียนเอง */}
            {inviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h2 className="text-base font-semibold text-gray-800 mb-1">ส่งอีเมลถามผลสอบ</h2>
                        <p className="text-xs text-gray-400 mb-4">
                            คนที่ไม่มีอีเมล คนที่กดขอไม่รับ และคนที่ได้ครบ 3 ฉบับแล้วจะถูกข้ามอัตโนมัติ
                        </p>

                        <label className="block text-sm text-gray-600 mb-1">ส่งให้ใคร</label>
                        <select
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            className="mb-5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                            <option value="">ลูกค้าทุกคนที่มีสิทธิ์ใช้งานอยู่</option>
                            {products.map((p) => (
                                <option key={p.prod_id} value={p.prod_id}>เฉพาะคนที่ถือสิทธิ์: {p.prod_name}</option>
                            ))}
                        </select>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setInviteOpen(false)}
                                disabled={sending}
                                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <Button onClick={handleInvite} disabled={sending}>{sending ? "กำลังส่ง…" : "ส่งเลย"}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
    return (
        <div className="rounded-xl border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-lg font-semibold ${tone ?? "text-gray-800"}`}>{value}</p>
        </div>
    );
}
