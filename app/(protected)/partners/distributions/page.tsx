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
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

type Distribution = {
    dist_id: string;
    dist_partner_id: string;
    partner_fullname: string;
    dist_allocation_id: string | null;
    dist_amount: number;
    dist_tax_percent: number;
    dist_tax_amount: number;
    dist_note: string | null;
    dist_status: "pending" | "paid";
    dist_paid_at: string | null;
    dist_created_at: string;
};

async function fetchDistributions(params: { limit: number; offset: number; search: string; status: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    if (params.status) query.set("status", params.status);
    const res = await fetch(`${api}/partner-distributions?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Distribution[], total: 0 };
    return res.json() as Promise<{ data: Distribution[]; total: number }>;
}

export default function PartnerDistributionsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Distribution>[] = [
        { key: "partner_fullname", header: "หุ้นส่วน" },
        {
            key: "dist_allocation_id", header: "ที่มา", render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                    {v ? "จัดสรรกำไร" : "บันทึกเอง"}
                </span>
            )
        },
        { key: "dist_amount", header: "ยอดประกาศจ่าย", render: (v) => formatBaht(v) },
        {
            key: "dist_tax_amount", header: "ภาษีหัก", render: (v, row) => (
                Number(v) > 0 ? `${formatBaht(v)} (${row.dist_tax_percent}%)` : "-"
            )
        },
        {
            key: "dist_id", header: "รับจริง", render: (_v, row) => formatBaht(Number(row.dist_amount) - Number(row.dist_tax_amount))
        },
        { key: "dist_note", header: "หมายเหตุ", render: (v) => (v as string) || "-" },
        {
            key: "dist_status", header: "สถานะ", render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {v === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}
                </span>
            )
        },
        { key: "dist_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v as string) },
    ];

    const [isPending, startTransition] = useTransition();
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [status, setStatus] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<Distribution | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [payTarget, setPayTarget] = useState<Distribution | null>(null);
    const [isPaying, setIsPaying] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchDistributions({ limit, offset, search, status });
            if (!isCurrent(token)) return;
            setDistributions(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize, status]);

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
            const res = await fetch(`${api}/partner-distributions/${deleteTarget.dist_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("ลบรายการจ่ายส่วนแบ่งสำเร็จ");
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

    async function handleMarkPaid() {
        if (!payTarget) return;
        setIsPaying(true);
        try {
            const res = await fetch(`${api}/partner-distributions/${payTarget.dist_id}/pay`, {
                method: "PUT",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("บันทึกการจ่ายส่วนแบ่งกำไรสำเร็จ");
                reload();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsPaying(false);
            setPayTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">จ่ายส่วนแบ่งกำไรหุ้นส่วน</h1>
                {hasBit(BITS.createPartnerDistribution) && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => router.push("/settings/dividend")}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            ตั้งค่าการจัดสรร
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/partners/distributions/create")}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            บันทึกจ่ายส่วนแบ่งเอง
                        </button>
                        <Button onClick={() => router.push("/partners/distributions/allocate")}>จัดสรรกำไร</Button>
                    </div>
                )}
            </div>
            <p className="text-sm text-gray-400 mb-4">
                เงินที่จ่ายส่วนแบ่งกำไรให้หุ้นส่วน ไม่ใช่ค่าใช้จ่าย จึงไม่ไปโผล่ในหน้าค่าใช้จ่าย — ใช้หักคำนวณ &quot;กำไรสะสม&quot; ที่หน้ารายงานการเงินแทน
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                    <option value="">ทุกสถานะ</option>
                    <option value="pending">รอจ่าย</option>
                    <option value="paid">จ่ายแล้ว</option>
                </select>
            </div>

            <DataTable
                columns={columns}
                data={distributions}
                rowKey="dist_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                searchPlaceholder="ค้นหาชื่อหุ้นส่วน..."
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {row.dist_status === "pending" && hasBit(BITS.editPartnerDistribution) && (
                            <button
                                onClick={() => setPayTarget(row)}
                                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
                            >
                                จ่ายแล้ว
                            </button>
                        )}
                        {row.dist_status === "pending" && !row.dist_allocation_id && hasBit(BITS.editPartnerDistribution) && (
                            <EditButton onClick={() => router.push(`/partners/distributions/edit?id=${row.dist_id}`)} />
                        )}
                        {row.dist_status === "pending" && !row.dist_allocation_id && hasBit(BITS.deletePartnerDistribution) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบรายการจ่ายส่วนแบ่งนี้?"
                description={deleteTarget ? `รายการจ่ายส่วนแบ่งของ "${deleteTarget.partner_fullname}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            <ConfirmDialog
                open={!!payTarget}
                variant="info"
                title="ยืนยันการจ่ายส่วนแบ่งกำไร?"
                description={payTarget ? `บันทึกว่าจ่ายส่วนแบ่งกำไรให้ "${payTarget.partner_fullname}" จำนวน ${formatBaht(payTarget.dist_amount)}แล้ว จะล็อกรายการนี้ (แก้ไข/ลบไม่ได้อีก) และนำไปหักคำนวณกำไรสะสม` : undefined}
                confirmLabel="ยืนยันจ่ายแล้ว"
                loading={isPaying}
                onConfirm={handleMarkPaid}
                onCancel={() => setPayTarget(null)}
            />
        </div>
    );
}
