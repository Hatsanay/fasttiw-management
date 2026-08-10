"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadCategoryOptions } from "@/app/lib/categoryOptions";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";

type Topic = {
    tpc_id: string;
    tpc_name: string;
    tpc_category_id: string | null;
    tpc_status: "active" | "inactive";
};

async function fetchTopicById(id: string): Promise<Topic | null> {
    const res = await fetch(`${api}/topics/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

type FormErrors = { tpc_name?: string };

function validate(tpcName: string): FormErrors {
    const errors: FormErrors = {};
    if (!tpcName.trim())              errors.tpc_name = "กรุณากรอกชื่อหมวดหมู่คำถาม";
    else if (tpcName.trim().length < 2) errors.tpc_name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
    return errors;
}

export default function EditTopicPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [tpcName, setTpcName] = useState("");
    const [tpcStatus, setTpcStatus] = useState<"active" | "inactive">("active");
    const [tpcCategoryId, setTpcCategoryId] = useState("");
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTpcName(e.target.value);
        if (errors.tpc_name) setErrors((prev) => ({ ...prev, tpc_name: undefined }));
    }

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchTopicById(id);
            if (!data) { setNotFound(true); return; }
            setTpcName(data.tpc_name);
            setTpcStatus(data.tpc_status);
            setTpcCategoryId(data.tpc_category_id ?? "");
        });
    }, [id]);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(tpcName);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/topics/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ tpc_name: tpcName, tpc_status: tpcStatus, tpc_category_id: tpcCategoryId || null }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/categories/topics");
        });
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบหมวดหมู่คำถามนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขหมวดหมู่คำถาม</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่คำถาม</label>
                    <Input
                        value={tpcName}
                        onChange={handleNameChange}
                        className="w-full"
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
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะการใช้งาน</label>
                    <select
                        value={tpcStatus}
                        onChange={(e) => setTpcStatus(e.target.value === "inactive" ? "inactive" : "active")}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20 w-full"
                    >
                        <option value="active">ใช้งาน</option>
                        <option value="inactive">ยกเลิกใช้งาน</option>
                    </select>
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
