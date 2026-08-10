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
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

type ExpenseCategory = {
    excat_id: string;
    excat_name: string;
    excat_status: "active" | "inactive";
    excat_created_at: string;
    excat_updated_at: string;
};

async function fetchCategories(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/expense-categories?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as ExpenseCategory[], total: 0 };
    return res.json() as Promise<{ data: ExpenseCategory[]; total: number }>;
}

export default function ExpenseCategoriesPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<ExpenseCategory>[] = [
        { key: "excat_id",   header: "รหัสหมวดหมู่", className: "w-16" },
        { key: "excat_name", header: "ชื่อหมวดหมู่" },
        {
            key: "excat_status",
            header: "สถานะ",
            render: (v) => (
                <span className={v === "active" ? "text-green-600" : "text-gray-400"}>
                    {v === "active" ? "ใช้งาน" : "ยกเลิกใช้งาน"}
                </span>
            ),
        },
        { key: "excat_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
        { key: "excat_updated_at", header: "อัปเดตเมื่อ", render: (v) => formatDate(v) },
    ];

    const [isPending, startTransition] = useTransition();
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchCategories({ limit, offset, search });
            if (!isCurrent(token)) return;
            setCategories(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize]);

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/expense-categories/${deleteTarget.excat_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.excat_name}" สำเร็จ`);
                reload();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">หมวดหมู่ค่าใช้จ่าย</h1>
                {hasBit(BITS.createExpenseCategory) && (
                    <Button onClick={() => router.push("/expenses/categories/create")}>สร้างหมวดหมู่</Button>
                )}
            </div>
            <p className="text-sm text-gray-400 -mt-2 mb-4">
                ใช้จัดกลุ่มค่าใช้จ่ายให้เลือกจากรายการที่กำหนดไว้ล่วงหน้าเสมอ ไม่ต้องพิมพ์ข้อความอิสระตอนบันทึกค่าใช้จ่าย
            </p>

            <DataTable
                columns={columns}
                data={categories}
                rowKey="excat_id"
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
                        {hasBit(BITS.editExpenseCategory) && (
                            <EditButton onClick={() => router.push(`/expenses/categories/edit?id=${row.excat_id}`)} />
                        )}
                        {hasBit(BITS.deleteExpenseCategory) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบหมวดหมู่นี้?"
                description={deleteTarget ? `"${deleteTarget.excat_name}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
