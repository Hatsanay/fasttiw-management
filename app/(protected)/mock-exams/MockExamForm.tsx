"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadCategoryOptions, loadTopicOptions } from "@/app/lib/categoryOptions";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import { PassCriterionInput } from "../products/PassCriterionField";
import {
    EMPTY_PASS_CRITERION, passCriterionPayload, passCriterionFromApi, validatePassCriterionInput,
    type PassCriterionInput as Criterion,
} from "@/app/lib/scoring";
import { toast } from "sonner";

// ฟอร์มสนามสอบเสมือนจริง — ใช้ร่วมกันทั้งหน้าสร้างและหน้าแก้ไข (2026-09-18)
// โครงสร้าง = วิชา (หัวข้อคำถาม) + จำนวนข้อที่สุ่มจากวิชานั้น + เกณฑ์ผ่านของวิชานั้น
// เกณฑ์ใช้ตัวเดียวกับชุดข้อสอบ (PassCriterionInput) — สนามสอบนับเป็น "ข้อ" เสมอ ไม่มีระบบคะแนนรายข้อ
export type MockSection = {
    tpc_id: string;
    tpc_name: string;
    // หัวข้อชื่อซ้ำกันได้ข้ามหมวด ("วิชาภาษาอังกฤษ" มีได้ทุกหมวด) — ต้องกำกับหมวดไว้เสมอ ไม่งั้นแยกไม่ออก
    tpc_category_name?: string | null;
    question_count: string;
    criterion: Criterion;
    // จำนวนข้อที่มีจริงในคลัง (ทุกชุดที่เผยแพร่) — backend ส่งมาให้ตอนแก้ไข ใช้เตือนว่าโควตาเกินของที่มี
    available?: number;
};
export type MockExamFormValue = {
    me_name: string;
    me_description: string;
    me_category_id: string;
    me_time_limit_minutes: string;
    me_status: "draft" | "published" | "archived";
    criterion: Criterion;
    sections: MockSection[];
};

export const EMPTY_MOCK_EXAM: MockExamFormValue = {
    me_name: "",
    me_description: "",
    me_category_id: "",
    me_time_limit_minutes: "180",
    me_status: "draft",
    criterion: EMPTY_PASS_CRITERION,
    sections: [],
};

export function mockExamFromApi(data: {
    me_name: string; me_description: string | null; me_category_id: string | null;
    me_time_limit_minutes: number; me_status: MockExamFormValue["me_status"];
    me_pass_percent: number | null; me_pass_min: number | null;
    sections: { tpc_id: string; tpc_name: string; tpc_category_name: string | null; question_count: number; pass_percent: number | null; pass_min: number | null; available: number }[];
}): MockExamFormValue {
    return {
        me_name: data.me_name,
        me_description: data.me_description ?? "",
        me_category_id: data.me_category_id ?? "",
        me_time_limit_minutes: String(data.me_time_limit_minutes),
        me_status: data.me_status,
        criterion: passCriterionFromApi(data.me_pass_percent, data.me_pass_min),
        sections: data.sections.map((s) => ({
            tpc_id: s.tpc_id,
            tpc_name: s.tpc_name,
            tpc_category_name: s.tpc_category_name,
            question_count: String(s.question_count),
            criterion: passCriterionFromApi(s.pass_percent, s.pass_min),
            available: s.available,
        })),
    };
}

type Errors = { me_name?: string; me_time_limit_minutes?: string; criterion?: string; sections?: string };

function validate(value: MockExamFormValue): Errors {
    const errors: Errors = {};
    if (!value.me_name.trim()) errors.me_name = "กรุณากรอกชื่อสนามสอบ";
    const minutes = Number(value.me_time_limit_minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) errors.me_time_limit_minutes = "เวลาสอบต้องเป็นจำนวนเต็ม 1-600 นาที";
    const criterionError = validatePassCriterionInput(value.criterion, false);
    if (criterionError) errors.criterion = criterionError;

    if (value.sections.length === 0) errors.sections = "ต้องมีอย่างน้อย 1 วิชา";
    for (const s of value.sections) {
        const count = Number(s.question_count);
        if (!Number.isInteger(count) || count < 1) { errors.sections = `วิชา "${s.tpc_name}": จำนวนข้อต้องเป็นจำนวนเต็มมากกว่า 0`; break; }
        const error = validatePassCriterionInput(s.criterion, false);
        if (error) { errors.sections = `วิชา "${s.tpc_name}": ${error}`; break; }
        // เกณฑ์ขั้นต่ำมากกว่าจำนวนข้อที่ออกสอบ = ไม่มีทางผ่าน (backend ก็ปฏิเสธ แต่บอกตั้งแต่ในฟอร์มจะเร็วกว่า)
        if (s.criterion.mode === "min" && s.criterion.value.trim() && Number(s.criterion.value) > count) {
            errors.sections = `วิชา "${s.tpc_name}": เกณฑ์ขั้นต่ำต้องไม่เกินจำนวนข้อที่ออกสอบ (${count} ข้อ)`;
            break;
        }
    }
    return errors;
}

