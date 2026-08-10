"use client";

import { useEffect, useState, useTransition } from "react";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BatchPayrollModal from "@/components/ui/BatchPayrollModal";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

type Payroll = {
    pay_id: string;
    pay_staff_id: string;
    staff_fullname: string;
    pay_period_month: number;
    pay_period_year: number;
    pay_net_amount: number;
    pay_source: "manual" | "batch";
    pay_status: "pending" | "paid";
    pay_paid_at: string | null;
};

const MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

async function fetchPayrolls(params: {
    limit: number; offset: number; search: string; year: string; month: string; status: string;
}) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    if (params.year) query.set("year", params.year);
    if (params.month) query.set("month", params.month);
    if (params.status) query.set("status", params.status);
    const res = await fetch(`${api}/payrolls?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Payroll[], total: 0 };
    return res.json() as Promise<{ data: Payroll[]; total: number }>;
}

export default function PayrollPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Payroll>[] = [
        { key: "staff_fullname", header: "พนักงาน" },
        { key: "pay_period_month", header: "งวด", render: (v, row) => `${MONTHS[Number(v) - 1]} ${row.pay_period_year}` },
        { key: "pay_net_amount", header: "ยอดสุทธิ", render: (v) => formatBaht(v) },
        {
            key: "pay_source", header: "ที่มา", render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === "batch" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                    {v === "batch" ? "จ่ายแบบชุด" : "บันทึกเดี่ยว"}
                </span>
            )
        },
        {
            key: "pay_status", header: "สถานะ", render: (v) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {v === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}
                </span>
            )
        },
    ];

    const [isPending, startTransition] = useTransition();
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [year, setYear] = useState("");
    const [month, setMonth] = useState("");
    const [status, setStatus] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<Payroll | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [payTarget, setPayTarget] = useState<Payroll | null>(null);
    const [isPaying, setIsPaying] = useState(false);
    const [batchModalOpen, setBatchModalOpen] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchPayrolls({ limit, offset, search, year, month, status });
            if (!isCurrent(token)) return;
            setPayrolls(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize, year, month, status]);

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
            const res = await fetch(`${api}/payrolls/${deleteTarget.pay_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("ลบรายการเงินเดือนสำเร็จ");
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
            const res = await fetch(`${api}/payrolls/${payTarget.pay_id}/pay`, {
                method: "PUT",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("บันทึกการจ่ายเงินเดือนสำเร็จ");
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">เงินเดือนพนักงาน</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {hasBit(BITS.createPayroll) && (
                        <button
                            type="button"
                            onClick={() => router.push("/payroll/create")}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            สร้างรายการเงินเดือน
                        </button>
                    )}
                    {hasBit(BITS.runPayroll) && (
                        <Button onClick={() => setBatchModalOpen(true)}>จ่ายเงินเดือนพนักงาน (จ่ายหลายคน)</Button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                    value={month}
                    onChange={(e) => { setMonth(e.target.value); setPage(1); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                    <option value="">ทุกเดือน</option>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <input
                    type="number"
                    value={year}
                    onChange={(e) => { setYear(e.target.value); setPage(1); }}
                    placeholder="ปี"
                    className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
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
                data={payrolls}
                rowKey="pay_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                searchPlaceholder="ค้นหาชื่อพนักงาน..."
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {row.pay_status === "pending" && hasBit(BITS.editPayroll) && (
                            <button
                                onClick={() => setPayTarget(row)}
                                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
                            >
                                จ่ายแล้ว
                            </button>
                        )}
                        {row.pay_status === "pending" && hasBit(BITS.editPayroll) && (
                            <EditButton onClick={() => router.push(`/payroll/edit?id=${row.pay_id}`)} />
                        )}
                        {row.pay_status === "pending" && hasBit(BITS.deletePayroll) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบรายการเงินเดือนนี้?"
                description={deleteTarget ? `รายการเงินเดือนของ "${deleteTarget.staff_fullname}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            <ConfirmDialog
                open={!!payTarget}
                variant="info"
                title="ยืนยันการจ่ายเงินเดือน?"
                description={payTarget ? `บันทึกว่าจ่ายเงินเดือน "${payTarget.staff_fullname}" จำนวน ${formatBaht(payTarget.pay_net_amount)}แล้ว ระบบจะสร้างรายการค่าใช้จ่ายอัตโนมัติและล็อกรายการนี้ (แก้ไข/ลบไม่ได้อีก)` : undefined}
                confirmLabel="ยืนยันจ่ายแล้ว"
                loading={isPaying}
                onConfirm={handleMarkPaid}
                onCancel={() => setPayTarget(null)}
            />

            <BatchPayrollModal
                open={batchModalOpen}
                onClose={() => setBatchModalOpen(false)}
                onDone={reload}
            />
        </div>
    );
}
