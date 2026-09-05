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
import GrantProductsModal from "@/components/ui/GrantProductsModal";
import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type Customer = {
    cus_id: string;
    cus_username: string;
    cus_fullname: string | null;
    cus_email: string | null;
    cus_phone: string | null;
    cus_status: "active" | "inactive";
    cus_must_change_password: number | boolean;
    cus_created_at: string;
    cus_updated_at: string;
};

async function fetchCustomers(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/customers?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Customer[], total: 0 };
    return res.json() as Promise<{ data: Customer[]; total: number }>;
}

export default function CustomersPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Customer>[] = [
        { key: "cus_id",       header: "รหัสลูกค้า", className: "w-16" },
        { key: "cus_username", header: "Username" },
        { key: "cus_fullname", header: "ชื่อลูกค้า", render: (v) => (v as string) || "-" },
        { key: "cus_email",    header: "อีเมล", render: (v) => (v as string) || "-" },
        { key: "cus_phone",    header: "เบอร์โทรศัพท์", render: (v) => (v as string) || "-" },
        {
            key: "cus_status",
            header: "สถานะ",
            render: (v) => (
                <span className={v === "active" ? "text-green-600" : "text-gray-400"}>
                    {v === "active" ? "ใช้งาน" : "ยกเลิกใช้งาน"}
                </span>
            ),
        },
        {
            key: "cus_must_change_password",
            header: "รหัสผ่าน",
            render: (v) => (
                <span className={v ? "text-amber-500" : "text-green-600"}>
                    {v ? "ยังไม่เปลี่ยนจากชั่วคราว" : "ตั้งเองแล้ว"}
                </span>
            ),
        },
        { key: "cus_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
    ];

    const [isPending, startTransition] = useTransition();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    // ลูกค้าที่กำลังจะเพิ่มสิทธิ์ให้ (null = ปิด modal) — ใช้ modal ตัวเดียวกับตอนสร้างลูกค้าใหม่
    const [grantTarget, setGrantTarget] = useState<Customer | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const result = await fetchCustomers({ limit, offset, search });
            setCustomers(result.data);
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
            const res = await fetch(`${api}/customers/${deleteTarget.cus_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.cus_fullname ?? deleteTarget.cus_username}" สำเร็จ`);
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">จัดการลูกค้า</h1>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => router.push("/entitlements")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        ดูสิทธิ์ทั้งหมด
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push("/data-deletion-requests")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        คำขอลบข้อมูล (PDPA)
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push("/orders")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        คำสั่งซื้อ / ยืนยันจ่ายเงิน
                    </button>
                    {hasBit(BITS.createCustomer) && (
                        <Button onClick={() => router.push("/customers/create")}>สร้างลูกค้า</Button>
                    )}
                </div>
            </div>

            <DataTable
                columns={columns}
                data={customers}
                rowKey="cus_id"
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
                        {hasBit(BITS.editCustomer) && (
                            <button
                                type="button"
                                onClick={() => setGrantTarget(row)}
                                title="เพิ่มสิทธิ์ (ชุดข้อสอบ / แพ็กเกจ)"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                                <PackagePlus className="w-4 h-4" />
                            </button>
                        )}
                        {hasBit(BITS.editCustomer) && (
                            <EditButton onClick={() => router.push(`/customers/edit?id=${row.cus_id}`)} />
                        )}
                        {hasBit(BITS.deleteCustomer) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <GrantProductsModal
                open={!!grantTarget}
                customerId={grantTarget?.cus_id ?? ""}
                onClose={() => setGrantTarget(null)}
                onDone={reload}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบลูกค้านี้?"
                description={deleteTarget ? `"${deleteTarget.cus_fullname ?? deleteTarget.cus_username}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
