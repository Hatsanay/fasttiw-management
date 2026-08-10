"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import NewsComposer, { type ExistingBlock } from "./NewsComposer";

async function fetchFeed(): Promise<ExistingBlock[]> {
    const res = await fetch(`${api}/news`, { headers: authHeader() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.blocks ?? [];
}

// ไม่มีหน้า list/create/edit แยกอีกต่อไป — เข้าเมนู "ข่าวสาร" แล้วเจอ canvas ลาก-วางตรงๆ เหมือนแก้ landing
// page หนึ่งหน้า (ไม่มีแนวคิด "โพสต์" ให้เลือกก่อนว่าจะแก้อันไหน)
export default function NewsPage() {
    const [blocks, setBlocks] = useState<ExistingBlock[] | null>(null);

    useEffect(() => {
        fetchFeed().then(setBlocks);
    }, []);

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">ข่าวสาร</h1>
            <p className="text-sm text-gray-500 mb-6">ลาก widget จากด้านซ้ายมาจัดเรียงฟีด แล้วกดบันทึกการเปลี่ยนแปลง</p>
            {blocks === null ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : (
                <NewsComposer initialBlocks={blocks} />
            )}
        </div>
    );
}
