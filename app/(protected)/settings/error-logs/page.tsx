"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { thaiDateTime } from "@/app/lib/date";
import Pagination from "@/components/ui/Pagination";
import LogTabs from "../LogTabs";

// ข้อผิดพลาดของระบบ (error log, 2026-09-20)
// เดิม error ทั้งหมดไป console ของเซิร์ฟเวอร์ซึ่งไม่มีใครเปิดดู — หน้านี้ทำให้รู้ได้ว่ามีอะไรพังอยู่เงียบๆ ไหม
// จัดกลุ่ม error เดิมที่เกิดซ้ำเป็นก้อนเดียว เพราะเวลามีปัญหาจริงมันจะเกิดเป็นร้อยครั้งจนไล่อ่านทีละแถวไม่ไหว
type ErrorGroup = {
    err_id: string;
    err_fingerprint: string;
    occurrences: number;
    first_seen: string;
    last_seen: string;
    message: string;
    path: string | null;
    stack: string | null;
};

const DAY_OPTIONS = [1, 7, 30, 90];
const PAGE_SIZE_OPTIONS = [20, 50];

export default function ErrorLogsPage() {
    const [isPending, startTransition] = useTransition();
    const [groups, setGroups] = useState<ErrorGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [days, setDays] = useState(7);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const res = await fetch(`${api}/error-logs?days=${days}&limit=${limit}&offset=${offset}`, { headers: authHeader() });
            const body = res.ok ? await res.json() as { data: ErrorGroup[]; total: number } : { data: [], total: 0 };
            setGroups(body.data);
            setTotal(body.total);
        });
    }, [days, page, pageSize]);

    return (
        <div className="p-4 sm:p-6">
            <LogTabs />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">ข้อผิดพลาดของระบบ</h1>
            <p className="text-sm text-gray-400 mb-4">
                ข้อผิดพลาดที่เกิดฝั่งเซิร์ฟเวอร์ (ไม่รวมกรณีผู้ใช้กรอกข้อมูลไม่ครบหรือไม่มีสิทธิ์) —
                จัดกลุ่มข้อผิดพลาดเดิมที่เกิดซ้ำไว้ด้วยกัน · ปกติหน้านี้ควรว่าง ถ้ามีรายการขึ้นแปลว่ามีบางอย่างพังอยู่
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {DAY_OPTIONS.map((d) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() => { setDays(d); setPage(1); }}
                        className={`px-3 py-1.5 rounded text-sm border ${
                            days === d ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        {d === 1 ? "24 ชั่วโมง" : `${d} วัน`}
                    </button>
                ))}
            </div>

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50/50 p-5">
                    <CheckCircle2 size={22} className="text-green-600 shrink-0" />
                    <p className="text-sm text-green-700">ไม่มีข้อผิดพลาดในช่วงเวลาที่เลือก</p>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-gray-400 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium">ข้อผิดพลาด</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">จำนวนครั้ง</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">ล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {groups.map((g) => (
                                    <Fragment key={g.err_fingerprint}>
                                        <tr
                                            onClick={() => setExpanded(expanded === g.err_fingerprint ? null : g.err_fingerprint)}
                                            className="hover:bg-gray-50/60 cursor-pointer align-top"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="flex items-start gap-2">
                                                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                                                    <span className="min-w-0">
                                                        <span className="block text-gray-800">{g.message}</span>
                                                        {g.path && <span className="block text-xs text-gray-400">{g.path}</span>}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-gray-600">{g.occurrences}</td>
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thaiDateTime(g.last_seen)}</td>
                                        </tr>
                                        {expanded === g.err_fingerprint && (
                                            <tr className="bg-gray-50/60">
                                                <td colSpan={3} className="px-4 py-3">
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        เกิดครั้งแรก {thaiDateTime(g.first_seen)} · ล่าสุด {thaiDateTime(g.last_seen)}
                                                    </div>
                                                    <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                                        {g.stack || "ไม่มีรายละเอียดเพิ่มเติม"}
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
