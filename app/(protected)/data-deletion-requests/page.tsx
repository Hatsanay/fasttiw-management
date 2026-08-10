"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate from "@/app/function";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type DeletionRequest = {
    ddr_id: string;
    ddr_customer_id: string;
    cus_username: string;
    cus_email: string;
    ddr_status: "pending" | "completed" | "rejected";
    ddr_note: string | null;
    ddr_created_at: string;
    ddr_resolved_at: string | null;
};

const STATUS_LABEL: Record<DeletionRequest["ddr_status"], string> = {
    pending: "รอดำเนินการ",
    completed: "ดำเนินการแล้ว",
    rejected: "ปฏิเสธ",
};

async function fetchRequests() {
    const res = await fetch(`${api}/data-deletion-requests`, { headers: authHeader() });
    if (!res.ok) return { data: [] as DeletionRequest[] };
    return res.json() as Promise<{ data: DeletionRequest[] }>;
}

async function updateRequestStatus(id: string, ddr_status: "completed" | "rejected") {
    const res = await fetch(`${api}/data-deletion-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ ddr_status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

export default function DataDeletionRequestsPage() {
    const router = useRouter();
    const hasBit = usePermission();
    const [isPending, startTransition] = useTransition();
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    function reload() {
        startTransition(async () => {
            const result = await fetchRequests();
            setRequests(result.data);
        });
    }

    useEffect(() => {
        reload();
    }, []);

    async function handleResolve(id: string, status: "completed" | "rejected") {
        setResolvingId(id);
        try {
            await updateRequestStatus(id, status);
            toast.success(status === "completed" ? "บันทึกว่าดำเนินการลบข้อมูลแล้ว" : "บันทึกว่าปฏิเสธคำขอแล้ว");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setResolvingId(null);
        }
    }

    const columns: Column<DeletionRequest>[] = [
        { key: "cus_username", header: "ผู้ใช้" },
        { key: "cus_email", header: "อีเมล" },
        {
            key: "ddr_status",
            header: "สถานะ",
            render: (v) => {
                const status = v as DeletionRequest["ddr_status"];
                return (
                    <span className={status === "pending" ? "text-amber-600" : status === "completed" ? "text-green-600" : "text-gray-400"}>
                        {STATUS_LABEL[status]}
                    </span>
                );
            },
        },
        { key: "ddr_created_at", header: "ขอเมื่อ", render: (v) => formatDate(v) },
        { key: "ddr_resolved_at", header: "ดำเนินการเมื่อ", render: (v) => (v ? formatDate(v as string) : "—") },
    ];

    if (!hasBit(BITS.customersManagement)) {
        return <p className="p-6 text-gray-500">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">คำขอลบข้อมูลบัญชี (PDPA)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        การลบข้อมูลจริงเป็นขั้นตอนที่ต้องทำเองนอกระบบ — ปุ่มด้านล่างแค่บันทึกสถานะว่าดำเนินการแล้ว
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

            <DataTable
                columns={columns}
                data={requests}
                rowKey="ddr_id"
                loading={isPending}
                actions={(row) =>
                    row.ddr_status === "pending" && hasBit(BITS.editCustomer) ? (
                        <div className="flex items-center gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => handleResolve(row.ddr_id, "rejected")}
                                disabled={resolvingId === row.ddr_id}
                                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                ปฏิเสธ
                            </button>
                            <button
                                type="button"
                                onClick={() => handleResolve(row.ddr_id, "completed")}
                                disabled={resolvingId === row.ddr_id}
                                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                            >
                                {resolvingId === row.ddr_id ? "กำลังบันทึก..." : "ดำเนินการแล้ว"}
                            </button>
                        </div>
                    ) : null
                }
            />
        </div>
    );
}
