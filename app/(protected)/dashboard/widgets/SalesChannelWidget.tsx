"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import PeriodFilter, { PeriodRange } from "@/app/components/PeriodFilter";
import { Split } from "lucide-react";

type Channel = { key: "admin" | "self"; label: string; revenue: number; sale_count: number; share: number };
type ChannelData = { total_revenue: number; gateway_fee: number; channels: Channel[] };

// สีประจำช่องทาง — แอดมิน (ขายผ่านแชท) กับลูกค้าซื้อเอง ต้องแยกออกจากกันได้ทันทีทั้งในแถบสัดส่วนและรายการ
const TONE: Record<Channel["key"], { bar: string; dot: string }> = {
    admin: { bar: "bg-violet-400", dot: "bg-violet-400" },
    self: { bar: "bg-sky-400", dot: "bg-sky-400" },
};

async function fetchSalesByChannel(range: PeriodRange): Promise<ChannelData | null> {
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    const res = await fetch(`${api}/reports/sales-by-channel?${query}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function SalesChannelWidget() {
    const [isPending, startTransition] = useTransition();
    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [data, setData] = useState<ChannelData | null>(null);
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!range.from && !range.to) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchSalesByChannel(range);
            if (!isCurrent(token)) return;
            setData(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-50">
                        <Split className="w-4 h-4 text-violet-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">ยอดขายแยกตามช่องทาง</h2>
                </div>
                <PeriodFilter onChange={setRange} />
            </div>

            {isPending || !data ? (
                <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
            ) : data.total_revenue === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">ไม่มีความเคลื่อนไหวในช่วงเวลานี้</p>
            ) : (
                <>
                    {/* แถบสัดส่วนแถบเดียวต่อกัน อ่านสัดส่วนสองช่องทางได้ในพริบตาโดยไม่ต้องเทียบตัวเลขเอง */}
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-4">
                        {data.channels.map((c) => (
                            <div key={c.key} className={TONE[c.key].bar} style={{ width: `${c.share}%` }} />
                        ))}
                    </div>

                    <div className="space-y-3">
                        {data.channels.map((c) => (
                            <div key={c.key} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-sm text-gray-700">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${TONE[c.key].dot}`} />
                                    {c.label}
                                </span>
                                <span className="text-sm text-gray-500 shrink-0">
                                    <span className="font-medium text-gray-700">{formatBaht(c.revenue)}</span>
                                    <span className="text-gray-400"> · {c.share}% · {c.sale_count} ครั้ง</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* ค่าธรรมเนียม gateway เกิดเฉพาะช่องทางซื้อเองบนเว็บ (grant มือไม่ผ่าน gateway เลย)
                        โชว์ไว้เพื่อเทียบกันได้จริงว่าช่องทางเว็บเหลือเข้ากระเป๋าเท่าไรหลังหักค่าธรรมเนียม */}
                    {data.gateway_fee > 0 && (
                        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                            หักค่าธรรมเนียม payment gateway ของช่องทางซื้อเองไปแล้ว {formatBaht(data.gateway_fee)}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
