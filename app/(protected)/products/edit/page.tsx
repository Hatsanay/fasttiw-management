"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadCategoryOptions } from "@/app/lib/categoryOptions";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DragDropImage from "@/components/ui/DragDropImage";
import { validateTotalScoreInput, MAX_TOTAL_SCORE, formatScore } from "@/app/lib/scoring";

type Product = {
    prod_id: string;
    prod_name: string;
    prod_description: string | null;
    prod_price: number;
    prod_compare_price: number | null;
    prod_is_free: boolean;
    prod_cover_url: string | null;
    prod_status: "draft" | "published" | "archived";
    prod_category_id: string | null;
    prod_commission_staff_id: string | null;
    prod_commission_type: "percent" | "fixed" | null;
    prod_commission_value: number | null;
    prod_exam_duration_minutes: number;
    prod_entitlement_duration_months: number | null;
    prod_total_score: string | number | null;
    used_score: string | number;
};

async function fetchProductById(id: string): Promise<Product | null> {
    const res = await fetch(`${api}/products/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

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

const SERVER_BASE = new URL(api).origin;

type FormErrors = {
    prod_name?: string; prod_price?: string; prod_compare_price?: string; exam_duration?: string; commission_value?: string; entitlement_duration?: string; total_score?: string;
};

function validate(
    prodName: string, prodPrice: string, prodComparePrice: string, isFree: boolean, examDuration: string,
    commissionStaffId: string, commissionType: "percent" | "fixed", commissionValue: string,
    entitlementLifetime: boolean, entitlementDuration: string,
    useScoring: boolean, totalScore: string, usedScore: number
): FormErrors {
    const errors: FormErrors = {};

    if (!prodName.trim())              errors.prod_name = "กรุณากรอกชื่อชุดข้อสอบ";
    else if (prodName.trim().length < 2) errors.prod_name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";

    if (!isFree) {
        const priceNum = Number(prodPrice);
        if (!prodPrice.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
            errors.prod_price = "กรุณากรอกราคามากกว่า 0 (หรือติ๊กแจกฟรีถ้าต้องการแจกฟรี)";
        }

        if (prodComparePrice.trim()) {
            const compareNum = Number(prodComparePrice);
            if (!Number.isFinite(compareNum) || compareNum <= priceNum) {
                errors.prod_compare_price = "ราคาปกติต้องมากกว่าราคาขายจริง ไม่งั้นจะไม่ใช่ส่วนลด";
            }
        }
    }

    const durationNum = Number(examDuration);
    if (!examDuration.trim() || !Number.isInteger(durationNum) || durationNum < 1 || durationNum > 600) {
        errors.exam_duration = "เวลาสอบต้องเป็นจำนวนเต็ม 1-600 นาที";
    }

    if (useScoring) {
        const scoreError = validateTotalScoreInput(totalScore);
        if (scoreError) errors.total_score = scoreError;
        // เตือนตั้งแต่ในฟอร์มว่าคะแนนเต็มใหม่ต่ำกว่าที่ข้อต่างๆ ใช้ไปแล้ว (backend ก็ปฏิเสธเหมือนกัน
        // แต่บอกที่นี่ก่อนจะได้ไม่ต้องกดบันทึกแล้วเด้ง error กลับมา)
        else if (Number(totalScore) < usedScore) {
            errors.total_score = `คะแนนเต็มต้องไม่ต่ำกว่าคะแนนที่ข้อต่างๆ ใช้ไปแล้ว (${formatScore(usedScore)} คะแนน)`;
        }
    }

    if (!entitlementLifetime) {
        const entitlementNum = Number(entitlementDuration);
        if (!entitlementDuration.trim() || !Number.isInteger(entitlementNum) || entitlementNum < 1 || entitlementNum > 120) {
            errors.entitlement_duration = "ระยะเวลาสิทธิ์ต้องเป็นจำนวนเต็ม 1-120 เดือน (หรือติ๊กไม่มีวันหมดอายุ)";
        }
    }

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

export default function EditProductPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [prodName, setProdName] = useState("");
    const [prodDescription, setProdDescription] = useState("");
    const [prodPrice, setProdPrice] = useState("0");
    const [prodComparePrice, setProdComparePrice] = useState("");
    const [isFree, setIsFree] = useState(false);
    const [examDuration, setExamDuration] = useState("60");
    const [entitlementLifetime, setEntitlementLifetime] = useState(true);
    const [entitlementDuration, setEntitlementDuration] = useState("12");
    const [useScoring, setUseScoring] = useState(false);
    const [totalScore, setTotalScore] = useState("100");
    // ผลรวมคะแนนของข้อที่ active อยู่ตอนนี้ (มาจาก backend) ใช้เตือนตอนแอดมินจะลดคะแนนเต็มลง
    const [usedScore, setUsedScore] = useState(0);
    const [prodStatus, setProdStatus] = useState<Product["prod_status"]>("draft");
    const [prodCategoryId, setProdCategoryId] = useState("");
    const [commissionStaffId, setCommissionStaffId] = useState("");
    const [commissionType, setCommissionType] = useState<"percent" | "fixed">("percent");
    const [commissionValue, setCommissionValue] = useState("");
    const [currentCover, setCurrentCover] = useState<string | undefined>(undefined);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setProdName(e.target.value);
        if (errors.prod_name) setErrors((prev) => ({ ...prev, prod_name: undefined }));
    }

    function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        setProdPrice(e.target.value);
        if (errors.prod_price) setErrors((prev) => ({ ...prev, prod_price: undefined }));
    }

    function handleComparePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        setProdComparePrice(e.target.value);
        if (errors.prod_compare_price) setErrors((prev) => ({ ...prev, prod_compare_price: undefined }));
    }

    function handleFreeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setIsFree(e.target.checked);
        if (errors.prod_price) setErrors((prev) => ({ ...prev, prod_price: undefined }));
    }

    function handleDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
        setExamDuration(e.target.value);
        if (errors.exam_duration) setErrors((prev) => ({ ...prev, exam_duration: undefined }));
    }

    function handleCommissionValueChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCommissionValue(e.target.value);
        if (errors.commission_value) setErrors((prev) => ({ ...prev, commission_value: undefined }));
    }

    function handleLifetimeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEntitlementLifetime(e.target.checked);
        if (errors.entitlement_duration) setErrors((prev) => ({ ...prev, entitlement_duration: undefined }));
    }

    function handleEntitlementDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEntitlementDuration(e.target.value);
        if (errors.entitlement_duration) setErrors((prev) => ({ ...prev, entitlement_duration: undefined }));
    }

    function handleUseScoringChange(e: React.ChangeEvent<HTMLInputElement>) {
        setUseScoring(e.target.checked);
        if (errors.total_score) setErrors((prev) => ({ ...prev, total_score: undefined }));
    }

    function handleTotalScoreChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTotalScore(e.target.value);
        if (errors.total_score) setErrors((prev) => ({ ...prev, total_score: undefined }));
    }

    function handleCommissionStaffChange(v: string) {
        setCommissionStaffId(v);
        if (!v && errors.commission_value) setErrors((prev) => ({ ...prev, commission_value: undefined }));
    }

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchProductById(id);
            if (!data) { setNotFound(true); return; }
            setProdName(data.prod_name);
            setProdDescription(data.prod_description ?? "");
            setProdPrice(String(data.prod_price));
            setProdComparePrice(data.prod_compare_price != null ? String(data.prod_compare_price) : "");
            setIsFree(!!data.prod_is_free);
            setExamDuration(String(data.prod_exam_duration_minutes ?? 60));
            setEntitlementLifetime(data.prod_entitlement_duration_months == null);
            setEntitlementDuration(data.prod_entitlement_duration_months != null ? String(data.prod_entitlement_duration_months) : "12");
            setUseScoring(data.prod_total_score != null);
            setTotalScore(data.prod_total_score != null ? formatScore(data.prod_total_score) : "100");
            setUsedScore(Number(data.used_score) || 0);
            setProdStatus(data.prod_status);
            setProdCategoryId(data.prod_category_id ?? "");
            setCommissionStaffId(data.prod_commission_staff_id ?? "");
            setCommissionType(data.prod_commission_type === "fixed" ? "fixed" : "percent");
            setCommissionValue(data.prod_commission_value != null ? String(data.prod_commission_value) : "");
            if (data.prod_cover_url) setCurrentCover(`${SERVER_BASE}${data.prod_cover_url}`);
        });
    }, [id]);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(
            prodName, prodPrice, prodComparePrice, isFree, examDuration, commissionStaffId, commissionType, commissionValue,
            entitlementLifetime, entitlementDuration,
            useScoring, totalScore, usedScore
        );
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    prod_name: prodName,
                    prod_description: prodDescription,
                    prod_price: Number(prodPrice) || 0,
                    prod_compare_price: !isFree && prodComparePrice.trim() ? Number(prodComparePrice) : null,
                    prod_is_free: isFree,
                    prod_exam_duration_minutes: Number(examDuration) || 60,
                    prod_entitlement_duration_months: entitlementLifetime ? null : Number(entitlementDuration),
                    prod_total_score: useScoring ? Number(totalScore) : null,
                    prod_status: prodStatus,
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

            if (coverFile && id) await uploadCover(id, coverFile);

            router.push("/products");
        });
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบชุดข้อสอบนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขชุดข้อสอบ</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รูปหน้าปก</label>
                    {/* key เปลี่ยนตาม currentCover เพื่อ remount ใหม่เมื่อ fetch เสร็จ — DragDropImage เก็บ preview เป็น internal state ที่ตั้งค่าแค่ตอน mount */}
                    <DragDropImage key={currentCover ?? "loading"} value={currentCover} onChange={setCoverFile} disabled={isPending} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อชุดข้อสอบ</label>
                    <Input
                        value={prodName}
                        onChange={handleNameChange}
                        className="w-full"
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

                    {!isFree && (
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาปกติ (ไม่บังคับ)</label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={prodComparePrice}
                                onChange={handleComparePriceChange}
                                className="w-full"
                                placeholder="เช่น 399 (โชว์ขีดฆ่าคู่กับราคาขายจริง สร้างความรู้สึกว่ากำลังลดราคา)"
                                error={!!errors.prod_compare_price}
                            />
                            {errors.prod_compare_price && <p className="text-xs text-red-500 mt-1">{errors.prod_compare_price}</p>}
                        </div>
                    )}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนเต็มของชุดข้อสอบ</label>
                    <label className="flex items-center gap-2 cursor-pointer w-fit mb-2">
                        <input
                            type="checkbox"
                            checked={useScoring}
                            onChange={handleUseScoringChange}
                            className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-sm text-gray-700">กำหนดคะแนนเต็ม (ให้แต่ละข้อมีน้ำหนักคะแนนต่างกันได้)</span>
                    </label>
                    {useScoring && (
                        <>
                            <Input
                                type="number" min={0} max={MAX_TOTAL_SCORE} step="0.01"
                                value={totalScore}
                                onChange={handleTotalScoreChange}
                                className="w-40"
                                placeholder="เช่น 100"
                                error={!!errors.total_score}
                            />
                            {errors.total_score && <p className="text-xs text-red-500 mt-1">{errors.total_score}</p>}
                            <p className="text-xs text-gray-500 mt-1">
                                ตอนนี้คำถามในชุดนี้ใช้คะแนนไปแล้ว <span className="font-medium text-gray-700">{formatScore(usedScore)}</span> คะแนน
                            </p>
                        </>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                        ไม่ติ๊ก = ไม่ใช้ระบบคะแนน ผลสอบคิดเป็น % จากจำนวนข้อที่ตอบถูก (พฤติกรรมเดิม) —
                        การเปลี่ยนค่านี้ไม่กระทบผลสอบที่ลูกค้าทำไปแล้ว เพราะระบบบันทึกคะแนนเต็มไว้ตั้งแต่ตอนเริ่มทำข้อสอบ
                    </p>
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

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                    <select
                        value={prodStatus}
                        onChange={(e) => setProdStatus(e.target.value as Product["prod_status"])}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20 w-full"
                    >
                        <option value="draft">แบบร่าง</option>
                        <option value="published">เผยแพร่แล้ว</option>
                        <option value="archived">เก็บเข้าคลัง</option>
                    </select>
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
