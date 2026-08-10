"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import PeriodFilter, { PeriodRange } from "@/app/components/PeriodFilter";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { loadCategoryOptions } from "@/app/lib/categoryOptions";
import { LucideIcon } from "lucide-react";

type RankingRow = { prod_id: string; prod_name: string; claim_count: number; revenue: number };
type RankingResponse = { total_count: number; total_revenue: number; ranking: RankingRow[] };

async function fetchProductRanking(isFree: boolean, range: PeriodRange, categoryId: string): Promise<RankingResponse | null> {
    const query = new URLSearchParams({ is_free: String(isFree) });
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    if (categoryId) query.set("category_id", categoryId);
    const res = await fetch(`${api}/reports/product-ranking?${query}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

type Props = {
    isFree: boolean;
    title: string;
    icon: LucideIcon;
    iconColor: string;
    iconTone: string;
    countLabel: string;
    revenueLabel: string;
};

// ใช้ endpoint /reports/product-ranking ตัวเดียวกันทั้ง widget "คนใช้ฟรี" (isFree=true) และ "คนซื้อจ่ายเงิน"
// (isFree=false) ตรงกับที่ backend ออกแบบให้ใช้ query param เดียวรองรับทั้งคู่ — จึง extract เป็น component
// เดียวรับ prop isFree แทนที่จะเขียนซ้ำ 2 ที่
export default function ProductRankingWidget({ isFree, title, icon: Icon, iconColor, iconTone, countLabel, revenueLabel }: Props) {
    const [isPending, startTransition] = useTransition();
    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [categoryId, setCategoryId] = useState("");
    const [data, setData] = useState<RankingResponse | null>(null);
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!range.from && !range.to) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchProductRanking(isFree, range, categoryId);
            if (!isCurrent(token)) return;
            setData(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, categoryId]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SearchableSelect
                        loadOptions={loadCategoryOptions}
                        value={categoryId}
                        onChange={setCategoryId}
                        placeholder="ทุกหมวดหมู่"
                        className="w-40"
                    />
                    <PeriodFilter onChange={setRange} />
                </div>
            </div>

            {isPending || !data ? (
                <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
            ) : (
                <>
                    <div className="flex items-center gap-5 mb-4 pb-4 border-b border-gray-50">
                        <div>
                            <p className="text-xs text-gray-400">{countLabel}</p>
                            <p className="text-lg font-bold text-gray-800">{data.total_count}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-100" />
                        <div>
                            <p className="text-xs text-gray-400">{revenueLabel}</p>
                            <p className="text-lg font-bold text-gray-800">{formatBaht(data.total_revenue)}</p>
                        </div>
                    </div>

                    {data.ranking.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">ไม่มีความเคลื่อนไหวในช่วงเวลานี้</p>
                    ) : (
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-400 sticky top-0 bg-white">
                                        <th className="text-left font-medium py-1.5 pr-2">ชุดข้อสอบ</th>
                                        <th className="text-right font-medium py-1.5 px-2">จำนวน</th>
                                        <th className="text-right font-medium py-1.5 pl-2">ยอดขาย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ranking.map((r) => (
                                        <tr key={r.prod_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                                            <td className="py-1.5 pr-2 text-gray-700">{r.prod_name}</td>
                                            <td className="py-1.5 px-2 text-right text-gray-600">{r.claim_count}</td>
                                            <td className="py-1.5 pl-2 text-right text-gray-600">{formatBaht(r.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
