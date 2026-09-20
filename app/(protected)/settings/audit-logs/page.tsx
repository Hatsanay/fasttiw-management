"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import Pagination from "@/components/ui/Pagination";
import LogTabs from "../LogTabs";
import SearchInput from "@/components/ui/SearchInput";
import Input from "@/components/ui/Input/input";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";

// ประวัติการแก้ไขข้อมูล (audit log, 2026-09-20) — อ่านอย่างเดียว ไม่มีปุ่มแก้/ลบโดยตั้งใจ
// ร่องรอยที่ลบได้จากในหน้าเว็บเองไม่ใช่ร่องรอย (คนที่ทำอะไรไม่ถูกต้องจะลบทิ้งเป็นอย่างแรก)
type AuditLog = {
    aud_id: string;
    aud_user_email: string | null;
    aud_user_name: string | null;
    aud_method: string;
    aud_path: string;
    aud_entity: string | null;
    aud_entity_id: string | null;
    aud_summary: string | null;
    aud_payload: unknown;
    aud_status: number;
    aud_ip: string | null;
    aud_created_at: string;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const METHOD_BADGE: Record<string, string> = {
    POST: "bg-green-50 text-green-600",
    PUT: "bg-blue-50 text-blue-600",
    PATCH: "bg-blue-50 text-blue-600",
    DELETE: "bg-red-50 text-red-600",
};

// "สร้าง/แก้ไข/ลบ" อ่านง่ายกว่า POST/PUT/DELETE สำหรับคนที่ไม่ได้เขียนโปรแกรม
const METHOD_LABEL: Record<string, string> = { POST: "สร้าง", PUT: "แก้ไข", PATCH: "แก้ไข", DELETE: "ลบ" };

export default function AuditLogsPage() {
    const [isPending, startTransition] = useTransition();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [entities, setEntities] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState("");
    const [entity, setEntity] = useState("");
    const [failedOnly, setFailedOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);
    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (search) query.set("search", search);
        if (entity) query.set("entity", entity);
        if (failedOnly) query.set("failed", "1");
        if (dateFrom) query.set("date_from", dateFrom);
        if (dateTo) query.set("date_to", dateTo);

        const token = begin();
        startTransition(async () => {
            const res = await fetch(`${api}/audit-logs?${query}`, { headers: authHeader() });
            const result = res.ok
                ? await res.json() as { data: AuditLog[]; total: number; entities: string[] }
                : { data: [], total: 0, entities: [] };
            if (!isCurrent(token)) return; // มี reload() ใหม่กว่าเริ่มไปแล้วระหว่างรอ ทิ้งผลลัพธ์นี้
            setLogs(result.data);
            setTotal(result.total);
            setEntities(result.entities ?? []);
            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, search, entity, failedOnly, dateFrom, dateTo]);

    const resetToFirstPage = <T,>(setter: (v: T) => void) => (value: T) => { setter(value); setPage(1); };

    return (
        <div className="p-4 sm:p-6">
            <LogTabs />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">ประวัติการแก้ไขข้อมูล</h1>
            <p className="text-sm text-gray-400 mb-4">
                บันทึกทุกครั้งที่มีการสร้าง แก้ไข หรือลบข้อมูลในระบบหลังบ้าน พร้อมคนที่ทำและผลลัพธ์ —
                รวมถึงคำขอที่ถูกปฏิเสธ · หน้านี้ดูได้อย่างเดียว แก้หรือลบไม่ได้
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <SearchInput
                    value={search}
                    onChange={resetToFirstPage(setSearch)}
                    placeholder="ค้นหา path / คนทำ / รหัสข้อมูล..."
                    className="w-full sm:w-72"
                />
                <select
                    value={entity}
                    onChange={(e) => resetToFirstPage(setEntity)(e.target.value)}
                    className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                >
                    <option value="">ทุกกลุ่มข้อมูล</option>
                    {entities.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <Input type="date" value={dateFrom} onChange={(e) => resetToFirstPage(setDateFrom)(e.target.value)} className="w-40" aria-label="ตั้งแต่วันที่" />
                <Input type="date" value={dateTo} onChange={(e) => resetToFirstPage(setDateTo)(e.target.value)} className="w-40" aria-label="ถึงวันที่" />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={failedOnly}
                        onChange={(e) => resetToFirstPage(setFailedOnly)(e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                    />
                    เฉพาะที่ถูกปฏิเสธ/ล้มเหลว
                </label>
            </div>

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">ไม่พบประวัติที่ตรงกับเงื่อนไข</p>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-gray-400 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">เวลา</th>
                                    <th className="px-4 py-3 font-medium">ผู้ทำ</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">ทำอะไร</th>
                                    <th className="px-4 py-3 font-medium">รายละเอียด</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">ผล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {logs.map((log) => (
                                    <Fragment key={log.aud_id}>
                                        <tr
                                            onClick={() => setExpanded(expanded === log.aud_id ? null : log.aud_id)}
                                            className="hover:bg-gray-50/60 cursor-pointer align-top"
                                        >
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thaiDateTime(log.aud_created_at, { year: true })}</td>
                                            <td className="px-4 py-3">
                                                <span className="block text-gray-800">{log.aud_user_name ?? "—"}</span>
                                                <span className="block text-xs text-gray-400">{log.aud_user_email ?? ""}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${METHOD_BADGE[log.aud_method] ?? "bg-gray-100 text-gray-500"}`}>
                                                    {METHOD_LABEL[log.aud_method] ?? log.aud_method}
                                                </span>
                                                {log.aud_entity && <span className="ml-1.5 text-xs text-gray-500">{log.aud_entity}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {log.aud_summary ?? log.aud_path}
                                                {log.aud_entity_id && <span className="block text-xs text-gray-400">{log.aud_entity_id}</span>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={log.aud_status >= 400 ? "text-red-500 font-medium" : "text-gray-500"}>
                                                    {log.aud_status}
                                                </span>
                                            </td>
                                        </tr>
                                        {expanded === log.aud_id && (
                                            <tr className="bg-gray-50/60">
                                                <td colSpan={5} className="px-4 py-3">
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        {log.aud_method} {log.aud_path} · IP {log.aud_ip ?? "—"}
                                                    </div>
                                                    <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                                        {JSON.stringify(log.aud_payload ?? {}, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
