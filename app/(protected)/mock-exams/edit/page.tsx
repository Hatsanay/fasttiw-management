"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import MockExamForm, { mockExamFromApi, type MockExamFormValue } from "../MockExamForm";

export default function EditMockExamPage() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const [initial, setInitial] = useState<MockExamFormValue | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return; // ไม่มี id = ไม่ต้องโหลดอะไร (เช็คตอน render ข้างล่างแทนการ setState ใน effect)
        (async () => {
            const res = await fetch(`${api}/mock-exams/${id}`, { headers: authHeader() });
            if (!res.ok) { setNotFound(true); return; }
            setInitial(mockExamFromApi(await res.json()));
        })();
    }, [id]);

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบสนามสอบนี้</p>;
    if (!initial) return <p className="p-6 text-gray-400 text-sm">กำลังโหลด...</p>;

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">แก้ไขสนามสอบเสมือน</h1>
            {/* key = id เพื่อ remount ถ้าเปลี่ยนสนามสอบผ่าน URL ตรงๆ (ฟอร์มเก็บค่าเป็น state ตอน mount) */}
            <MockExamForm key={id!} examId={id!} initial={initial} />
        </div>
    );
}
