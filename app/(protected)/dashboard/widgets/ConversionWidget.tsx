"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import PeriodFilter, { PeriodRange } from "@/app/components/PeriodFilter";
import { Repeat } from "lucide-react";

type ConversionData = { free_claimer_count: number; converted_count: number; conversion_rate: number };

async function fetchConversion(range: PeriodRange): Promise<ConversionData | null> {
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    const res = await fetch(`${api}/reports/free-to-paid-conversion?${query}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function ConversionWidget() {
    const [isPending, startTransition] = useTransition();
    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [data, setData] = useState<ConversionData | null>(null);
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!range.from && !range.to) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchConversion(range);
            if (!isCurrent(token)) return;
            setData(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50">
                        <Repeat className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">อัตราแปลงฟรี → ซื้อจริง</h2>
                </div>
                <PeriodFilter onChange={setRange} />
            </div>
            <p className="text-xs text-gray-400 mb-4">
                ในกลุ่มคนที่ใช้สิทธิ์ฟรีอย่างน้อย 1 ครั้งภายในช่วงเวลาที่เลือก มีกี่ % ที่มีการซื้อแบบจ่ายเงินจริงด้วย (นับการซื้อตลอดเวลา ไม่จำกัดว่าก่อน/หลัง)
            </p>

            {isPending || !data ? (
                <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
            ) : data.free_claimer_count === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">ไม่มีคนใช้สิทธิ์ฟรีในช่วงเวลานี้</p>
            ) : (
                <div className="flex items-center gap-8 pt-1">
                    <div>
                        <p className="text-3xl font-bold text-emerald-600">{data.conversion_rate.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400 mt-1">อัตราแปลง</p>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                        <p>ใช้สิทธิ์ฟรี <span className="font-semibold text-gray-800">{data.free_claimer_count}</span> คน</p>
                        <p>กลับมาซื้อจริง <span className="font-semibold text-gray-800">{data.converted_count}</span> คน</p>
                    </div>
                </div>
            )}
        </div>
    );
}
