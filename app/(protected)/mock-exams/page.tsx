"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

// สนามสอบเสมือนจริง (2026-09-18) — โครงสร้างสอบข้ามชุด ดู backend/src/controllers/mockExam.controller.js
type MockExam = {
    me_id: string;
    me_name: string;
    me_status: "draft" | "published" | "archived";
    me_time_limit_minutes: number;
    me_category_name: string | null;
    me_pass_percent: number | null;
    me_pass_min: number | null;
    section_count: number;
    question_count: number;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_LABEL: Record<MockExam["me_status"], string> = {
    draft: "ฉบับร่าง",
    published: "เผยแพร่แล้ว",
    archived: "เก็บเข้ากรุ",
};
const STATUS_BADGE: Record<MockExam["me_status"], string> = {
    draft: "bg-gray-100 text-gray-500",
    published: "bg-green-50 text-green-600",
    archived: "bg-amber-50 text-amber-600",
};

export default function MockExamsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const [isPending, startTransition] = useTransition();
    const [exams, setExams] = useState<MockExam[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<MockExam | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const res = await fetch(`${api}/mock-exams?${new URLSearchParams({ limit: String(limit), offset: String(offset), search })}`,
                { headers: authHeader() });
            const result = res.ok ? await res.json() as { data: MockExam[]; total: number } : { data: [], total: 0 };
            if (!isCurrent(token)) return; // มี reload() ใหม่กว่าเริ่มไปแล้วระหว่างรอ ทิ้งผลลัพธ์นี้
            setExams(result.data);
            setTotal(result.total);
            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize]);

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/mock-exams/${deleteTarget.me_id}`, { method: "DELETE", headers: authHeader() });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.me_name}" สำเร็จ`);
                reload();
            } else {
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    const criterionText = (e: MockExam) =>
        e.me_pass_percent != null ? `${e.me_pass_percent}%` : e.me_pass_min != null ? `${e.me_pass_min} ข้อ` : "—";

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">สนามสอบเสมือน</h1>
                {hasBit(BITS.mockExamsManagement) && (
                    <Button onClick={() => router.push("/mock-exams/create")}>สร้างสนามสอบ</Button>
                )}
            </div>
            <p className="text-sm text-gray-400 mb-4">
                ลูกค้าทำข้อสอบข้ามชุดตามโครงสร้างสนามจริง จับเวลา ตัดผ่านรายวิชา — ข้อสุ่มจากชุดที่ลูกค้าคนนั้นมีสิทธิ์
            </p>

            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="ค้นหาชื่อสนามสอบ..." className="w-full sm:w-72 mb-4" />

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">
                    {search ? "ไม่พบสนามสอบที่ตรงกับเงื่อนไข" : "ยังไม่มีสนามสอบ — ลองสร้างสนามสอบใหม่"}
                </p>
            ) : (
                <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-gray-400 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-medium">ชื่อสนามสอบ</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">วิชา</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">จำนวนข้อ</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">เวลา</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">เกณฑ์รวม</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">สถานะ</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {exams.map((e) => (
                                    <tr key={e.me_id} className="hover:bg-gray-50/60 cursor-pointer"
                                        onClick={() => router.push(`/mock-exams/edit?id=${e.me_id}`)}>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-gray-800">{e.me_name}</span>
                                            {e.me_category_name && <span className="block text-xs text-gray-400">{e.me_category_name}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 tabular-nums">{e.section_count}</td>
                                        <td className="px-4 py-3 text-gray-600 tabular-nums">{e.question_count}</td>
                                        <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">{e.me_time_limit_minutes} นาที</td>
                                        <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">{criterionText(e)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${STATUS_BADGE[e.me_status]}`}>
                                                {STATUS_LABEL[e.me_status]}
                                            </span>
                                        </td>
                                        {/* stopPropagation กันไม่ให้ปุ่มไปสั่ง navigate ของแถวซ้ำ */}
                                        <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                {hasBit(BITS.mockExamsManagement) && (
                                                    <>
                                                        <EditButton onClick={() => router.push(`/mock-exams/edit?id=${e.me_id}`)} />
                                                        <DeleteButton onClick={() => setDeleteTarget(e)} />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage}
                            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} pageSizeOptions={PAGE_SIZE_OPTIONS} />
                    </div>
                </>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบสนามสอบนี้?"
                description={deleteTarget ? `"${deleteTarget.me_name}" จะถูกลบและไม่สามารถกู้คืนได้ (ถ้ามีลูกค้าเคยสอบไปแล้วจะลบไม่ได้)` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
