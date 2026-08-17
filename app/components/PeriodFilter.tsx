"use client";

import { useEffect, useState } from "react";
import { toDateInput } from "@/app/lib/date";

export type PeriodRange = { from: string; to: string };
export type PeriodPreset = "today" | "this_month" | "last_month" | "this_year" | "custom";

// ช่วงวันที่ตามปุ่มลัด — คำนวณจากเวลาเครื่อง client ตอนกดปุ่ม เหมือน reports/page.tsx (พอสำหรับ
// รายงานสรุป ไม่ต้องเป๊ะระดับ timezone) แยกออกมาเป็น component กลางเพราะ widget แดชบอร์ดใหม่หลายตัว
// ต้องมีตัวกรองวัน/เดือน/ปีแบบเดียวกันแยกอิสระต่อ widget
function presetRange(preset: PeriodPreset): PeriodRange {
    const now = new Date();
    if (preset === "today") {
        return { from: toDateInput(now), to: toDateInput(now) };
    }
    if (preset === "this_month") {
        return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
    }
    if (preset === "last_month") {
        return {
            from: toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            to: toDateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
    }
    if (preset === "this_year") {
        return { from: toDateInput(new Date(now.getFullYear(), 0, 1)), to: toDateInput(now) };
    }
    return { from: "", to: "" };
}

const PRESET_OPTIONS: { value: PeriodPreset; label: string }[] = [
    { value: "today", label: "วันนี้" },
    { value: "this_month", label: "เดือนนี้" },
    { value: "last_month", label: "เดือนที่แล้ว" },
    { value: "this_year", label: "ปีนี้" },
    { value: "custom", label: "กำหนดเอง" },
];

type Props = {
    onChange: (range: PeriodRange) => void;
    defaultPreset?: PeriodPreset;
    className?: string;
};

export default function PeriodFilter({ onChange, defaultPreset = "this_month", className = "" }: Props) {
    const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
    // lazy initializer แทนการ setState ในเอฟเฟกต์ตอน mount (กัน cascading render) — ยังต้องยิง
    // onChange(range) ครั้งแรกผ่านเอฟเฟกต์อยู่ดี เพราะ parent (widget) ต้องรู้ range เริ่มต้นเพื่อ fetch ข้อมูล
    const [range, setRange] = useState<PeriodRange>(() => presetRange(defaultPreset));

    useEffect(() => {
        onChange(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handlePresetChange(value: PeriodPreset) {
        setPreset(value);
        if (value !== "custom") {
            const next = presetRange(value);
            setRange(next);
            onChange(next);
        }
    }

    function handleCustomChange(nextFrom: string, nextTo: string) {
        setRange({ from: nextFrom, to: nextTo });
        if (nextFrom && nextTo) onChange({ from: nextFrom, to: nextTo });
    }

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_OPTIONS.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => handlePresetChange(o.value)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                            preset === o.value ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>

            {preset === "custom" && (
                <div className="flex items-center gap-1.5">
                    <input
                        type="date"
                        value={range.from}
                        onChange={(e) => handleCustomChange(e.target.value, range.to)}
                        className="px-2.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <span className="text-xs text-gray-400">ถึง</span>
                    <input
                        type="date"
                        value={range.to}
                        onChange={(e) => handleCustomChange(range.from, e.target.value)}
                        className="px-2.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                </div>
            )}
        </div>
    );
}
