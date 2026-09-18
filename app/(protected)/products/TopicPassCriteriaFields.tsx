"use client";

import { EMPTY_PASS_CRITERION, validatePassCriterionInput, type PassCriterionInput as Criterion } from "@/app/lib/scoring";
import { PassCriterionInput } from "./PassCriterionField";

export type TopicPassTopic = { tpc_id: string; tpc_name: string; question_count: number };

// เกณฑ์ผ่านรายวิชา (2026-09-16) — ใช้ที่หน้าแก้ไขชุดข้อสอบเท่านั้น (ชุดใหม่ยังไม่มีคำถาม จึงยังไม่มีวิชาให้ตั้ง)
// รายชื่อวิชา = หัวข้อของคำถามในชุด backend ดึงมาให้ (listTopicPassCriteria ใน product.controller.js)
// แต่ละวิชาเลือกได้ว่าเป็น % หรือขั้นต่ำ · เว้นว่าง = วิชานั้นไม่มีเกณฑ์ · หน้าผลสอบบอก "ผ่าน" ก็ต่อเมื่อผ่านครบทุกเกณฑ์ที่ตั้ง
export default function TopicPassCriteriaFields({
    topics,
    values,
    onChange,
    unitLabel,
    scored,
    error,
}: {
    topics: TopicPassTopic[];
    values: Record<string, Criterion>;
    onChange: (tpcId: string, next: Criterion) => void;
    unitLabel: string;
    scored: boolean;
    error?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ผ่านรายวิชา — ไม่บังคับ</label>
            <p className="text-xs text-gray-400 mb-2">
                สำหรับสนามสอบที่ต้องผ่านทุกวิชา — หน้าผลสอบจะบอกผลแยกรายวิชา และขึ้นว่า &quot;ผ่าน&quot; ก็ต่อเมื่อผ่านครบทุกวิชาที่ตั้งเกณฑ์ไว้
                · วิชามาจากหัวข้อของคำถามในชุดนี้ · กำหนดเป็น % หรือ{unitLabel}ขั้นต่ำก็ได้ · เว้นว่าง = วิชานั้นไม่มีเกณฑ์
            </p>

            {topics.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                    ชุดนี้ยังไม่มีคำถาม — เพิ่มคำถามพร้อมหัวข้อก่อน แล้วกลับมาตั้งเกณฑ์รายวิชาได้ที่หน้านี้
                </p>
            ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {topics.map((t) => {
                        const criterion = values[t.tpc_id] ?? EMPTY_PASS_CRITERION;
                        return (
                            <div key={t.tpc_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
                                <div className="min-w-0 flex-1 basis-40">
                                    <p className="text-sm text-gray-800">{t.tpc_name}</p>
                                    <p className={t.question_count > 0 ? "text-xs text-gray-400" : "text-xs text-amber-600"}>
                                        {t.question_count > 0 ? `มี ${t.question_count} ข้อ` : "ไม่มีคำถามในวิชานี้แล้ว — ลบเกณฑ์ออกได้"}
                                    </p>
                                </div>
                                <PassCriterionInput
                                    criterion={criterion}
                                    onChange={(next) => onChange(t.tpc_id, next)}
                                    unitLabel={unitLabel}
                                    invalid={!!validatePassCriterionInput(criterion, scored)}
                                    ariaLabel={`เกณฑ์ผ่านวิชา ${t.tpc_name}`}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
}
