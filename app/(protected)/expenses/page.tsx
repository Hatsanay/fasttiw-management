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
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

type Expense = {
    exp_id: string;
    excat_name: string;
    exp_product_id: string | null;
    prod_name: string | null;
    exp_amount: number;
    exp_note: string | null;
    exp_date: string;
    exp_created_at: string;
};

async function fetchExpenses(params: {
    limit: number; offset: number; search: string; from: string; to: string; productId: string;
}) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.productId) query.set("product_id", params.productId);
    const res = await fetch(`${api}/expenses?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Expense[], total: 0 };
    return res.json() as Promise<{ data: Expense[]; total: number }>;
}

const GENERAL_FILTER_OPTION = { value: "general", label: "ทั่วไป (ไม่ผูกกับชุดข้อสอบ)" };

// เติมตัวเลือก "ทั่วไป" ไว้บนสุดเสมอ ให้กรองดูเฉพาะรายจ่ายที่ไม่ผูกกับชุดข้อสอบไหนได้ นอกเหนือจากเลือก
// ชุดข้อสอบเฉพาะเจาะจง
async function loadProductFilterOptions(search: string) {
    const res = await fetch(`${api}/products?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    const products = res.ok
        ? (await res.json() as { data: { prod_id: string; prod_name: string }[] }).data.map((p) => ({ value: p.prod_id, label: p.prod_name }))
        : [];
    return [GENERAL_FILTER_OPTION, ...products];
}

export default function ExpensesPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const columns: Column<Expense>[] = [
        { key: "exp_date", header: "วันที่", render: (v) => formatDate(v as string) },
        { key: "excat_name", header: "หมวดหมู่" },
        { key: "prod_name", header: "ชุดข้อสอบ", render: (v) => (v as string) || "ทั่วไป" },
        { key: "exp_amount", header: "จำนวนเงิน", render: (v) => formatBaht(v) },
        { key: "exp_note", header: "หมายเหตุ", render: (v) => (v as string) || "-" },
    ];

    const [isPending, startTransition] = useTransition();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [productFilter, setProductFilter] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchExpenses({ limit, offset, search, from, to, productId: productFilter });
            if (!isCurrent(token)) return;
            setExpenses(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize, from, to, productFilter]);

    function handleProductFilterChange(value: string) {
        setProductFilter(value);
        setPage(1);
    }

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
            const res = await fetch(`${api}/expenses/${deleteTarget.exp_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("ลบรายการค่าใช้จ่ายสำเร็จ");
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ค่าใช้จ่าย</h1>
                {hasBit(BITS.createExpense) && (
                    <Button onClick={() => router.push("/expenses/create")}>บันทึกค่าใช้จ่าย</Button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5">
                    <label className="text-sm text-gray-500">จากวันที่</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <label className="text-sm text-gray-500">ถึงวันที่</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => { setTo(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                </div>
                {(from || to) && (
                    <button
                        type="button"
                        onClick={() => { setFrom(""); setTo(""); setPage(1); }}
                        className="text-sm text-gray-400 hover:text-gray-600"
                    >
                        ล้างตัวกรองวันที่
                    </button>
                )}
                <SearchableSelect
                    loadOptions={loadProductFilterOptions}
                    value={productFilter}
                    onChange={handleProductFilterChange}
                    placeholder="ทุกชุดข้อสอบ"
                    className="w-56"
                />
            </div>

            <DataTable
                columns={columns}
                data={expenses}
                rowKey="exp_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                searchPlaceholder="ค้นหาหมวดหมู่หรือหมายเหตุ..."
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {hasBit(BITS.editExpense) && (
                            <EditButton onClick={() => router.push(`/expenses/edit?id=${row.exp_id}`)} />
                        )}
                        {hasBit(BITS.deleteExpense) && (
                            <DeleteButton onClick={() => setDeleteTarget(row)} />
                        )}
                    </div>
                )}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบรายการค่าใช้จ่ายนี้?"
                description={deleteTarget ? `รายการ "${deleteTarget.excat_name}" จำนวน ${formatBaht(deleteTarget.exp_amount)} จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
