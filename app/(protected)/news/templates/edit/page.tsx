"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import TemplateDesigner, { type ExistingTemplate } from "../TemplateDesigner";

async function fetchTemplateById(id: string): Promise<ExistingTemplate | null> {
    const res = await fetch(`${api}/news/templates/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function EditTemplatePage() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id") ?? "";

    const [template, setTemplate] = useState<ExistingTemplate | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้อง reset ให้เสร็จก่อน fetch async เริ่ม กันข้อมูล/สถานะของ widget ก่อนหน้าค้างโชว์
        setNotFound(false);
        setTemplate(null);
        fetchTemplateById(id).then((data) => {
            if (!data) { setNotFound(true); return; }
            setTemplate(data);
        });
    }, [id]);

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบ widget นี้</p>;
    if (!template) return <p className="p-6 text-gray-500">กำลังโหลด...</p>;

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">แก้ไข widget</h1>
            <p className="text-sm text-gray-500 mb-6">แก้ไข widget นี้จะไม่กระทบจุดที่เคยลากไปใช้ในฟีดแล้ว (แยกเป็นอิสระตั้งแต่ตอนลากเข้าฟีด)</p>
            <TemplateDesigner mode="edit" initialTemplate={template} />
        </div>
    );
}
