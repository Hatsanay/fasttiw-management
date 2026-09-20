"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import { deviceLabel } from "@/app/lib/device";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import LogTabs from "../LogTabs";

// ประวัติการเข้าสู่ระบบของลูกค้าทุกคน (2026-09-20)
// คู่กับปุ่มดูรายลูกค้าในหน้า /customers — หน้านี้ตอบคนละคำถาม: "ช่วงนี้มีอะไรผิดปกติบ้าง"
// (เช่นมีใครกำลังถูกไล่เดารหัสผ่านอยู่ไหม) ไม่ใช่ "ลูกค้าคนนี้ใช้งานจากที่ไหนบ้าง"
type Row = {
    clog_id: string;
    clog_customer_id: string | null;
    clog_identifier: string | null;
    clog_action: "login" | "login_failed" | "login_google" | "logout" | "register" | "password_reset" | "device_revoked";
    clog_ip: string | null;
    clog_user_agent: string | null;
    clog_created_at: string;
    cus_username: string | null;
    cus_email: string | null;
    cus_fullname: string | null;
};

type Summary = { events_24h: number; logins_24h: number; failed_24h: number; failed_ips_24h: number };

const ACTION_LABEL: Record<Row["clog_action"], string> = {
    login: "เข้าสู่ระบบ",
    login_google: "เข้าสู่ระบบด้วย Google",
    login_failed: "เข้าสู่ระบบไม่สำเร็จ",
    logout: "ออกจากระบบ",
    register: "สมัครสมาชิก",
    password_reset: "ตั้งรหัสผ่านใหม่",
    device_revoked: "ตัดอุปกรณ์อื่นออก",
};

// ใส่สีเฉพาะเหตุการณ์ที่ต้องสะดุดตา — ถ้าระบายทุกแถวจะไม่เหลืออะไรที่เด่นจริง
const ACTION_TONE: Partial<Record<Row["clog_action"], string>> = {
    login_failed: "text-red-600",
    password_reset: "text-amber-600",
    device_revoked: "text-amber-600",
};

const FILTERS: { value: string; label: string }[] = [
    { value: "", label: "ทั้งหมด" },
    { value: "login", label: "เข้าสู่ระบบ" },
    { value: "login_failed", label: "ไม่สำเร็จ" },
    { value: "register", label: "สมัครสมาชิก" },
    { value: "password_reset", label: "ตั้งรหัสใหม่" },
];

export default function CustomerLoginLogsPage() {
    const [isPending, startTransition] = useTransition();
    const [rows, setRows] = useState<Row[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState("");
    const [action, setAction] = useState("");
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        const query = new URLSearchParams({
            limit: String(pageSize),
            offset: String((page - 1) * pageSize),
            ...(search ? { search } : {}),
            ...(action ? { action } : {}),
        });
        startTransition(async () => {
            // ทิ้งผลลัพธ์ของคำขอที่เก่ากว่า — พิมพ์ค้นหาเร็วๆ แล้วผลเก่ามาช้ากว่าจะทับผลใหม่
            const token = begin();
            const res = await fetch(`${api}/customer-login-logs?${query}`, { headers: authHeader() });
            if (!res.ok || !isCurrent(token)) return;
            const data = await res.json();
            setRows(data.data);
            setTotal(data.total);
            setSummary(data.summary);
        });
    }, [page, pageSize, search, action, begin, isCurrent]);

    const columns: Column<Row>[] = [
        {
            key: "clog_created_at",
            header: "เวลา",
            className: "whitespace-nowrap",
            render: (v) => <span className="text-gray-500">{thaiDateTime(v as string)}</span>,
        },
        {
            key: "cus_username",
            header: "ลูกค้า",
            render: (_v, row) => (
                <div className="min-w-0">
                    <p className="truncate text-gray-800">
                        {row.cus_fullname ?? row.cus_username ?? row.clog_identifier ?? "—"}
                    </p>
                    {/* บัญชีที่ไม่มีอยู่จริง = คนไล่เดาชื่อผู้ใช้ ต้องดูออกทันทีว่าไม่ใช่ลูกค้าของเรา */}
                    <p className="truncate text-xs text-gray-400">
                        {row.clog_customer_id ? (row.cus_email ?? row.cus_username) : "ไม่มีบัญชีนี้ในระบบ"}
                    </p>
                </div>
            ),
        },
        {
            key: "clog_action",
            header: "เหตุการณ์",
            render: (v) => (
                <span className={ACTION_TONE[v as Row["clog_action"]] ?? "text-gray-700"}>
                    {ACTION_LABEL[v as Row["clog_action"]] ?? String(v)}
                </span>
            ),
        },
        { key: "clog_user_agent", header: "อุปกรณ์", render: (v) => <span className="text-gray-500">{deviceLabel(v as string)}</span> },
        { key: "clog_ip", header: "IP", render: (v) => <span className="font-mono text-xs text-gray-400">{(v as string) ?? "—"}</span> },
    ];

    return (
        <div className="p-4 sm:p-6">
            <LogTabs />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">การเข้าสู่ระบบของลูกค้า</h1>
            <p className="text-sm text-gray-400 mb-4">
                ทุกครั้งที่บัญชีลูกค้าถูกใช้ ทั้งสำเร็จและไม่สำเร็จ พร้อม IP และอุปกรณ์ —
                ดูประวัติของลูกค้าคนเดียวพร้อมสัญญาณการแชร์บัญชีได้ที่ปุ่มรูปนาฬิกาในหน้า จัดการลูกค้า · หน้านี้ดูได้อย่างเดียว แก้หรือลบไม่ได้
            </p>

            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <Stat label="เหตุการณ์ 24 ชม." value={summary.events_24h} />
                    <Stat label="เข้าสู่ระบบ 24 ชม." value={summary.logins_24h} />
                    <Stat label="ไม่สำเร็จ 24 ชม." value={summary.failed_24h} tone={summary.failed_24h >= 20 ? "text-red-600" : undefined} />
                    <Stat label="IP ที่ล็อกอินไม่สำเร็จ" value={summary.failed_ips_24h} />
                </div>
            )}

            {/* จำนวนครั้งที่ไม่สำเร็จเยอะแต่มาจาก IP เดียว = คนเดียวลืมรหัส / เยอะและกระจายหลาย IP = ถูกไล่เดารหัส */}
            {summary && summary.failed_24h >= 20 && (
                <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ใน 24 ชม. มีการล็อกอินไม่สำเร็จ {summary.failed_24h} ครั้ง จาก {summary.failed_ips_24h} IP —
                    ถ้ากระจายหลาย IP มักเป็นการไล่เดารหัสผ่าน ถ้ามาจาก IP เดียวมักเป็นลูกค้าที่ลืมรหัสผ่าน (กรองดูที่ปุ่ม &quot;ไม่สำเร็จ&quot;)
                </p>
            )}

            <div className="flex flex-wrap items-center gap-1 mb-3">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => { setAction(f.value); setPage(1); }}
                        className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                            action === f.value ? "border-blue-300 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <DataTable
                columns={columns}
                data={rows}
                rowKey="clog_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                searchable
                searchPlaceholder="ค้นหาชื่อลูกค้า อีเมล หรือ IP..."
                searchValue={search}
                onSearch={(val) => { setSearch(val); setPage(1); }}
            />
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
