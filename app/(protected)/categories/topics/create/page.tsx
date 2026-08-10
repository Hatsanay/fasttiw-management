"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadCategoryOptions } from "@/app/lib/categoryOptions";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";

type FormErrors = { tpc_name?: string };

function validate(tpcName: string): FormErrors {
    const errors: FormErrors = {};
    if (!tpcName.trim())              errors.tpc_name = "กรุณากรอกชื่อหมวดหมู่คำถาม";
    else if (tpcName.trim().length < 2) errors.tpc_name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
    return errors;
}

export default function CreateTopicPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [tpcName, setTpcName] = useState("");
    const [tpcCategoryId, setTpcCategoryId] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTpcName(e.target.value);
        if (errors.tpc_name) setErrors((prev) => ({ ...prev, tpc_name: undefined }));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(tpcName);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/topics`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ tpc_name: tpcName, tpc_category_id: tpcCategoryId || null }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/categories/topics");
        });
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างหมวดหมู่คำถาม</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่คำถาม</label>
                    <Input
                        value={tpcName}
                        onChange={handleNameChange}
                        className="w-full"
                        placeholder="เช่น อนุกรม, อุปมาอุปไมย"
                        error={!!errors.tpc_name}
                    />
                    {errors.tpc_name && <p className="text-xs text-red-500 mt-1">{errors.tpc_name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ชุดข้อสอบ</label>
                    <SearchableSelect
                        loadOptions={loadCategoryOptions}
                        value={tpcCategoryId}
                        onChange={setTpcCategoryId}
                        placeholder="— เลือกหมวดหมู่ (ไม่บังคับ) —"
                        disabled={isPending}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        ผูกหมวดหมู่คำถามนี้กับหมวดหมู่ชุดข้อสอบ เพื่อไม่ให้หัวข้อคนละโดเมนปนกัน
                    </p>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/categories/topics")}
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
