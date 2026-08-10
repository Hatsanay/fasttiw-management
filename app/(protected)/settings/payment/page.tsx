"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import { toast } from "sonner";

async function fetchPaymentSettings(): Promise<{ payment_gateway_fee_percent: number } | null> {
    const res = await fetch(`${api}/settings/payment`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function PaymentSettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(true);
    const [feePercent, setFeePercent] = useState("0");
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPaymentSettings().then((data) => {
            if (data) setFeePercent(String(data.payment_gateway_fee_percent));
            setLoading(false);
        });
    }, []);

    function handleFeeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFeePercent(e.target.value);
        if (fieldError) setFieldError(null);
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setFieldError(null);

        const value = Number(feePercent);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
            setFieldError("เปอร์เซ็นต์ค่าธรรมเนียมต้องเป็นตัวเลข 0-100");
            return;
        }

        startTransition(async () => {
            const res = await fetch(`${api}/settings/payment`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ payment_gateway_fee_percent: value }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            toast.success("บันทึกการตั้งค่าสำเร็จ");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">ค่าธรรมเนียมการชำระเงิน</h1>
            <p className="text-sm text-gray-400 mb-6">
                % ที่ผู้ให้บริการ payment gateway (Omise) หักต่อรายการตอนลูกค้าจ่ายผ่าน QR PromptPay — ระบบจะหักตามนี้จากยอดขายอัตโนมัติทุกครั้งที่มีการจ่ายเงินจริงผ่าน QR
            </p>

            {loading ? (
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">เปอร์เซ็นต์ค่าธรรมเนียม (%)</label>
                        <Input
                            type="number" min={0} max={100} step="0.01"
                            value={feePercent}
                            onChange={handleFeeChange}
                            className="w-40"
                            error={!!fieldError}
                        />
                        {fieldError && <p className="text-xs text-red-500 mt-1">{fieldError}</p>}
                        <p className="text-xs text-gray-400 mt-1">เช่น ถ้า Omise หัก 1.77% ต่อรายการ ให้ใส่ 1.77</p>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "กำลังบันทึก..." : "บันทึก"}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
