"use client";

import CircularProgress from "@/components/ui/CircularProgress";

interface ProgressModalProps {
    open: boolean;
    percent: number;
    title?: string;
    message?: string;
    color?: string;
    onCancel?: () => void;
    cancelLabel?: string;
    cancelling?: boolean;
}

// Modal แสดงความคืบหน้าแบบ block ทั้งหน้าจอ — ใช้ตอนมีงานเบื้องหลังที่ต้องรอ (อัปโหลด/นำเข้าไฟล์)
// ไม่มีคลิกนอกเพื่อปิด (ไม่ผูก onClick backdrop) กันปิดโดยไม่ตั้งใจระหว่างงานยังไม่เสร็จ — ถ้าจะยกเลิก
// ต้องกดปุ่มยกเลิกที่ให้มาชัดเจนเท่านั้น ซึ่งฝั่งเรียกใช้ต้องรับผิดชอบ rollback/หยุดงานจริงเอง (ดู onCancel)
export default function ProgressModal({
    open, percent, title, message, color = "stroke-blue-500",
    onCancel, cancelLabel = "ยกเลิก", cancelling = false,
}: ProgressModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6 flex flex-col items-center gap-3">
                {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
                <CircularProgress percent={percent} color={color} />
                {message && <p className="text-sm text-gray-500 text-center">{message}</p>}
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={cancelling}
                        className="mt-1 px-4 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                        {cancelling ? "กำลังยกเลิก..." : cancelLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
