"use client";

import { useEffect, useState, useTransition } from "react";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate, { formatBaht } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type Coupon = {
    cpn_id: string;
    cpn_code: string;
    cpn_discount_type: "percent" | "fixed";
    cpn_discount_value: number;
    cpn_max_uses: number | null;
    cpn_used_count: number;
    cpn_expires_at: string | null;
    cpn_status: "active" | "inactive";
    cpn_created_at: string;
};

async function fetchCoupons(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/coupons?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Coupon[], total: 0 };
    return res.json() as Promise<{ data: Coupon[]; total: number }>;
}

export default function CouponsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Coupon>[] = [
        { key: "cpn_code", header: "โค้ด" },
        {
            key: "cpn_discount_value",
            header: "ส่วนลด",
            render: (v, row) => row.cpn_discount_type === "percent" ? `${Number(v)}%` : formatBaht(v),
        },
        {
            key: "cpn_used_count",
            header: "ใช้ไปแล้ว",
            render: (v, row) => `${v} / ${row.cpn_max_uses ?? "ไม่จำกัด"}`,
        },
        { key: "cpn_expires_at", header: "หมดอายุ", render: (v) => v ? formatDate(v as string) : "ไม่มีวันหมดอายุ" },
        {
            key: "cpn_status",
            header: "สถานะ",
            render: (v) => (
                <span className={v === "active" ? "text-green-600" : "text-gray-400"}>
                    {v === "active" ? "ใช้งาน" : "ยกเลิกใช้งาน"}
                </span>
            ),
        },
        { key: "cpn_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
    ];

    const [isPending, startTransition] = useTransition();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const result = await fetchCoupons({ limit, offset, search });
            setCoupons(result.data);
            setTotal(result.total);
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
            const res = await fetch(`${api}/coupons/${deleteTarget.cpn_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.cpn_code}" สำเร็จ`);
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">คูปองส่วนลด</h1>
                {hasBit(BITS.createCoupon) && (
                    <Button onClick={() => router.push("/coupons/create")}>สร้างคูปอง</Button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={coupons}
                rowKey="cpn_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                searchPlaceholder="ค้นหาโค้ดคูปอง..."
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {hasBit(BITS.editCoupon) && (
                            <EditButton onClick={() => router.push(`/coupons/edit?id=${row.cpn_id}`)} />
                        )}
                        {hasBit(BITS.deleteCoupon) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบคูปองนี้?"
                description={deleteTarget ? `"${deleteTarget.cpn_code}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
