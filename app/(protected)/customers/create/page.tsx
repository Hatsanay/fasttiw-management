"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import GrantProductsModal from "@/components/ui/GrantProductsModal";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

type CreatedCustomer = { cus_id: string; cus_username: string; temp_password: string };

async function submitCreateCustomer(): Promise<CreatedCustomer> {
    const res = await fetch(`${api}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

// ไม่มีฟอร์มให้กรอก — กดปุ่มเดียวได้ username (= รหัสลูกค้าไปก่อน) + รหัสผ่านชั่วคราวทันที เพราะช่องทางขาย
// ผ่านแชทเพจไม่อยากเก็บข้อมูลลูกค้าตอนขาย ชื่อ/อีเมล/เบอร์ กรอกทีหลังได้ที่หน้าแก้ไข (หรือลูกค้ากรอกเอง)
// หลังสร้างเสร็จ ให้คัดลอก username/รหัสผ่านก่อน แล้วต่อด้วย modal เลือกชุดข้อสอบให้สิทธิ์ได้ทันทีหลายชุด
// (ข้ามได้ทั้งสองขั้นถ้ายังไม่พร้อมให้สิทธิ์ตอนนี้ — ไปเพิ่มทีหลังได้)
export default function CreateCustomerPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [created, setCreated] = useState<CreatedCustomer | null>(null);
    const [showCredentials, setShowCredentials] = useState(false);
    const [showGrantModal, setShowGrantModal] = useState(false);

    function handleCreate() {
        setSubmitError(null);
        startTransition(async () => {
            try {
                const data = await submitCreateCustomer();
                setCreated(data);
                setShowCredentials(true);
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            }
        });
    }

    async function copyAndProceedToGrant() {
        if (created) {
            const text = `Username: ${created.cus_username}\nรหัสผ่านชั่วคราว: ${created.temp_password}`;
            await navigator.clipboard.writeText(text).catch(() => {});
        }
        toast.success("คัดลอก Username และรหัสผ่านชั่วคราวแล้ว");
        setShowCredentials(false);
        setShowGrantModal(true);
    }

    function skipToCustomerList() {
        router.push("/customers");
    }

    return (
        <div className="p-4 sm:p-6 max-w-md mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างลูกค้า</h1>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center text-center gap-5">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-blue-500" />
                </div>

                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                    กดปุ่มด้านล่างเพื่อสร้างบัญชีลูกค้าใหม่ทันที ระบบจะออก Username และรหัสผ่านชั่วคราวให้
                    นำไปส่งลูกค้าเองได้เลย (เช่น ทางแชทเพจ) ส่วนชื่อ/อีเมล/เบอร์โทร กรอกเพิ่มทีหลังได้ที่หน้าแก้ไข
                </p>

                {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                <div className="flex gap-3 pt-1">
                    <button
                        type="button"
                        onClick={() => router.push("/customers")}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={isPending}
                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                    >
                        {isPending ? "กำลังสร้าง..." : "สร้างลูกค้าใหม่"}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={showCredentials}
                variant="info"
                title="สร้างลูกค้าสำเร็จ"
                description={created ? `Username: ${created.cus_username}\nรหัสผ่านชั่วคราว: ${created.temp_password}\n\nระบบจะบังคับให้ลูกค้าตั้งรหัสผ่านใหม่ตอน login ครั้งแรก กรุณาคัดลอกไปให้ลูกค้าก่อนปิดหน้าต่างนี้` : undefined}
                confirmLabel="คัดลอก แล้วเลือกชุดข้อสอบ"
                cancelLabel="ข้ามขั้นตอนนี้"
                onConfirm={copyAndProceedToGrant}
                onCancel={skipToCustomerList}
            />

            {created && (
                <GrantProductsModal
                    open={showGrantModal}
                    customerId={created.cus_id}
                    onClose={skipToCustomerList}
                />
            )}
        </div>
    );
}
