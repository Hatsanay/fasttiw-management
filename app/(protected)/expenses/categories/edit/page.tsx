"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";

type ExpenseCategory = {
    excat_id: string;
    excat_name: string;
    excat_status: "active" | "inactive";
};

async function fetchCategoryById(id: string): Promise<ExpenseCategory | null> {
    const res = await fetch(`${api}/expense-categories/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

type FormErrors = { name?: string };

function validate(name: string): FormErrors {
    const errors: FormErrors = {};
    if (!name.trim())              errors.name = "กรุณากรอกชื่อหมวดหมู่";
    else if (name.trim().length < 2) errors.name = "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
    return errors;
}

export default function EditExpenseCategoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id");

    const [name, setName] = useState("");
    const [status, setStatus] = useState<"active" | "inactive">("active");
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        setName(e.target.value);
        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
    }

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchCategoryById(id);
            if (!data) { setNotFound(true); return; }
            setName(data.excat_name);
            setStatus(data.excat_status);
        });
    }, [id]);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(name);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/expense-categories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ excat_name: name, excat_status: status }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            router.push("/expenses/categories");
        });
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบหมวดหมู่นี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขหมวดหมู่ค่าใช้จ่าย</h1>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่</label>
                    <Input
                        value={name}
                        onChange={handleNameChange}
                        className="w-full"
                        error={!!errors.name}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะการใช้งาน</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value === "inactive" ? "inactive" : "active")}
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
                        onClick={() => router.push("/expenses/categories")}
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
