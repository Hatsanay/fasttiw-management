"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import { toast } from "sonner";

type DividendSettings = {
    legal_reserve_percent: number;
    dividend_percent: number;
    withholding_tax_percent: number;
    registered_capital: number;
};

async function fetchDividendSettings(): Promise<DividendSettings | null> {
    const res = await fetch(`${api}/settings/dividend`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

type FormErrors = { registeredCapital?: string; reservePercent?: string; dividendPercent?: string; taxPercent?: string };

function validatePercent(v: number): boolean {
    return Number.isFinite(v) && v >= 0 && v <= 100;
}

export default function DividendSettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(true);
    const [reservePercent, setReservePercent] = useState("0");
    const [dividendPercent, setDividendPercent] = useState("0");
    const [taxPercent, setTaxPercent] = useState("0");
    const [registeredCapital, setRegisteredCapital] = useState("0");
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);

    function handleCapitalChange(e: React.ChangeEvent<HTMLInputElement>) {
        setRegisteredCapital(e.target.value);
        if (errors.registeredCapital) setErrors((prev) => ({ ...prev, registeredCapital: undefined }));
    }

    function handleReserveChange(e: React.ChangeEvent<HTMLInputElement>) {
        setReservePercent(e.target.value);
        if (errors.reservePercent) setErrors((prev) => ({ ...prev, reservePercent: undefined }));
    }

    function handleDividendChange(e: React.ChangeEvent<HTMLInputElement>) {
        setDividendPercent(e.target.value);
        if (errors.dividendPercent) setErrors((prev) => ({ ...prev, dividendPercent: undefined }));
    }

    function handleTaxChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTaxPercent(e.target.value);
        if (errors.taxPercent) setErrors((prev) => ({ ...prev, taxPercent: undefined }));
    }

    useEffect(() => {
        fetchDividendSettings().then((data) => {
            if (data) {
                setReservePercent(String(data.legal_reserve_percent));
                setDividendPercent(String(data.dividend_percent));
                setTaxPercent(String(data.withholding_tax_percent));
                setRegisteredCapital(String(data.registered_capital));
            }
            setLoading(false);
        });
    }, []);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const values = {
            legal_reserve_percent: Number(reservePercent),
            dividend_percent: Number(dividendPercent),
            withholding_tax_percent: Number(taxPercent),
            registered_capital: Number(registeredCapital),
        };

        const fieldErrors: FormErrors = {};
        if (!Number.isFinite(values.registered_capital) || values.registered_capital < 0) {
            fieldErrors.registeredCapital = "ทุนจดทะเบียนต้องเป็นตัวเลขไม่ติดลบ";
        }
        if (!validatePercent(values.legal_reserve_percent)) fieldErrors.reservePercent = "เปอร์เซ็นต์ต้องเป็นตัวเลข 0-100";
        if (!validatePercent(values.dividend_percent)) fieldErrors.dividendPercent = "เปอร์เซ็นต์ต้องเป็นตัวเลข 0-100";
        if (!validatePercent(values.withholding_tax_percent)) fieldErrors.taxPercent = "เปอร์เซ็นต์ต้องเป็นตัวเลข 0-100";
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/settings/dividend`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(values),
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">ตั้งค่าการจัดสรรกำไร</h1>
            <p className="text-sm text-gray-400 mb-6">
                ใช้คำนวณตอนกด &quot;จัดสรรกำไร&quot; ที่หน้าจ่ายส่วนแบ่งกำไรหุ้นส่วน — เปลี่ยนค่าตรงนี้จะมีผลกับการจัดสรรครั้งถัดไปเท่านั้น ไม่กระทบรายการที่จัดสรรไปแล้ว
            </p>

            {loading ? (
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ทุนจดทะเบียน (บาท)</label>
                        <Input
                            type="number" min={0} step="0.01"
                            value={registeredCapital}
                            onChange={handleCapitalChange}
                            className="w-full"
                            error={!!errors.registeredCapital}
                        />
                        {errors.registeredCapital && <p className="text-xs text-red-500 mt-1">{errors.registeredCapital}</p>}
                        <p className="text-xs text-gray-400 mt-1">ใช้คำนวณเพดานทุนสำรองตามกฎหมาย (10% ของทุนจดทะเบียน) — ต้องตั้งค่านี้ก่อนถึงจะจัดสรรกำไรได้</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ทุนสำรองตามกฎหมาย (%)</label>
                        <Input
                            type="number" min={0} max={100} step="0.01"
                            value={reservePercent}
                            onChange={handleReserveChange}
                            className="w-40"
                            error={!!errors.reservePercent}
                        />
                        {errors.reservePercent && <p className="text-xs text-red-500 mt-1">{errors.reservePercent}</p>}
                        <p className="text-xs text-gray-400 mt-1">% ของกำไรงวดที่ต้องกันไว้เป็นทุนสำรอง กันไว้จนครบเพดาน 10% ของทุนจดทะเบียนแล้วหยุดกันอัตโนมัติ</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">จ่ายปันผล (% ของกำไรงวด)</label>
                        <Input
                            type="number" min={0} max={100} step="0.01"
                            value={dividendPercent}
                            onChange={handleDividendChange}
                            className="w-40"
                            error={!!errors.dividendPercent}
                        />
                        {errors.dividendPercent && <p className="text-xs text-red-500 mt-1">{errors.dividendPercent}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ภาษีหัก ณ ที่จ่าย (%)</label>
                        <Input
                            type="number" min={0} max={100} step="0.01"
                            value={taxPercent}
                            onChange={handleTaxChange}
                            className="w-40"
                            error={!!errors.taxPercent}
                        />
                        {errors.taxPercent && <p className="text-xs text-red-500 mt-1">{errors.taxPercent}</p>}
                        <p className="text-xs text-gray-400 mt-1">หักจากเงินปันผลของแต่ละหุ้นส่วนก่อนโอนจ่ายจริง</p>
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
