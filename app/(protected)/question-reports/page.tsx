"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate from "@/app/function";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";

type QuestionReport = {
    qrp_id: string;
    qrp_question_id: string;
    ques_text: string;
    ques_product_id: string;
    prod_name: string;
    cus_username: string;
    qrp_message: string;
    qrp_status: "open" | "resolved";
    qrp_created_at: string;
    qrp_resolved_at: string | null;
};

async function fetchReports() {
    const res = await fetch(`${api}/question-reports`, { headers: authHeader() });
    if (!res.ok) return { data: [] as QuestionReport[] };
    return res.json() as Promise<{ data: QuestionReport[] }>;
}

async function resolveReport(id: string) {
    const res = await fetch(`${api}/question-reports/${id}/resolve`, {
        method: "PUT",
        headers: authHeader(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

export default function QuestionReportsPage() {
    const router = useRouter();
    const hasBit = usePermission();
    const [isPending, startTransition] = useTransition();
    const [reports, setReports] = useState<QuestionReport[]>([]);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    function reload() {
        startTransition(async () => {
            const result = await fetchReports();
            setReports(result.data);
        });
    }

    useEffect(() => {
        reload();
    }, []);

    async function handleResolve(id: string) {
        setResolvingId(id);
        try {
            await resolveReport(id);
            toast.success("ปิดเคสแล้ว");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setResolvingId(null);
        }
    }

    const columns: Column<QuestionReport>[] = [
        { key: "prod_name", header: "ชุดข้อสอบ" },
        { key: "ques_text", header: "คำถาม", render: (v) => <span className="line-clamp-2 whitespace-pre-line">{v as string}</span> },
        { key: "qrp_message", header: "ปัญหาที่แจ้ง", render: (v) => <span className="line-clamp-2">{v as string}</span> },
        { key: "cus_username", header: "แจ้งโดย" },
        {
            key: "qrp_status",
            header: "สถานะ",
            render: (v) => {
                const status = v as QuestionReport["qrp_status"];
                return (
                    <span className={status === "open" ? "text-amber-600" : "text-green-600"}>
                        {status === "open" ? "รอตรวจสอบ" : "ปิดเคสแล้ว"}
                    </span>
                );
            },
        },
        { key: "qrp_created_at", header: "แจ้งเมื่อ", render: (v) => formatDate(v) },
    ];

    if (!hasBit(BITS.productsManagement)) {
        return <p className="p-6 text-gray-500">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">แจ้งปัญหารายข้อ</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        ตรวจสอบคำถามที่ลูกค้าแจ้งว่ามีปัญหา (เฉลยผิด/พิมพ์ตก) แล้วไปแก้ไขคำถามจริงในหน้าจัดการชุดข้อสอบ
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/products")}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                    กลับไปจัดการชุดข้อสอบ
                </button>
            </div>

            <DataTable
                columns={columns}
                data={reports}
                rowKey="qrp_id"
                loading={isPending}
                actions={(row) =>
                    row.qrp_status === "open" && hasBit(BITS.editProduct) ? (
                        <button
                            type="button"
                            onClick={() => handleResolve(row.qrp_id)}
                            disabled={resolvingId === row.qrp_id}
                            className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                        >
                            {resolvingId === row.qrp_id ? "กำลังบันทึก..." : "ปิดเคส"}
                        </button>
                    ) : null
                }
            />
        </div>
    );
}
