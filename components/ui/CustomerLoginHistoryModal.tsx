"use client";

import { useCallback, useEffect, useState } from "react";
import { History, ShieldAlert, X } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import { deviceLabel } from "@/app/lib/device";

// ประวัติการเข้าสู่ระบบรายลูกค้า (2026-09-20)
// CLAUDE.md ข้อ 7 ระบุว่าการแชร์บัญชีคือความเสี่ยงอันดับ 1 ของธุรกิจนี้ แต่เดิมแอดมินดูได้แค่ "ตอนนี้
// ล็อกอินอยู่กี่เครื่อง" ซึ่งไม่มีทางเกิน 2 เพราะโควตาจำกัดไว้เอง — ต่อให้หมุนเวียนกันใช้สิบคนก็ยังเห็น 2
type LogRow = {
    clog_id: string;
    clog_action: "login" | "login_failed" | "login_google" | "logout" | "register" | "password_reset" | "device_revoked";
    clog_identifier: string | null;
    clog_ip: string | null;
    clog_user_agent: string | null;
    clog_created_at: string;
};

type Summary = {
    logins_7d: number;
    logins_30d: number;
    ip_blocks_7d: number;
    ip_blocks_30d: number;
    devices_7d: number;
    devices_30d: number;
    failed_7d: number;
    sharing_suspected: boolean;
};

const ACTION_LABEL: Record<LogRow["clog_action"], string> = {
    login: "เข้าสู่ระบบ",
    login_google: "เข้าสู่ระบบด้วย Google",
    login_failed: "เข้าสู่ระบบไม่สำเร็จ",
    logout: "ออกจากระบบ",
    register: "สมัครสมาชิก",
    password_reset: "ตั้งรหัสผ่านใหม่",
    device_revoked: "ตัดอุปกรณ์อื่นออก",
};

// สีบอกน้ำหนักของเหตุการณ์ ไม่ใช่ระบายให้ครบทุกแถว — แถวที่ต้องสะดุดตาคือแถวที่ผิดปกติเท่านั้น
const ACTION_TONE: Partial<Record<LogRow["clog_action"], string>> = {
    login_failed: "text-red-600",
    password_reset: "text-amber-600",
    device_revoked: "text-amber-600",
};

const DAY_OPTIONS = [7, 30, 90];

export default function CustomerLoginHistoryModal({
    customerId,
    customerName,
    onClose,
}: {
    customerId: string;
    customerName: string;
    onClose: () => void;
}) {
    const [days, setDays] = useState(30);
    const [rows, setRows] = useState<LogRow[] | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);

    const load = useCallback(async () => {
        setRows(null);
        const res = await fetch(`${api}/customers/${customerId}/login-logs?days=${days}`, { headers: authHeader() });
        if (!res.ok) return setRows([]);
        const data = await res.json();
        setRows(data.data);
        setSummary(data.summary);
    }, [customerId, days]);

    useEffect(() => {
        (async () => { await load(); })();
    }, [load]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-6 pt-6 pb-4 flex items-start gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <History className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-gray-800">ประวัติการเข้าสู่ระบบ</h2>
                        <p className="text-xs text-gray-400 truncate">{customerName}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        aria-label="ปิด"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 pb-3 shrink-0 space-y-3">
                    {summary && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Stat label="เข้าสู่ระบบ 7 วัน" value={summary.logins_7d} />
                                <Stat label="ย่าน IP 7 วัน" value={summary.ip_blocks_7d} />
                                <Stat label="อุปกรณ์ 30 วัน" value={summary.devices_30d} />
                                <Stat label="ล็อกอินไม่สำเร็จ 7 วัน" value={summary.failed_7d} tone={summary.failed_7d >= 5 ? "text-red-600" : undefined} />
                            </div>
                            {summary.sharing_suspected ? (
                                <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    ใช้งานจาก {summary.ip_blocks_7d} ย่าน IP ใน 7 วัน และ {summary.devices_30d} อุปกรณ์ใน 30 วัน —
                                    เข้าข่ายควรตรวจสอบว่าแชร์บัญชีหรือไม่ (ยังไม่ใช่ข้อสรุป คนที่เดินทางบ่อยหรือใช้เน็ตมือถือก็เปลี่ยน IP ได้เอง)
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400">
                                    นับ &quot;ย่าน IP&quot; ไม่ใช่ IP เต็ม เพราะเน็ตมือถือเปลี่ยนเลขท้ายเองตลอดแม้เป็นเครื่องเดิม
                                </p>
                            )}
                        </>
                    )}

                    <div className="flex items-center gap-1">
                        {DAY_OPTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDays(d)}
                                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                                    days === d ? "border-blue-300 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                {d} วัน
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 px-6 pb-6">
                    {rows === null ? (
                        <p className="text-sm text-gray-400 py-6 text-center">กำลังโหลด…</p>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">ไม่มีประวัติในช่วงที่เลือก</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-400 text-left">
                                    <th className="py-2 font-medium">เวลา</th>
                                    <th className="py-2 font-medium">เหตุการณ์</th>
                                    <th className="py-2 font-medium">อุปกรณ์</th>
                                    <th className="py-2 font-medium">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.clog_id} className="border-t border-gray-50">
                                        <td className="py-2 text-gray-500 whitespace-nowrap">{thaiDateTime(r.clog_created_at)}</td>
                                        <td className={`py-2 ${ACTION_TONE[r.clog_action] ?? "text-gray-700"}`}>
                                            {ACTION_LABEL[r.clog_action] ?? r.clog_action}
                                        </td>
                                        <td className="py-2 text-gray-500">{deviceLabel(r.clog_user_agent)}</td>
                                        <td className="py-2 text-gray-400 font-mono text-xs">{r.clog_ip ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
    return (
        <div className="rounded-xl border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-lg font-semibold ${tone ?? "text-gray-800"}`}>{value}</p>
        </div>
    );
}
