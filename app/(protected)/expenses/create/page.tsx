"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { toDateInput } from "@/app/lib/date";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";

async function loadExpenseCategoryOptions(search: string) {
    const res = await fetch(
        `${api}/expense-categories?${new URLSearchParams({ limit: "20", offset: "0", status: "active", search })}`,
        { headers: authHeader() }
    );
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { excat_id: string; excat_name: string }[] };
    return data.map((c) => ({ value: c.excat_id, label: c.excat_name }));
}

async function loadProductOptions(search: string) {
    const res = await fetch(`${api}/products?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { prod_id: string; prod_name: string }[] };
    return data.map((p) => ({ value: p.prod_id, label: p.prod_name }));
}

function todayDateInputValue(): string {
    return toDateInput(new Date());
}

export default function CreateExpensePage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [categoryId, setCategoryId] = useState("");
    const [productId, setProductId] = useState("");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [date, setDate] = useState(todayDateInputValue());
    const [errors, setErrors] = useState<{ category?: string; amount?: string; date?: string }>({});
    const [submitError, setSubmitError] = useState<string | null>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);

        const fieldErrors: typeof errors = {};
        if (!categoryId) fieldErrors.category = "กรุณาเลือกหมวดหมู่";
        const amountNum = Number(amount);
        if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) fieldErrors.amount = "จำนวนเงินต้องมากกว่า 0";
        if (!date) fieldErrors.date = "กรุณาเลือกวันที่";
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    exp_category_id: categoryId,
                    exp_product_id: productId || null,
                    exp_amount: amountNum,
                    exp_note: note || null,
                    exp_date: date,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setSubmitError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/expenses");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">บันทึกค่าใช้จ่าย</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                    <SearchableSelect
                        loadOptions={loadExpenseCategoryOptions}
                        value={categoryId}
                        onChange={setCategoryId}
                        placeholder="— เลือกหมวดหมู่ —"
                        disabled={isPending}
                        error={!!errors.category}
                    />
                    {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชุดข้อสอบ (ไม่บังคับ)</label>
                    <SearchableSelect
                        loadOptions={loadProductOptions}
                        value={productId}
                        onChange={setProductId}
                        placeholder="— ทั่วไป (ไม่ผูกกับชุดข้อสอบ) —"
                        disabled={isPending}
                    />
                    <p className="text-xs text-gray-400 mt-1">เว้นว่างไว้ถ้าเป็นรายจ่ายทั่วไป ไม่เจาะจงชุดข้อสอบ</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full"
                        error={!!errors.date}
                    />
                    {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
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
                        onClick={() => router.push("/expenses")}
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
