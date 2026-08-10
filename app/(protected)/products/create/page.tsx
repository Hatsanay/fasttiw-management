"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadCategoryOptions } from "@/app/lib/categoryOptions";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DragDropImage from "@/components/ui/DragDropImage";

async function uploadCover(productId: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    await fetch(`${api}/products/${productId}/image`, {
        method: "PUT",
        headers: authHeader(),
        body: fd,
    });
}

async function loadStaffOptions(search: string) {
    const res = await fetch(`${api}/users?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { user_id: string; by_fullname: string }[] };
    return data.map((u) => ({ value: u.user_id, label: u.by_fullname }));
}

type FormErrors = {
    prod_name?: string; prod_price?: string; exam_duration?: string; commission_value?: string; entitlement_duration?: string;
};

function validate(
    prodName: string, prodPrice: string, isFree: boolean, examDuration: string,
    commissionStaffId: string, commissionType: "percent" | "fixed", commissionValue: string,
    entitlementLifetime: boolean, entitlementDuration: string
): FormErrors {
    const errors: FormErrors = {};

    if (!prodName.trim())              errors.prod_name = "กรุณากรอกชื่อชุดข้อสอบ";
    else if (prodName.trim().length < 2) errors.prod_name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";

    if (!isFree) {
        const priceNum = Number(prodPrice);
        if (!prodPrice.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
            errors.prod_price = "กรุณากรอกราคามากกว่า 0 (หรือติ๊กแจกฟรีถ้าต้องการแจกฟรี)";
        }
    }

    const durationNum = Number(examDuration);
    if (!examDuration.trim() || !Number.isInteger(durationNum) || durationNum < 1 || durationNum > 600) {
        errors.exam_duration = "เวลาสอบต้องเป็นจำนวนเต็ม 1-600 นาที";
    }

    if (!entitlementLifetime) {
        const entitlementNum = Number(entitlementDuration);
        if (!entitlementDuration.trim() || !Number.isInteger(entitlementNum) || entitlementNum < 1 || entitlementNum > 120) {
            errors.entitlement_duration = "ระยะเวลาสิทธิ์ต้องเป็นจำนวนเต็ม 1-120 เดือน (หรือติ๊กไม่มีวันหมดอายุ)";
        }
    }

    // ค่าคอมไม่บังคับ แต่ถ้าเลือกพนักงานแล้วต้องกรอกมูลค่าด้วย (ตั้งครึ่งๆ กลางๆ ไม่มีความหมาย)
    if (commissionStaffId) {
        const commissionNum = Number(commissionValue);
        if (!commissionValue.trim() || !Number.isFinite(commissionNum) || commissionNum <= 0) {
            errors.commission_value = "กรุณากรอกมูลค่าค่าคอมมากกว่า 0 หรือลบพนักงานที่เลือกไว้ออก";
        } else if (commissionType === "percent" && commissionNum > 100) {
            errors.commission_value = "ค่าคอมแบบเปอร์เซ็นต์ต้องไม่เกิน 100";
        }
    }

    return errors;
}

export default function CreateProductPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [prodName, setProdName] = useState("");
    const [prodDescription, setProdDescription] = useState("");
    const [prodPrice, setProdPrice] = useState("0");
    const [isFree, setIsFree] = useState(false);
    const [examDuration, setExamDuration] = useState("60");
    // ค่าเริ่มต้น lifetime=true เหมือนพฤติกรรมเดิมของระบบก่อนมีฟีเจอร์นี้ — แอดมินต้องเลือกกำหนดระยะเวลาเอง
    // ถ้าต้องการ ไม่บังคับเปลี่ยนพฤติกรรมเดิมโดยไม่ตั้งใจ
    const [entitlementLifetime, setEntitlementLifetime] = useState(true);
    const [entitlementDuration, setEntitlementDuration] = useState("12");
    const [prodCategoryId, setProdCategoryId] = useState("");
    const [commissionStaffId, setCommissionStaffId] = useState("");
    const [commissionType, setCommissionType] = useState<"percent" | "fixed">("percent");
    const [commissionValue, setCommissionValue] = useState("");
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setProdName(e.target.value);
        if (errors.prod_name) setErrors((prev) => ({ ...prev, prod_name: undefined }));
    }

    function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        setProdPrice(e.target.value);
        if (errors.prod_price) setErrors((prev) => ({ ...prev, prod_price: undefined }));
    }

    function handleFreeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setIsFree(e.target.checked);
        if (errors.prod_price) setErrors((prev) => ({ ...prev, prod_price: undefined }));
    }

    function handleDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
        setExamDuration(e.target.value);
        if (errors.exam_duration) setErrors((prev) => ({ ...prev, exam_duration: undefined }));
    }

    function handleLifetimeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEntitlementLifetime(e.target.checked);
        if (errors.entitlement_duration) setErrors((prev) => ({ ...prev, entitlement_duration: undefined }));
    }

    function handleEntitlementDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEntitlementDuration(e.target.value);
        if (errors.entitlement_duration) setErrors((prev) => ({ ...prev, entitlement_duration: undefined }));
    }

    function handleCommissionValueChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCommissionValue(e.target.value);
        if (errors.commission_value) setErrors((prev) => ({ ...prev, commission_value: undefined }));
    }

    function handleCommissionStaffChange(v: string) {
        setCommissionStaffId(v);
        if (!v && errors.commission_value) setErrors((prev) => ({ ...prev, commission_value: undefined }));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(
            prodName, prodPrice, isFree, examDuration, commissionStaffId, commissionType, commissionValue,
            entitlementLifetime, entitlementDuration
        );
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    prod_name: prodName,
                    prod_description: prodDescription,
                    prod_price: Number(prodPrice) || 0,
                    prod_is_free: isFree,
                    prod_exam_duration_minutes: Number(examDuration) || 60,
                    prod_entitlement_duration_months: entitlementLifetime ? null : Number(entitlementDuration),
                    prod_category_id: prodCategoryId || null,
                    prod_commission_staff_id: commissionStaffId || null,
                    prod_commission_type: commissionStaffId ? commissionType : null,
                    prod_commission_value: commissionStaffId ? Number(commissionValue) || null : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            const { prod_id } = await res.json();
            if (coverFile) await uploadCover(prod_id, coverFile);

            router.push("/products");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างชุดข้อสอบ</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รูปหน้าปก</label>
                    <DragDropImage onChange={setCoverFile} disabled={isPending} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อชุดข้อสอบ</label>
                    <Input
                        value={prodName}
                        onChange={handleNameChange}
                        className="w-full"
                        placeholder="เช่น แนวข้อสอบ ก.พ. 68"
                        error={!!errors.prod_name}
                    />
                    {errors.prod_name && <p className="text-xs text-red-500 mt-1">{errors.prod_name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                    <textarea
                        value={prodDescription}
                        onChange={(e) => setProdDescription(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                        placeholder="คำอธิบายชุดข้อสอบ"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท)</label>
                    <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={prodPrice}
                        onChange={handlePriceChange}
                        className="w-full"
                        error={!!errors.prod_price}
                    />
                    {errors.prod_price && <p className="text-xs text-red-500 mt-1">{errors.prod_price}</p>}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
                        <input
                            type="checkbox"
                            checked={isFree}
                            onChange={handleFreeChange}
                            className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-sm text-gray-700">แจกฟรี (เก็บเงินจริง 0 บาทตอนเช็คเอาท์ ไม่ว่าราคาด้านบนจะตั้งไว้เท่าไหร่ — ใส่ไว้โชว์เป็น &quot;ราคาปกติ&quot; ได้)</span>
                    </label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสอบ (นาที) — สำหรับโหมดจับเวลา</label>
                    <Input
                        type="number"
                        min={1}
                        max={600}
                        value={examDuration}
                        onChange={handleDurationChange}
                        className="w-full"
                        error={!!errors.exam_duration}
                    />
                    {errors.exam_duration && <p className="text-xs text-red-500 mt-1">{errors.exam_duration}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาสิทธิ์หลังลูกค้าซื้อเอง</label>
                    <label className="flex items-center gap-2 cursor-pointer w-fit mb-2">
                        <input
                            type="checkbox"
                            checked={entitlementLifetime}
                            onChange={handleLifetimeChange}
                            className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-sm text-gray-700">ไม่มีวันหมดอายุ (lifetime)</span>
                    </label>
                    {!entitlementLifetime && (
                        <>
                            <Input
                                type="number" min={1} max={120}
                                value={entitlementDuration}
                                onChange={handleEntitlementDurationChange}
                                className="w-40"
                                placeholder="เช่น 12"
                                error={!!errors.entitlement_duration}
                            />
                            {errors.entitlement_duration && <p className="text-xs text-red-500 mt-1">{errors.entitlement_duration}</p>}
                        </>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                        มีผลเฉพาะลูกค้าที่ซื้อเองผ่านหน้าเว็บนับจากนี้ ไม่กระทบสิทธิ์เดิมที่ลูกค้าถืออยู่แล้ว และไม่กระทบการให้สิทธิ์มือของแอดมิน (เลือกระยะเวลาแยกได้ตอน grant อยู่แล้ว)
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                    <SearchableSelect
                        loadOptions={loadCategoryOptions}
                        value={prodCategoryId}
                        onChange={setProdCategoryId}
                        placeholder="— เลือกหมวดหมู่ (ไม่บังคับ) —"
                        disabled={isPending}
                    />
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ค่าคอมมิชชั่น (ไม่บังคับ)</label>
                        <SearchableSelect
                            loadOptions={loadStaffOptions}
                            value={commissionStaffId}
                            onChange={handleCommissionStaffChange}
                            placeholder="— เลือกพนักงานที่รับค่าคอม —"
                            disabled={isPending}
                        />
                    </div>
                    {commissionStaffId && (
                        <div>
                            <div className="flex gap-3">
                                <select
                                    value={commissionType}
                                    onChange={(e) => setCommissionType(e.target.value === "fixed" ? "fixed" : "percent")}
                                    className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                                >
                                    <option value="percent">เปอร์เซ็นต์ (%)</option>
                                    <option value="fixed">จำนวนเงิน (บาท)</option>
                                </select>
                                <Input
                                    type="number" min={0} step="0.01"
                                    value={commissionValue}
                                    onChange={handleCommissionValueChange}
                                    placeholder={commissionType === "percent" ? "เช่น 10" : "เช่น 100"}
                                    className="flex-1"
                                    error={!!errors.commission_value}
                                />
                            </div>
                            {errors.commission_value && <p className="text-xs text-red-500 mt-1">{errors.commission_value}</p>}
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/products")}
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
