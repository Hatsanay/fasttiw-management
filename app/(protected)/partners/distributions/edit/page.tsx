"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

async function fetchDistribution(id: string) {
    const res = await fetch(`${api}/partner-distributions/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function EditPartnerDistributionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [partnerId, setPartnerId] = useState("");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [errors, setErrors] = useState<{ partner?: string; amount?: string }>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [alreadyPaid, setAlreadyPaid] = useState(false);

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchDistribution(id);
            if (!data) { setNotFound(true); return; }
            if (data.dist_status === "paid") { setAlreadyPaid(true); return; }
            setPartnerId(data.dist_partner_id ?? "");
            setAmount(String(data.dist_amount ?? ""));
            setNote(data.dist_note ?? "");
        });
    }, [id]);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);

        const fieldErrors: typeof errors = {};
        if (!partnerId) fieldErrors.partner = "กรุณาเลือกหุ้นส่วน";
        const amountNum = Number(amount);
        if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) fieldErrors.amount = "จำนวนเงินต้องมากกว่า 0";
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/partner-distributions/${id}`, {
                method: "PUT",
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

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบรายการจ่ายส่วนแบ่งนี้</p>;
    if (alreadyPaid) return <p className="p-6 text-gray-500">รายการนี้จ่ายไปแล้ว แก้ไขไม่ได้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขรายการจ่ายส่วนแบ่งกำไร</h1>

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
