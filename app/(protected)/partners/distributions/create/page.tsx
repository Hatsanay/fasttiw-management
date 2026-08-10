"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";

async function loadPartnerOptions(search: string) {
    const res = await fetch(`${api}/partners?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { user_id: string; fullname: string }[] };
    return data.map((p) => ({ value: p.user_id, label: p.fullname }));
}

export default function CreatePartnerDistributionPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [partnerId, setPartnerId] = useState("");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState<{ partner?: string; amount?: string }>({});
    const [submitError, setSubmitError] = useState<string | null>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);

        const fieldErrors: typeof errors = {};
        if (!partnerId) fieldErrors.partner = "กรุณาเลือกหุ้นส่วน";
        const amountNum = Number(amount);
        if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) fieldErrors.amount = "จำนวนเงินต้องมากกว่า 0";
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/partner-distributions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ dist_partner_id: partnerId, dist_amount: amountNum, dist_note: note || null }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setSubmitError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/partners/distributions");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">บันทึกจ่ายส่วนแบ่งกำไรหุ้นส่วน</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หุ้นส่วน</label>
                    <SearchableSelect
                        loadOptions={loadPartnerOptions}
                        value={partnerId}
                        onChange={setPartnerId}
                        placeholder="— เลือกหุ้นส่วน —"
                        disabled={isPending}
                        error={!!errors.partner}
                    />
                    {errors.partner && <p className="text-xs text-red-500 mt-1">{errors.partner}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
                    <Input
                        type="number" min={0} step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full"
                        error={!!errors.amount}
                    />
                    {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
                </div>

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
                        onClick={() => router.push("/partners/distributions")}
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
