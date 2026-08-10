"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import SearchInput from "@/components/ui/SearchInput";

export type PickerProduct = { prod_id: string; prod_name: string; prod_price: number; prod_is_free: boolean; prod_cover_url: string | null };

const PAGE_SIZE = 8;
const SERVER_BASE = new URL(api).origin;

async function fetchPublishedProducts(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit), offset: String(params.offset),
        search: params.search, status: "published",
    });
    const res = await fetch(`${api}/products?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as PickerProduct[], total: 0 };
    return res.json() as Promise<{ data: PickerProduct[]; total: number }>;
}

type Props = {
    selected: Map<string, PickerProduct>;
    onChange: (next: Map<string, PickerProduct>) => void;
};

// เลือกชุดข้อสอบได้หลายชุด (ค้นหา+เพจ) — พอร์ตมาจากแพทเทิร์นเดียวกับ GrantProductsModal แต่ตัดส่วน
// คูปอง/ระยะเวลาออก เพราะแพ็กเกจไม่มีสองอย่างนั้น ใช้ร่วมกันได้ทั้งหน้าสร้าง/แก้ไขแพ็กเกจ
export default function ProductPicker({ selected, onChange }: Props) {
    const [products, setProducts] = useState<PickerProduct[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้องตั้ง loading ก่อน fetch async เริ่ม
        setLoading(true);
        fetchPublishedProducts({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, search })
            .then((result) => { setProducts(result.data); setTotal(result.total); })
            .finally(() => setLoading(false));
    }, [page, search]);

    function toggle(p: PickerProduct) {
        const next = new Map(selected);
        if (next.has(p.prod_id)) next.delete(p.prod_id); else next.set(p.prod_id, p);
        onChange(next);
    }

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="flex flex-col gap-2">
            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาชุดข้อสอบ..." className="w-full" />

            <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                {loading ? (
                    <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
                ) : products.length === 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">ไม่พบชุดข้อสอบที่เผยแพร่แล้ว</p>
                ) : (
                    <div className="p-1 space-y-0.5">
                        {products.map((p) => {
                            const isSelected = selected.has(p.prod_id);
                            return (
                                <button
                                    key={p.prod_id}
                                    type="button"
                                    onClick={() => toggle(p)}
                                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                                        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                    }`}
                                >
                                    <div className="relative w-9 h-9 rounded-md overflow-hidden bg-gray-100 shrink-0">
                                        <Image
                                            src={p.prod_cover_url ? `${SERVER_BASE}${p.prod_cover_url}` : "/defult.png"}
                                            alt="" fill unoptimized={!!p.prod_cover_url} className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{p.prod_name}</p>
                                        <p className="text-xs text-gray-400">{p.prod_is_free ? <span className="text-green-600 font-medium">ฟรี</span> : formatBaht(p.prod_price)}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-500" : "bg-gray-100"}`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {selected.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {[...selected.values()].map((p) => (
                        <span key={p.prod_id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                            {p.prod_name}
                            <button type="button" onClick={() => toggle(p)} className="hover:text-blue-900">×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
