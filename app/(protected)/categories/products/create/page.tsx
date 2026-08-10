"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";

type FormErrors = { cat_name?: string };

function validate(catName: string): FormErrors {
    const errors: FormErrors = {};
    if (!catName.trim())              errors.cat_name = "กรุณากรอกชื่อหมวดหมู่";
    else if (catName.trim().length < 2) errors.cat_name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
    return errors;
}

export default function CreateProductCategoryPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [catName, setCatName] = useState("");
    const [showOnLanding, setShowOnLanding] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCatName(e.target.value);
        if (errors.cat_name) setErrors((prev) => ({ ...prev, cat_name: undefined }));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(catName);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ cat_name: catName, cat_show_on_landing: showOnLanding }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/categories/products");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างหมวดหมู่ชุดข้อสอบ</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่</label>
                    <Input
                        value={catName}
                        onChange={handleNameChange}
                        className="w-full"
                        placeholder="เช่น ข้อสอบราชการ"
                        error={!!errors.cat_name}
                    />
                    {errors.cat_name && <p className="text-xs text-red-500 mt-1">{errors.cat_name}</p>}
                </div>

                <label className="flex items-center gap-3 cursor-pointer w-fit">
                    <input
                        type="checkbox"
                        checked={showOnLanding}
                        onChange={(e) => setShowOnLanding(e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-gray-700">แสดงหมวดหมู่นี้บนหน้า landing page</span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/categories/products")}
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
