"use client";

import Input from "@/components/ui/Input/input";
import { validatePassPercentInput } from "@/app/lib/scoring";

export type TopicPassTopic = { tpc_id: string; tpc_name: string; question_count: number };

// เกณฑ์ผ่านรายวิชา (2026-09-16) — ใช้ที่หน้าแก้ไขชุดข้อสอบเท่านั้น (ชุดใหม่ยังไม่มีคำถาม จึงยังไม่มีวิชาให้ตั้ง)
// รายชื่อวิชา = หัวข้อของคำถามในชุด backend ดึงมาให้ (listTopicPassPercents ใน product.controller.js)
// เว้นว่าง = วิชานั้นไม่มีเกณฑ์ · หน้าผลสอบบอก "ผ่าน" ก็ต่อเมื่อผ่านครบทุกเกณฑ์ที่ตั้ง
export default function TopicPassPercentFields({
    topics,
    values,
    onChange,
    error,
}: {
    topics: TopicPassTopic[];
    values: Record<string, string>;
    onChange: (tpcId: string, value: string) => void;
    error?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ผ่านรายวิชา (%) — ไม่บังคับ</label>
            <p className="text-xs text-gray-400 mb-2">
                สำหรับสนามสอบที่ต้องผ่านทุกวิชา — หน้าผลสอบจะบอกผลแยกรายวิชา และขึ้นว่า &quot;ผ่าน&quot; ก็ต่อเมื่อผ่านครบทุกวิชาที่ตั้งเกณฑ์ไว้
                · วิชามาจากหัวข้อของคำถามในชุดนี้ · เว้นว่าง = วิชานั้นไม่มีเกณฑ์
            </p>

            {topics.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                    ชุดนี้ยังไม่มีคำถาม — เพิ่มคำถามพร้อมหัวข้อก่อน แล้วกลับมาตั้งเกณฑ์รายวิชาได้ที่หน้านี้
                </p>
            ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {topics.map((t) => {
                        const value = values[t.tpc_id] ?? "";
                        const invalid = !!validatePassPercentInput(value);
                        return (
                            <div key={t.tpc_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-800 truncate">{t.tpc_name}</p>
                                    <p className={t.question_count > 0 ? "text-xs text-gray-400" : "text-xs text-amber-600"}>
                                        {t.question_count > 0 ? `${t.question_count} ข้อ` : "ไม่มีคำถามในวิชานี้แล้ว — ลบเกณฑ์ออกได้"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Input
                                        type="number" min={1} max={100} step="1"
                                        value={value}
                                        onChange={(e) => onChange(t.tpc_id, e.target.value)}
                                        className="w-24"
                                        placeholder="—"
                                        aria-label={`เกณฑ์ผ่านวิชา ${t.tpc_name}`}
                                        error={invalid}
                                    />
                                    <span className="text-sm text-gray-500">%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
}
