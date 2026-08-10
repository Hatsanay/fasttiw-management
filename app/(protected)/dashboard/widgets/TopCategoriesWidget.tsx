"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import PeriodFilter, { PeriodRange } from "@/app/components/PeriodFilter";
import { Tags } from "lucide-react";

type CategoryRow = { cat_id: string; cat_name: string; revenue: number; sale_count: number };

async function fetchTopCategories(range: PeriodRange): Promise<CategoryRow[]> {
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    const res = await fetch(`${api}/reports/top-categories?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: CategoryRow[] };
    return data;
}

export default function TopCategoriesWidget() {
    const [isPending, startTransition] = useTransition();
    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [data, setData] = useState<CategoryRow[] | null>(null);
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!range.from && !range.to) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchTopCategories(range);
            if (!isCurrent(token)) return;
            setData(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    const maxRevenue = data?.length ? Math.max(...data.map((c) => c.revenue)) : 0;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-50">
                        <Tags className="w-4 h-4 text-rose-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">หมวดหมู่ขายดี</h2>
                </div>
                <PeriodFilter onChange={setRange} />
            </div>

            {isPending || !data ? (
                <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
            ) : data.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">ไม่มีความเคลื่อนไหวในช่วงเวลานี้</p>
            ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                    {data.map((c) => (
                        <div key={c.cat_id}>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700">{c.cat_name}</span>
                                <span className="text-gray-500">{formatBaht(c.revenue)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-rose-400 rounded-full"
                                    style={{ width: `${maxRevenue ? (c.revenue / maxRevenue) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