export default function MockExamForm({ examId, initial }: { examId?: string; initial: MockExamFormValue }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [value, setValue] = useState<MockExamFormValue>(initial);
    const [errors, setErrors] = useState<Errors>({});
    const [error, setError] = useState<string | null>(null);
    const [newTopicId, setNewTopicId] = useState("");

    const set = <K extends keyof MockExamFormValue>(key: K, v: MockExamFormValue[K]) => {
        setValue((prev) => ({ ...prev, [key]: v }));
        setErrors((prev) => ({ ...prev, [key === "sections" ? "sections" : key]: undefined }));
    };
    const setSection = (tpcId: string, patch: Partial<MockSection>) => {
        setValue((prev) => ({ ...prev, sections: prev.sections.map((s) => (s.tpc_id === tpcId ? { ...s, ...patch } : s)) }));
        setErrors((prev) => ({ ...prev, sections: undefined }));
    };

    async function addTopic(tpcId: string) {
        setNewTopicId("");
        if (!tpcId || value.sections.some((s) => s.tpc_id === tpcId)) return;
        // ต้องรู้ชื่อวิชา + หมวดไว้แสดงในตาราง — ดึงจากตัวเลือกที่โหลดมาแล้วอีกครั้ง (รายการสั้น ไม่หนัก)
        const options = await loadTopicOptions(value.me_category_id, "", { withCategory: true });
        const option = options.find((o) => o.value === tpcId);
        setValue((prev) => ({
            ...prev,
            sections: [...prev.sections, {
                tpc_id: tpcId, tpc_name: option?.name ?? option?.label ?? tpcId, tpc_category_name: option?.category ?? null,
                question_count: "25", criterion: EMPTY_PASS_CRITERION,
            }],
        }));
        setErrors((prev) => ({ ...prev, sections: undefined }));
    }

    const totalQuestions = value.sections.reduce((sum, s) => sum + (Number(s.question_count) || 0), 0);

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const fieldErrors = validate(value);
        if (Object.values(fieldErrors).some(Boolean)) { setErrors(fieldErrors); return; }

        const { percent, min } = passCriterionPayload(value.criterion);
        const payload = {
            me_name: value.me_name.trim(),
            me_description: value.me_description.trim() || null,
            me_category_id: value.me_category_id || null,
            me_time_limit_minutes: Number(value.me_time_limit_minutes),
            me_status: value.me_status,
            me_pass_percent: percent,
            me_pass_min: min,
            sections: value.sections.map((s) => {
                const c = passCriterionPayload(s.criterion);
                return { tpc_id: s.tpc_id, question_count: Number(s.question_count), pass_percent: c.percent, pass_min: c.min };
            }),
        };

        startTransition(async () => {
            const res = await fetch(examId ? `${api}/mock-exams/${examId}` : `${api}/mock-exams`, {
                method: examId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }
            toast.success(examId ? "แก้ไขสนามสอบสำเร็จ" : "สร้างสนามสอบสำเร็จ");
            router.push("/mock-exams");
        });
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสนามสอบ</label>
                <Input value={value.me_name} onChange={(e) => set("me_name", e.target.value)} className="w-full"
                    placeholder="เช่น ก.พ. ภาค ก (จำลองเต็มรูปแบบ)" error={!!errors.me_name} />
                {errors.me_name && <p className="text-xs text-red-500 mt-1">{errors.me_name}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย (ไม่บังคับ)</label>
                <textarea value={value.me_description} onChange={(e) => set("me_description", e.target.value)} rows={3}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    placeholder="อธิบายให้ลูกค้าเห็นว่าสนามสอบนี้จำลองอะไร" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดสอบ (ไม่บังคับ)</label>
                    <SearchableSelect loadOptions={loadCategoryOptions} value={value.me_category_id}
                        onChange={(v) => set("me_category_id", v)} className="w-full" placeholder="— เลือกหมวดสอบ —" />
                    <p className="text-xs text-gray-400 mt-1">ใช้กรองวิชาที่เลือกได้ด้านล่าง และแสดงเป็นป้ายให้ลูกค้าเห็น</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสอบ (นาที)</label>
                    <Input type="number" min={1} max={600} value={value.me_time_limit_minutes}
                        onChange={(e) => set("me_time_limit_minutes", e.target.value)} className="w-40" error={!!errors.me_time_limit_minutes} />
                    {errors.me_time_limit_minutes && <p className="text-xs text-red-500 mt-1">{errors.me_time_limit_minutes}</p>}
                    <p className="text-xs text-gray-400 mt-1">สนามสอบเป็นโหมดจับเวลาเสมอ หมดเวลาแล้วระบบส่งคำตอบให้อัตโนมัติ</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ผ่านรวมทั้งสนาม — ไม่บังคับ</label>
                <PassCriterionInput criterion={value.criterion} onChange={(c) => set("criterion", c)} unitLabel="ข้อ"
                    invalid={!!errors.criterion} ariaLabel="เกณฑ์ผ่านรวมทั้งสนาม" />
                {errors.criterion && <p className="text-xs text-red-500 mt-1">{errors.criterion}</p>}
                <p className="text-xs text-gray-400 mt-1">
                    ตอนนี้สนามสอบมี {totalQuestions} ข้อ · ผลจะขึ้นว่า &quot;ผ่าน&quot; ก็ต่อเมื่อผ่านทั้งเกณฑ์รวมนี้และเกณฑ์ของทุกวิชา
                </p>
            </div>

            {/* โครงสร้างรายวิชา — หัวใจของสนามสอบ */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วิชาและจำนวนข้อ</label>
                <p className="text-xs text-gray-400 mb-2">
                    ระบบจะสุ่มข้อของแต่ละวิชาจาก<b>ทุกชุดข้อสอบที่ลูกค้าคนนั้นมีสิทธิ์</b> ใหม่ทุกครั้งที่เริ่มสอบ —
                    ลูกค้ามีชุดมาก ข้อยิ่งไม่ซ้ำ · เรียงตามลำดับที่เพิ่มไว้ · ชื่อวิชาซ้ำกันได้ข้ามหมวด จึงมีชื่อหมวดกำกับไว้ให้
                </p>

                {value.sections.length > 0 && (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 mb-2">
                        {value.sections.map((s) => {
                            const count = Number(s.question_count) || 0;
                            const shortOfPool = s.available !== undefined && s.available < count;
                            return (
                                <div key={s.tpc_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                                    <div className="min-w-0 flex-1 basis-40">
                                        <p className="text-sm text-gray-800">
                                            {s.tpc_name}
                                            {s.tpc_category_name && (
                                                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                                                    {s.tpc_category_name}
                                                </span>
                                            )}
                                        </p>
                                        {s.available !== undefined && (
                                            <p className={shortOfPool ? "text-xs text-amber-600" : "text-xs text-gray-400"}>
                                                มีในคลังทั้งหมด {s.available} ข้อ{shortOfPool ? " — น้อยกว่าที่ตั้งไว้" : ""}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Input type="number" min={1} value={s.question_count}
                                            onChange={(e) => setSection(s.tpc_id, { question_count: e.target.value })}
                                            className="w-20" aria-label={`จำนวนข้อวิชา ${s.tpc_name}`} />
                                        <span className="text-sm text-gray-500">ข้อ</span>
                                    </div>
                                    <PassCriterionInput criterion={s.criterion} onChange={(c) => setSection(s.tpc_id, { criterion: c })}
                                        unitLabel="ข้อ" ariaLabel={`เกณฑ์ผ่านวิชา ${s.tpc_name}`}
                                        invalid={!!validatePassCriterionInput(s.criterion, false)} />
                                    <DeleteButton onClick={() => set("sections", value.sections.filter((x) => x.tpc_id !== s.tpc_id))} />
                                </div>
                            );
                        })}
                    </div>
                )}

                <SearchableSelect
                    key={value.sections.length}
                    loadOptions={(search) => loadTopicOptions(value.me_category_id, search, { withCategory: true })}
                    value={newTopicId}
                    onChange={addTopic}
                    className="w-full sm:w-80"
                    placeholder="+ เพิ่มวิชา"
                />
                {errors.sections && <p className="text-xs text-red-500 mt-1">{errors.sections}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select value={value.me_status} onChange={(e) => set("me_status", e.target.value as MockExamFormValue["me_status"])}
                    className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20">
                    <option value="draft">ฉบับร่าง (ลูกค้ายังไม่เห็น)</option>
                    <option value="published">เผยแพร่แล้ว</option>
                    <option value="archived">เก็บเข้ากรุ</option>
                </select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => router.push("/mock-exams")}
                    disabled={isPending}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                    ยกเลิก
                </button>
                <Button type="submit" disabled={isPending}>{isPending ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
        </form>
    );
}
