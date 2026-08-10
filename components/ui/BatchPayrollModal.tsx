"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import { X, Check, Users2 } from "lucide-react";
import { toast } from "sonner";

type RunEmployee = {
    user_id: string;
    fullname: string;
    user_base_salary: number;
    payroll: { pay_id: string; pay_net_amount: number; pay_status: "pending" | "paid"; pay_paid_at: string | null } | null;
};

type RunSummary = {
    eligible_count: number;
    paid_count: number;
    paid_amount: number;
    owed_count: number;
    owed_amount: number;
};

type RunStatus = { period: { month: number; year: number }; employees: RunEmployee[]; summary: RunSummary };

type BatchPayResultRow = { pay_id: string; pay_staff_id: string; fullname: string; pay_net_amount: number; exp_id: string };
type BatchPaySkipped = { pay_staff_id: string | null; fullname: string; reason_code: string; message: string };
type BatchPayResponse = {
    period: { month: number; year: number };
    paid: BatchPayResultRow[];
    skipped: BatchPaySkipped[];
    employees: RunEmployee[];
    summary: RunSummary;
};

type RowState = { checked: boolean; deduction_amount: string; deduction_reason: string };

const MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

async function fetchRunStatus(month: number, year: number): Promise<RunStatus | null> {
    const res = await fetch(`${api}/payrolls/run-status?${new URLSearchParams({ month: String(month), year: String(year) })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return null;
    return res.json();
}

async function submitBatchPay(month: number, year: number, items: { pay_staff_id: string; deduction_amount: number; deduction_reason: string | null }[]): Promise<BatchPayResponse> {
    const res = await fetch(`${api}/payrolls/batch-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ period_month: month, period_year: year, items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

type Props = {
    open: boolean;
    onClose: () => void;
    onDone?: () => void;
};

// โมดัลจ่ายเงินเดือนพนักงานแบบชุด — เลือกเดือน/ปี → เห็นรายชื่อพนักงานทุกคนที่ตั้งเงินเดือนพื้นฐานไว้ที่โปรไฟล์
// (คนที่จ่ายไปแล้วของงวดนั้น disable ไว้ กดเลือกไม่ได้) → กรอกยอดหัก+เหตุผลต่อคนที่จะจ่าย → กดจ่ายทีเดียว
// สร้าง+จ่ายพร้อมกันทุกคนที่เลือก แล้วโชว์สรุปผล (จ่ายแล้ว/ค้างจ่าย) ของงวดนั้นทั้งหมด — พอร์ตโครงสร้างมาจาก
// GrantProductsModal.tsx (list เลือกได้หลายรายการ + footer สรุป) แต่แยก step "select"/"results" ชัดเจน
export default function BatchPayrollModal({ open, onClose, onDone }: Props) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [loading, setLoading] = useState(false);
    const [run, setRun] = useState<RunStatus | null>(null);
    const [rows, setRows] = useState<Map<string, RowState>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<"select" | "results">("select");
    const [result, setResult] = useState<BatchPayResponse | null>(null);

    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้อง reset step/result ให้เสร็จก่อน fetch async เริ่ม กันผลลัพธ์ของงวดก่อนหน้าค้างโชว์
        setStep("select");
        setResult(null);
        setLoading(true);
        fetchRunStatus(month, year).then((data) => {
            setRun(data);
            if (data) {
                const next = new Map<string, RowState>();
                for (const e of data.employees) {
                    const alreadyPaid = e.payroll?.pay_status === "paid";
                    next.set(e.user_id, { checked: !alreadyPaid, deduction_amount: "0", deduction_reason: "" });
                }
                setRows(next);
            }
            setLoading(false);
        });
    }, [open, month, year]);

    function updateRow(userId: string, patch: Partial<RowState>) {
        setRows((prev) => {
            const next = new Map(prev);
            const current = next.get(userId);
            if (current) next.set(userId, { ...current, ...patch });
            return next;
        });
    }

    async function handleSubmit() {
        if (!run) return;
        const items = run.employees
            .filter((e) => e.payroll?.pay_status !== "paid" && rows.get(e.user_id)?.checked)
            .map((e) => {
                const row = rows.get(e.user_id)!;
                return {
                    pay_staff_id: e.user_id,
                    deduction_amount: Number(row.deduction_amount) || 0,
                    deduction_reason: row.deduction_reason.trim() || null,
                };
            });
        if (items.length === 0) {
            toast.error("กรุณาเลือกพนักงานอย่างน้อย 1 คน");
            return;
        }

        setSubmitting(true);
        try {
            const data = await submitBatchPay(month, year, items);
            setResult(data);
            setStep("results");
            onDone?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    }

    function handleClose() {
        onClose();
    }

    if (!open) return null;

    const selectedEmployees = run?.employees.filter((e) => e.payroll?.pay_status !== "paid") ?? [];
    const checkedCount = selectedEmployees.filter((e) => rows.get(e.user_id)?.checked).length;
    const totalNet = selectedEmployees.reduce((sum, e) => {
        const row = rows.get(e.user_id);
        if (!row?.checked) return sum;
        const net = e.user_base_salary - (Number(row.deduction_amount) || 0);
        return sum + net;
    }, 0);

    const skippedByStaffId = new Map((result?.skipped ?? []).map((s) => [s.pay_staff_id, s]));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-6 pt-6 pb-4 flex items-center gap-3 shrink-0 border-b border-gray-50">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Users2 className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-gray-800">จ่ายเงินเดือนพนักงานแบบชุด</h2>
                        <p className="text-xs text-gray-400">
                            {step === "select" ? "เลือกพนักงานที่จะจ่ายรอบนี้ กรอกยอดหัก/เหตุผลได้ต่อคน" : "สรุปผลการจ่ายเงินเดือน"}
                        </p>
                    </div>
                    <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {step === "select" ? (
                    <div className="overflow-y-auto flex-1 flex flex-col">
                        <div className="px-6 pt-4 flex items-center gap-2 shrink-0">
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                            {run && (
                                <span className="text-xs text-gray-400 ml-1">
                                    งวดนี้จ่ายแล้ว {run.summary.paid_count} จาก {run.summary.eligible_count} คน
                                </span>
                            )}
                        </div>

                        <div className="px-4 pt-3 min-h-70">
                            {loading ? (
                                <p className="text-sm text-gray-400 py-10 text-center">กำลังโหลด...</p>
                            ) : !run || run.employees.length === 0 ? (
                                <p className="text-sm text-gray-400 py-10 text-center">
                                    ยังไม่มีพนักงานที่ตั้งเงินเดือนพื้นฐานไว้ — ไปตั้งค่าที่หน้าแก้ไขผู้ใช้งานก่อน
                                </p>
                            ) : (
                                <div className="space-y-1 pb-2">
                                    {run.employees.map((e) => {
                                        const alreadyPaid = e.payroll?.pay_status === "paid";
                                        const row = rows.get(e.user_id);
                                        return (
                                            <div
                                                key={e.user_id}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl ${alreadyPaid ? "opacity-50" : row?.checked ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                            >
                                                <button
                                                    type="button"
                                                    disabled={alreadyPaid}
                                                    onClick={() => updateRow(e.user_id, { checked: !row?.checked })}
                                                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                        row?.checked ? "bg-blue-500" : "bg-gray-100"
                                                    } ${alreadyPaid ? "cursor-not-allowed" : ""}`}
                                                >
                                                    {row?.checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                                </button>
                                                <div className="w-36 shrink-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{e.fullname}</p>
                                                    <p className="text-xs text-gray-400">{formatBaht(e.user_base_salary)}</p>
                                                </div>
                                                {alreadyPaid ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">จ่ายแล้ว</span>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="number" min={0} step="0.01"
                                                            value={row?.deduction_amount ?? "0"}
                                                            onChange={(ev) => updateRow(e.user_id, { deduction_amount: ev.target.value })}
                                                            placeholder="ยอดหัก"
                                                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={row?.deduction_reason ?? ""}
                                                            onChange={(ev) => updateRow(e.user_id, { deduction_reason: ev.target.value })}
                                                            placeholder="เหตุผลที่หัก (ไม่บังคับ)"
                                                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 shrink-0 sticky bottom-0 bg-white space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">เลือกจ่าย {checkedCount} คน</span>
                                <span className="font-semibold text-gray-800">รวม {formatBaht(totalNet)}</span>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={handleClose} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={checkedCount === 0 || submitting}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                                >
                                    {submitting ? "กำลังบันทึก..." : `จ่ายเงินเดือน${checkedCount > 0 ? ` (${checkedCount})` : ""}`}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    result && (
                        <div className="overflow-y-auto flex-1 flex flex-col">
                            <div className="px-6 pt-4 grid grid-cols-2 gap-3 shrink-0">
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-xs text-green-600">จ่ายแล้ว (งวดนี้)</p>
                                    <p className="text-lg font-bold text-green-700">{result.summary.paid_count} คน</p>
                                    <p className="text-xs text-green-600">{formatBaht(result.summary.paid_amount)}</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-3">
                                    <p className="text-xs text-amber-600">ค้างจ่าย (งวดนี้)</p>
                                    <p className="text-lg font-bold text-amber-700">{result.summary.owed_count} คน</p>
                                    <p className="text-xs text-amber-600">{formatBaht(result.summary.owed_amount)}</p>
                                </div>
                            </div>

                            <div className="px-6 pt-4 space-y-4">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1.5">รายชื่อที่จ่ายแล้ว</p>
                                    <div className="space-y-1">
                                        {result.employees.filter((e) => e.payroll?.pay_status === "paid").map((e) => (
                                            <div key={e.user_id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg bg-gray-50">
                                                <span className="text-gray-700">{e.fullname}</span>
                                                <span className="text-green-600 font-medium">{formatBaht(e.payroll!.pay_net_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold text-gray-500 mb-1.5">รายชื่อที่ยังค้างจ่าย</p>
                                    <div className="space-y-1">
                                        {result.employees.filter((e) => e.payroll?.pay_status !== "paid").map((e) => {
                                            const skip = skippedByStaffId.get(e.user_id);
                                            return (
                                                <div key={e.user_id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg bg-amber-50/60">
                                                    <span className="text-gray-700">{e.fullname}</span>
                                                    <span className="text-amber-600 text-xs">{skip ? skip.message : "ยังไม่ได้เลือกจ่ายรอบนี้"}</span>
                                                </div>
                                            );
                                        })}
                                        {result.employees.filter((e) => e.payroll?.pay_status !== "paid").length === 0 && (
                                            <p className="text-xs text-gray-400 px-2.5">ไม่มีใครค้างจ่ายแล้ว</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 mt-auto border-t border-gray-100 shrink-0 sticky bottom-0 bg-white flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                >
                                    เสร็จสิ้น
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
