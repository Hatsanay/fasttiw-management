"use client";

import { useEffect, useState, useTransition } from "react";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate from "@/app/function";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type Topic = {
    tpc_id: string;
    tpc_name: string;
    tpc_category_name: string | null;
    tpc_status: "active" | "inactive";
    tpc_created_at: string;
    tpc_updated_at: string;
};

async function fetchTopics(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/topics?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Topic[], total: 0 };
    return res.json() as Promise<{ data: Topic[]; total: number }>;
}

export default function QuestionTopicsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Topic>[] = [
        { key: "tpc_id",   header: "รหัสหมวดหมู่", className: "w-16" },
        { key: "tpc_name", header: "ชื่อหมวดหมู่คำถาม" },
        { key: "tpc_category_name", header: "หมวดหมู่ชุดข้อสอบ", render: (v) => (v as string) || "-" },
        {
            key: "tpc_status",
            header: "สถานะ",
            render: (v) => (
                <span className={v === "active" ? "text-green-600" : "text-gray-400"}>
                    {v === "active" ? "ใช้งาน" : "ยกเลิกใช้งาน"}
                </span>
            ),
        },
        { key: "tpc_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
        { key: "tpc_updated_at", header: "อัปเดตเมื่อ", render: (v) => formatDate(v) },
    ];

    const [isPending, startTransition] = useTransition();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/topics/${deleteTarget.tpc_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                setTopics((prev) => prev.filter((t) => t.tpc_id !== deleteTarget.tpc_id));
                setTotal((prev) => prev - 1);
                toast.success(`ลบ "${deleteTarget.tpc_name}" สำเร็จ`);
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    useEffect(() => {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const result = await fetchTopics({ limit, offset, search });
            setTopics(result.data);
            setTotal(result.total);
        });
    }, [page, search, pageSize]);

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">หมวดหมู่คำถาม</h1>
                {hasBit(BITS.createTopic) && (
                    <Button onClick={() => router.push("/categories/topics/create")}>สร้างหมวดหมู่คำถาม</Button>
                )}
            </div>
            <p className="text-sm text-gray-400 -mt-4 mb-4">
                ใช้แท็กคำถามรายข้อเพื่อสรุปจุดอ่อนรายหมวดในอนาคต — สร้างเองที่นี่ หรือให้ระบบสร้างอัตโนมัติตอนนำเข้า CSV/Excel ก็ได้
            </p>
            <DataTable
                columns={columns}
                data={topics}
                rowKey="tpc_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {hasBit(BITS.editTopic) && (
                            <EditButton onClick={() => router.push(`/categories/topics/edit?id=${row.tpc_id}`)} />
                        )}
                        {hasBit(BITS.deleteTopic) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบหมวดหมู่คำถามนี้?"
                description={deleteTarget ? `"${deleteTarget.tpc_name}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
