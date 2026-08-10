"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import Form from "@/components/ui/form/Form";

type FormState = {
    cpn_code: string;
    cpn_discount_type: "percent" | "fixed";
    cpn_discount_value: string;
    cpn_max_uses: string;
    cpn_expires_at: string;
    cpn_status: "active" | "inactive";
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
    const errors: FormErrors = {};

    if (!form.cpn_code.trim()) errors.cpn_code = "กรุณากรอกโค้ดคูปอง";

    const value = Number(form.cpn_discount_value);
    if (!form.cpn_discount_value || !Number.isFinite(value) || value <= 0) {
        errors.cpn_discount_value = "มูลค่าส่วนลดต้องมากกว่า 0";
    } else if (form.cpn_discount_type === "percent" && value > 100) {
        errors.cpn_discount_value = "ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100";
    }

    if (form.cpn_max_uses && (!Number.isInteger(Number(form.cpn_max_uses)) || Number(form.cpn_max_uses) <= 0)) {
        errors.cpn_max_uses = "ต้องเป็นจำนวนเต็มมากกว่า 0";
    }

    return errors;
}

// ตัด time ทิ้งจาก datetime ที่ backend คืนมา (ISO string) ให้เหลือแค่ yyyy-mm-dd ใส่ input type=date ได้ตรงๆ
function toDateInputValue(isoString: string | null): string {
    return isoString ? isoString.slice(0, 10) : "";
}

async function fetchCoupon(id: string) {
    const res = await fetch(`${api}/coupons/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function submitUpdateCoupon(id: string, body: Record<string, unknown>) {
    const res = await fetch(`${api}/coupons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

const EMPTY_FORM: FormState = {
    cpn_code: "", cpn_discount_type: "percent", cpn_discount_value: "", cpn_max_uses: "",
    cpn_expires_at: "", cpn_status: "active",
};

export default function EditCouponPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [usedCount, setUsedCount] = useState(0);

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchCoupon(id);
            if (!data) { setNotFound(true); return; }
            setForm({
                cpn_code: data.cpn_code ?? "",
                cpn_discount_type: data.cpn_discount_type === "fixed" ? "fixed" : "percent",
                cpn_discount_value: String(data.cpn_discount_value ?? ""),
                cpn_max_uses: data.cpn_max_uses != null ? String(data.cpn_max_uses) : "",
                cpn_expires_at: toDateInputValue(data.cpn_expires_at),
                cpn_status: data.cpn_status === "inactive" ? "inactive" : "active",
            });
            setUsedCount(data.cpn_used_count ?? 0);
        });
    }, [id]);

    function setField(name: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setField(e.target.name as keyof FormState, e.target.value);
    }

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);
        const fieldErrors = validate(form);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            try {
                await submitUpdateCoupon(id!, {
                    cpn_code: form.cpn_code,
                    cpn_discount_type: form.cpn_discount_type,
                    cpn_discount_value: Number(form.cpn_discount_value),
                    cpn_max_uses: form.cpn_max_uses ? Number(form.cpn_max_uses) : null,
                    cpn_expires_at: form.cpn_expires_at || null,
                    cpn_status: form.cpn_status,
                });
                router.push("/coupons");
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            }
        });
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบคูปองนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">แก้ไขคูปองส่วนลด</h1>
            <p className="text-sm text-gray-500 mb-6">ใช้ไปแล้ว {usedCount} ครั้ง</p>

            <Form cols={2} onSubmit={handleSubmit} className="bg-white shadow-sm border-gray-100 rounded-xl">
                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">โค้ดคูปอง</label>
                    <Input name="cpn_code" value={form.cpn_code} onChange={handleChange}
                        placeholder="เช่น SAVE10" error={!!errors.cpn_code} />
                    {errors.cpn_code && <p className="text-xs text-red-500">{errors.cpn_code}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">ประเภทส่วนลด</label>
                    <select
                        value={form.cpn_discount_type}
                        onChange={(e) => setField("cpn_discount_type", e.target.value as "percent" | "fixed")}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    >
                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                        <option value="fixed">จำนวนเงิน (บาท)</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">
                        มูลค่าส่วนลด {form.cpn_discount_type === "percent" ? "(%)" : "(บาท)"}
                    </label>
                    <Input
                        type="number" min={0} step="0.01"
                        name="cpn_discount_value" value={form.cpn_discount_value} onChange={handleChange}
                        error={!!errors.cpn_discount_value}
                    />
                    {errors.cpn_discount_value && <p className="text-xs text-red-500">{errors.cpn_discount_value}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">จำนวนครั้งที่ใช้ได้</label>
                    <Input
                        type="number" min={1}
                        name="cpn_max_uses" value={form.cpn_max_uses} onChange={handleChange}
                        placeholder="ไม่บังคับ — เว้นว่างถ้าไม่จำกัด"
                        error={!!errors.cpn_max_uses}
                    />
                    {errors.cpn_max_uses && <p className="text-xs text-red-500">{errors.cpn_max_uses}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">วันหมดอายุ</label>
                    <Input
                        type="date"
                        name="cpn_expires_at" value={form.cpn_expires_at} onChange={handleChange}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">สถานะการใช้งาน</label>
                    <select
                        value={form.cpn_status}
                        onChange={(e) => setField("cpn_status", e.target.value === "inactive" ? "inactive" : "active")}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    >
                        <option value="active">ใช้งาน</option>
                        <option value="inactive">ยกเลิกใช้งาน</option>
                    </select>
                </div>

                {submitError && <p className="col-span-2 text-sm text-red-600">{submitError}</p>}

                <div className="col-span-2 flex justify-end gap-3">
                    <button type="button" onClick={() => router.push("/coupons")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        ยกเลิก
                    </button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                </div>
            </Form>
        </div>
    );
}
