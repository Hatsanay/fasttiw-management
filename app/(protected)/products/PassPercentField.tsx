"use client";

import Input from "@/components/ui/Input/input";

// ช่อง "เกณฑ์ผ่าน (%)" — ใช้ร่วมกันทั้งหน้าสร้างและแก้ชุดข้อสอบ (2026-09-15)
// ไม่บังคับ: เว้นว่าง = ไม่ตั้งเกณฑ์ หน้าผลสอบลูกค้าไม่แสดงผ่าน/ไม่ผ่าน (พฤติกรรมเดิม)
// ตรวจค่าด้วย validatePassPercentInput() ใน app/lib/scoring.ts
export default function PassPercentField({
    value,
    onChange,
    error,
}: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ผ่านรวมทั้งชุด (%) — ไม่บังคับ</label>
            <div className="flex items-center gap-2">
                <Input
                    type="number" min={1} max={100} step="1"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-40"
                    placeholder="เช่น 60"
                    error={!!error}
                />
                <span className="text-sm text-gray-500">%</span>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <p className="text-xs text-gray-400 mt-1">
                ตั้งไว้แล้วหน้าผลสอบของลูกค้าจะบอกว่า &quot;ผ่านเกณฑ์&quot; หรือ &quot;ยังไม่ผ่าน — ขาดอีกกี่ข้อ&quot; (ชุดที่ใช้ระบบคะแนนเทียบเป็นคะแนน)
                · เว้นว่าง = ไม่แสดงผ่าน/ไม่ผ่าน · ควรใส่ตามเกณฑ์จริงของสนามสอบที่ชุดนี้เตรียมให้
                · <span className="text-gray-500">สนามสอบที่ต้องผ่านทุกวิชา ให้ใช้เกณฑ์รายวิชาแทน (ตั้งได้ที่หน้าแก้ไขชุดข้อสอบ หลังชุดมีคำถามแล้ว)</span>
            </p>
        </div>
    );
}
