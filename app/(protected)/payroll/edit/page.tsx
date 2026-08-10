"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";

async function loadStaffOptions(search: string) {
    const res = await fetch(`${api}/users?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { user_id: string; by_fullname: string }[] };
    return data.map((u) => ({ value: u.user_id, label: u.by_fullname }));
}

async function fetchPayroll(id: string) {
    const res = await fetch(`${api}/payrolls/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

const MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export default function EditPayrollPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [staffId, setStaffId] = useState("");
    const [month, setMonth] = useState("1");
    const [year, setYear] = useState("");
    const [baseSalary, setBaseSalary] = useState("");
    const [bonus, setBonus] = useState("0");
    const [allowance, setAllowance] = useState("0");
    const [socialSecurity, setSocialSecurity] = useState("0");
    const [withholdingTax, setWithholdingTax] = useState("0");
    const [otherDeduction, setOtherDeduction] = useState("0");
    const [note, setNote] = useState("");

    const [errors, setErrors] = useState<{ staff?: string; baseSalary?: string }>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [alreadyPaid, setAlreadyPaid] = useState(false);

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchPayroll(id);
            if (!data) { setNotFound(true); return; }
            if (data.pay_status === "paid") { setAlreadyPaid(true); return; }
            setStaffId(data.pay_staff_id ?? "");
            setMonth(String(data.pay_period_month ?? 1));
            setYear(String(data.pay_period_year ?? ""));
            setBaseSalary(String(data.pay_base_salary ?? ""));
            setBonus(String(data.pay_bonus ?? "0"));
            setAllowance(String(data.pay_allowance ?? "0"));
            setSocialSecurity(String(data.pay_social_security ?? "0"));
            setWithholdingTax(String(data.pay_withholding_tax ?? "0"));
            setOtherDeduction(String(data.pay_other_deduction ?? "0"));
            setNote(data.pay_note ?? "");
        });
    }, [id]);

    const netAmount = useMemo(() => {
        const base = Number(baseSalary) || 0;
        const b = Number(bonus) || 0;
        const a = Number(allowance) || 0;
        const ss = Number(socialSecurity) || 0;
        const tax = Number(withholdingTax) || 0;
        const other = Number(otherDeduction) || 0;
        return base + b + a - ss - tax - other;
    }, [baseSalary, bonus, allowance, socialSecurity, withholdingTax, otherDeduction]);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);

        const fieldErrors: typeof errors = {};
        if (!staffId) fieldErrors.staff = "กรุณาเลือกพนักงาน";
        const baseNum = Number(baseSalary);
        if (!baseSalary || !Number.isFinite(baseNum) || baseNum <= 0) fieldErrors.baseSalary = "เงินเดือนพื้นฐานต้องมากกว่า 0";
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
        if (netAmount < 0) { setSubmitError("ยอดสุทธิติดลบ กรุณาตรวจสอบยอดหักก่อนบันทึก"); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/payrolls/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    pay_staff_id: staffId,
                    pay_period_month: Number(month),
                    pay_period_year: Number(year),
                    pay_base_salary: baseNum,
                    pay_bonus: Number(bonus) || 0,
                    pay_allowance: Number(allowance) || 0,
                    pay_social_security: Number(socialSecurity) || 0,
                    pay_withholding_tax: Number(withholdingTax) || 0,
                    pay_other_deduction: Number(otherDeduction) || 0,
                    pay_note: note || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setSubmitError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/payroll");
        });
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบรายการเงินเดือนนี้</p>;
    if (alreadyPaid) return <p className="p-6 text-gray-500">รายการนี้จ่ายไปแล้ว แก้ไขไม่ได้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขรายการเงินเดือน</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">พนักงาน</label>
                    <SearchableSelect
                        loadOptions={loadStaffOptions}
                        value={staffId}
                        onChange={setStaffId}
                        placeholder="— เลือกพนักงาน —"
                        disabled={isPending}
                        error={!!errors.staff}
                    />
                    {errors.staff && <p className="text-xs text-red-500 mt-1">{errors.staff}</p>}
                </div>

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
                        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-full" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เงินเดือนพื้นฐาน (บาท)</label>
                    <Input
                        type="number" min={0} step="0.01"
                        value={baseSalary}
                        onChange={(e) => setBaseSalary(e.target.value)}
                        className="w-full"
                        error={!!errors.baseSalary}
                    />
                    {errors.baseSalary && <p className="text-xs text-red-500 mt-1">{errors.baseSalary}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">โบนัส (บาท)</label>
                        <Input type="number" min={0} step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} className="w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">เบี้ยเลี้ยง/ค่าตำแหน่ง (บาท)</label>
                        <Input type="number" min={0} step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} className="w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หักประกันสังคม (บาท)</label>
                        <Input type="number" min={0} step="0.01" value={socialSecurity} onChange={(e) => setSocialSecurity(e.target.value)} className="w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หักภาษี ณ ที่จ่าย (บาท)</label>
                        <Input type="number" min={0} step="0.01" value={withholdingTax} onChange={(e) => setWithholdingTax(e.target.value)} className="w-full" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">หักอื่นๆ (บาท)</label>
                        <Input type="number" min={0} step="0.01" value={otherDeduction} onChange={(e) => setOtherDeduction(e.target.value)} className="w-full" />
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <span className="text-sm font-medium text-gray-600">ยอดสุทธิ</span>
                    <span className={`text-lg font-bold ${netAmount < 0 ? "text-red-600" : "text-gray-800"}`}>{formatBaht(netAmount)}</span>
                </div>
                {netAmount < 0 && (
                    <p className="text-xs text-red-500 -mt-4">ยอดสุทธิติดลบ (รายการหักรวมกันมากกว่าเงินเดือน+โบนัส+เบี้ยเลี้ยง) กรุณาตรวจสอบตัวเลขก่อนบันทึก</p>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                        placeholder="ไม่บังคับ"
                    />
                </div>

                {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/payroll")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
