"use client";

import Input from "@/components/ui/Input/input";
import type { PassCriterionInput as Criterion, PassMode } from "@/app/lib/scoring";

// ช่องกรอกเกณฑ์ผ่าน 1 เกณฑ์: เลือกแบบ (% / ขั้นต่ำ) + ตัวเลข — ใช้ทั้งเกณฑ์รวมและทุกแถวของเกณฑ์รายวิชา
// หน่วยของขั้นต่ำ = "ข้อ" หรือ "คะแนน" ตามว่าชุดใช้ระบบคะแนนไหม (unitLabel)
export function PassCriterionInput({
    criterion,
    onChange,
    unitLabel,
    invalid,
    ariaLabel,
}: {
    criterion: Criterion;
    onChange: (next: Criterion) => void;
    unitLabel: string;
    invalid?: boolean;
    ariaLabel: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <select
                value={criterion.mode}
                onChange={(e) => onChange({ mode: e.target.value as PassMode, value: "" })}
                aria-label={`${ariaLabel} — แบบของเกณฑ์`}
                className="px-2 py-2 border rounded text-sm focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
            >
                <option value="percent">%</option>
                <option value="min">ขั้นต่ำ ({unitLabel})</option>
            </select>
            <Input
                type="number"
                min={criterion.mode === "percent" ? 1 : 0}
                max={criterion.mode === "percent" ? 100 : undefined}
                step={criterion.mode === "min" && unitLabel === "คะแนน" ? "0.01" : "1"}
                value={criterion.value}
                onChange={(e) => onChange({ ...criterion, value: e.target.value })}
                className="w-24"
                placeholder="—"
                aria-label={ariaLabel}
                error={invalid}
            />
            <span className="w-10 text-sm text-gray-500">{criterion.mode === "percent" ? "%" : unitLabel}</span>
        </div>
    );
}

// เกณฑ์ผ่านรวมทั้งชุด — ใช้ร่วมกันทั้งหน้าสร้างและแก้ชุดข้อสอบ (2026-09-15, เพิ่มแบบขั้นต่ำ 2026-09-16)
// ไม่บังคับ: เว้นว่าง = ไม่ตั้งเกณฑ์ หน้าผลสอบลูกค้าไม่แสดงผ่าน/ไม่ผ่าน (พฤติกรรมเดิม)
// ตรวจค่าด้วย validatePassCriterionInput() ใน app/lib/scoring.ts
export default function PassCriterionField({
    criterion,
    onChange,
    unitLabel,
    outOfHint,
    error,
}: {
    criterion: Criterion;
    onChange: (next: Criterion) => void;
    unitLabel: string;
    outOfHint?: string;
    error?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ผ่านรวมทั้งชุด — ไม่บังคับ</label>
            <PassCriterionInput criterion={criterion} onChange={onChange} unitLabel={unitLabel} invalid={!!error} ariaLabel="เกณฑ์ผ่านรวมทั้งชุด" />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            {criterion.mode === "min" && outOfHint && <p className="text-xs text-gray-500 mt-1">{outOfHint}</p>}
            <p className="text-xs text-gray-400 mt-1">
                ตั้งไว้แล้วหน้าผลสอบของลูกค้าจะบอกว่า &quot;ผ่านเกณฑ์&quot; หรือ &quot;ยังไม่ผ่าน — ขาดอีกกี่{unitLabel}&quot;
                · กำหนดเป็น % หรือ{unitLabel}ขั้นต่ำก็ได้ (สนามสอบที่ประกาศเป็นจำนวนข้อ ให้ใส่แบบขั้นต่ำตรงๆ ไม่ต้องแปลงเป็น %)
                · เว้นว่าง = ไม่แสดงผ่าน/ไม่ผ่าน
                · <span className="text-gray-500">สนามสอบที่ต้องผ่านทุกวิชา ให้ใช้เกณฑ์รายวิชาแทน (ตั้งได้ที่หน้าแก้ไขชุดข้อสอบ หลังชุดมีคำถามแล้ว)</span>
            </p>
        </div>
    );
}
