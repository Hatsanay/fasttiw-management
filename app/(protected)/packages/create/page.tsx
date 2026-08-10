"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht, effectivePrice } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import Form from "@/components/ui/form/Form";
import ProductPicker, { PickerProduct } from "@/components/ui/ProductPicker";
import DragDropImage from "@/components/ui/DragDropImage";

async function submitCreatePackage(body: Record<string, unknown>) {
    const res = await fetch(`${api}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

async function uploadCover(packageId: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    await fetch(`${api}/packages/${packageId}/image`, {
        method: "PUT",
        headers: authHeader(),
        body: fd,
    });
}

type FormErrors = { name?: string; products?: string; price?: string };

function validate(name: string, selectedCount: number, price: string): FormErrors {
    const errors: FormErrors = {};

    if (!name.trim())              errors.name = "กรุณากรอกชื่อแพ็กเกจ";
    else if (name.trim().length < 2) errors.name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";

    if (selectedCount < 2) errors.products = "แพ็กเกจต้องมีอย่างน้อย 2 ชุดข้อสอบ";

    if (!price.trim()) {
        errors.price = "กรุณากรอกราคาแพ็กเกจ";
    } else {
        const n = Number(price);
        if (!Number.isFinite(n) || n <= 0) errors.price = "ราคาแพ็กเกจต้องมากกว่า 0";
    }

    return errors;
}

export default function CreatePackagePage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [selected, setSelected] = useState<Map<string, PickerProduct>>(new Map());
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);

    const individualTotal = [...selected.values()].reduce((sum, p) => sum + effectivePrice(p), 0);
    const priceNumber = Number(price);
    const savings = individualTotal - priceNumber;

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setName(e.target.value);
        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
    }

    function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        setPrice(e.target.value);
        if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
    }

    function handleProductsChange(next: Map<string, PickerProduct>) {
        setSelected(next);
        if (errors.products) setErrors((prev) => ({ ...prev, products: undefined }));
    }

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(name, selected.size, price);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            try {
                const { pkg_id } = await submitCreatePackage({
                    pkg_name: name,
                    pkg_description: description || null,
                    pkg_price: priceNumber,
                    product_ids: [...selected.keys()],
                });
                if (coverFile) await uploadCover(pkg_id, coverFile);
                router.push("/packages");
            } catch (err) {
                setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            }
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างแพ็กเกจรวมชุด</h1>

            <Form cols={1} onSubmit={handleSubmit} className="bg-white shadow-sm border-gray-100 rounded-xl">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">รูปหน้าปก</label>
                    <DragDropImage onChange={setCoverFile} disabled={isPending} />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">ชื่อแพ็กเกจ</label>
                    <Input value={name} onChange={handleNameChange} placeholder="เช่น รวมแนวข้อสอบ ก.พ. ทุกภาค" error={!!errors.name} />
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">คำอธิบาย (ไม่บังคับ)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">เลือกชุดข้อสอบ (อย่างน้อย 2 ชุด)</label>
                    <ProductPicker selected={selected} onChange={handleProductsChange} />
                    {errors.products && <p className="text-xs text-red-500">{errors.products}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">ราคาแพ็กเกจ (บาท)</label>
                    <Input type="number" min={0} step="0.01" value={price} onChange={handlePriceChange} error={!!errors.price} />
                    {errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
                    {selected.size > 0 && (
                        <p className="text-xs text-gray-400">
                            ราคารวมแยกซื้อ {formatBaht(individualTotal)}
                            {Number.isFinite(priceNumber) && priceNumber > 0 && savings > 0 && (
                                <span className="text-green-600"> — ลูกค้าประหยัด {formatBaht(savings)}</span>
                            )}
                        </p>
                    )}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/packages")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
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
