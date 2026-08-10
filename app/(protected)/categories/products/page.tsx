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

type Category = {
    cat_id: string;
    cat_name: string;
    cat_status: "active" | "inactive";
    cat_show_on_landing: boolean;
    cat_created_at: string;
    cat_updated_at: string;
};

async function fetchCategories(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/categories?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Category[], total: 0 };
    return res.json() as Promise<{ data: Category[]; total: number }>;
}

export default function ProductCategoriesPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Category>[] = [
        { key: "cat_id",   header: "รหัสหมวดหมู่", className: "w-16" },
        { key: "cat_name", header: "ชื่อหมวดหมู่" },
        {
            key: "cat_status",
            header: "สถานะ",
            render: (v) => (
                <span className={v === "active" ? "text-green-600" : "text-gray-400"}>
                    {v === "active" ? "ใช้งาน" : "ยกเลิกใช้งาน"}
                </span>
            ),
        },
        {
            key: "cat_show_on_landing",
            header: "โชว์หน้า landing",
            render: (v) => (
                <span className={v ? "text-green-600" : "text-gray-400"}>{v ? "แสดง" : "ไม่แสดง"}</span>
            ),
        },
        { key: "cat_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
        { key: "cat_updated_at", header: "อัปเดตเมื่อ", render: (v) => formatDate(v) },
    ];

    const [isPending, startTransition] = useTransition();
    const [categories, setCategories] = useState<Category[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/categories/${deleteTarget.cat_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                setCategories((prev) => prev.filter((c) => c.cat_id !== deleteTarget.cat_id));
                setTotal((prev) => prev - 1);
                toast.success(`ลบ "${deleteTarget.cat_name}" สำเร็จ`);
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
            const result = await fetchCategories({ limit, offset, search });
            setCategories(result.data);
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">หมวดหมู่ชุดข้อสอบ</h1>
                {hasBit(BITS.createCategory) && (
                    <Button onClick={() => router.push("/categories/products/create")}>สร้างหมวดหมู่</Button>
                )}
            </div>
            <DataTable
                columns={columns}
                data={categories}
                rowKey="cat_id"
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
                        {hasBit(BITS.editCategory) && (
                            <EditButton onClick={() => router.push(`/categories/products/edit?id=${row.cat_id}`)} />
                        )}
                        {hasBit(BITS.deleteCategory) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบหมวดหมู่นี้?"
                description={deleteTarget ? `"${deleteTarget.cat_name}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
