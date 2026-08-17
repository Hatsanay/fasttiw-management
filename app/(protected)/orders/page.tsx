"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate, { formatBaht } from "@/app/function";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type Order = {
    ord_id: string;
    ord_customer_id: string;
    cus_username: string;
    cus_email: string;
    ord_total: number;
    ord_status: "pending" | "paid" | "cancelled";
    ord_omise_charge_id: string | null;
    ord_created_at: string;
    ord_paid_at: string | null;
};

const STATUS_LABEL: Record<Order["ord_status"], string> = {
    pending: "รอชำระเงิน",
    paid: "ชำระแล้ว",
    cancelled: "ยกเลิก",
};

const STATUS_TABS: { value: "" | Order["ord_status"]; label: string }[] = [
    { value: "pending", label: "รอชำระเงิน" },
    { value: "paid", label: "ชำระแล้ว" },
    { value: "cancelled", label: "ยกเลิก" },
    { value: "", label: "ทั้งหมด" },
];

async function fetchOrders(status: string) {
    const query = status ? `?status=${status}` : "";
    const res = await fetch(`${api}/orders${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Order[] };
    return res.json() as Promise<{ data: Order[] }>;
}

async function forceConfirmOrder(id: string) {
    const res = await fetch(`${api}/orders/${id}/force-confirm`, {
        method: "PUT",
        headers: authHeader(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

async function cancelOrder(id: string) {
    const res = await fetch(`${api}/orders/${id}/cancel`, {
        method: "PUT",
        headers: authHeader(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

export default function OrdersPage() {
    const router = useRouter();
    const hasBit = usePermission();
    const [isPending, startTransition] = useTransition();
    const [orders, setOrders] = useState<Order[]>([]);
    const [status, setStatus] = useState<"" | Order["ord_status"]>("pending");
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    function reload() {
        startTransition(async () => {
            const result = await fetchOrders(status);
            setOrders(result.data);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    async function handleForceConfirm(row: Order) {
        // ปุ่มนี้มีผลเท่ากับให้สิทธิ์เข้าถึงชุดข้อสอบทันที (grant entitlement จริง) — ต้องมั่นใจว่าลูกค้า
        // จ่ายเงินมาแล้วจริงๆ (เช่น เห็นสลิปโอนเงิน) ก่อนกดยืนยัน
        if (!window.confirm(`ยืนยันว่าลูกค้า "${row.cus_username}" จ่ายเงินคำสั่งซื้อ ${row.ord_id} มาแล้วจริง? การกดยืนยันจะให้สิทธิ์เข้าถึงชุดข้อสอบทันที`)) {
            return;
        }
        setConfirmingId(row.ord_id);
        try {
            await forceConfirmOrder(row.ord_id);
            toast.success("ยืนยันการชำระเงินสำเร็จ");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setConfirmingId(null);
        }
    }

    async function handleCancel(row: Order) {
        if (!window.confirm(`ยืนยันยกเลิกคำสั่งซื้อ ${row.ord_id} ของลูกค้า "${row.cus_username}"? หากลูกค้าเพิ่งจ่ายเงินสำเร็จพอดี ระบบจะยืนยันการชำระเงินให้แทนโดยอัตโนมัติ`)) {
            return;
        }
        setCancellingId(row.ord_id);
        try {
            await cancelOrder(row.ord_id);
            toast.success("ยกเลิกคำสั่งซื้อสำเร็จ");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            reload();
        } finally {
            setCancellingId(null);
        }
    }

    const columns: Column<Order>[] = [
        { key: "ord_id", header: "เลขที่คำสั่งซื้อ" },
        { key: "cus_username", header: "ลูกค้า" },
        { key: "cus_email", header: "อีเมล" },
        { key: "ord_total", header: "ยอดชำระ", render: (v) => formatBaht(v) },
        {
            key: "ord_status",
            header: "สถานะ",
            render: (v) => {
                const s = v as Order["ord_status"];
                return (
                    <span className={s === "paid" ? "text-green-600" : s === "cancelled" ? "text-gray-400" : "text-amber-600"}>
                        {STATUS_LABEL[s]}
                    </span>
                );
            },
        },
        { key: "ord_omise_charge_id", header: "รหัสอ้างอิงการชำระเงิน", render: (v) => (v as string | null) ?? "—" },
        { key: "ord_created_at", header: "สร้างเมื่อ", render: (v) => formatDate(v) },
    ];

    if (!hasBit(BITS.reportsManagement)) {
        return <p className="p-6 text-gray-500">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">คำสั่งซื้อ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        คำสั่งซื้อที่ค้าง &quot;รอชำระเงิน&quot; นานผิดปกติ (เช่น QR มีปัญหา แต่ลูกค้าแจ้งสลิปมาทางแชท) ยืนยันจ่ายเงินด้วยมือได้จากหน้านี้
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/customers")}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                    กลับไปจัดการลูกค้า
                </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => setStatus(tab.value)}
                        className={`px-3 py-1.5 text-sm rounded-full border ${
                            status === tab.value
                                ? "bg-blue-600 text-white border-blue-600"
                                : "text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <DataTable
                columns={columns}
                data={orders}
                rowKey="ord_id"
                loading={isPending}
                actions={(row) =>
                    row.ord_status === "pending" && hasBit(BITS.createCustomer) ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleForceConfirm(row)}
                                disabled={confirmingId === row.ord_id || cancellingId === row.ord_id}
                                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                            >
                                {confirmingId === row.ord_id ? "กำลังยืนยัน..." : "ยืนยันจ่ายเงินด้วยมือ"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCancel(row)}
                                disabled={confirmingId === row.ord_id || cancellingId === row.ord_id}
                                className="px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded disabled:opacity-50"
                            >
                                {cancellingId === row.ord_id ? "กำลังยกเลิก..." : "ยกเลิกคำสั่งซื้อ"}
                            </button>
                        </div>
                    ) : null
                }
            />
        </div>
    );
}
