"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadTopicOptions } from "@/app/lib/categoryOptions";
import { uploadQuestionImage, uploadChoiceImage } from "@/app/lib/questionImage";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DragDropImage from "@/components/ui/DragDropImage";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateQuestionScoreInput, formatScore, MAX_QUESTION_SCORE } from "@/app/lib/scoring";

const MAX_CHOICES = 6;

// key เป็น id ฝั่ง client เท่านั้น (สุ่มตอนสร้างแถวใหม่) ใช้เป็น React key แทน index ล้วนๆ — ถ้าใช้ index
// ตอนลบคำถาม/ตัวเลือกกลางลิสต์ แถวหลังจากนั้นจะเลื่อนขึ้นมาใช้ index เดิม ทำให้ DragDropImage (ซึ่งเก็บ
// preview เป็น internal state ที่ผูกกับ key) โดน React reuse ข้ามแถว แสดงรูป preview ผิดคำถาม/ตัวเลือก
type ChoiceForm = { key: string; text: string; isCorrect: boolean; wrongReason: string; imageFile: File | null };
type QuestionForm = {
    key: string; quesText: string; quesExplanation: string; quesTopicId: string; quesScore: string; choices: ChoiceForm[]; imageFile: File | null;
};

type Product = { prod_id: string; prod_name: string; prod_category_id: string | null; prod_total_score: string | number | null; used_score: string | number };

async function fetchProductById(id: string): Promise<Product | null> {
    const res = await fetch(`${api}/products/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

function emptyChoice(): ChoiceForm {
    return { key: crypto.randomUUID(), text: "", isCorrect: false, wrongReason: "", imageFile: null };
}

function emptyQuestion(): QuestionForm {
    return { key: crypto.randomUUID(), quesText: "", quesExplanation: "", quesTopicId: "", quesScore: "1", choices: [emptyChoice(), emptyChoice()], imageFile: null };
}

// ตรวจข้อเดียว คืน error message หรือ null ถ้าผ่าน — ใช้กฎเดียวกับฝั่ง backend
// useScoring = ชุดนี้เปิดระบบคะแนนไหม (ถ้าไม่เปิด ช่องคะแนนจะไม่แสดงและไม่ต้องตรวจ)
function validateQuestion(q: QuestionForm, useScoring: boolean): string | null {
    if (!q.quesText.trim()) return "กรุณากรอกคำถาม";
    const filled = q.choices.filter((c) => c.text.trim());
    if (filled.length < 2) return "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ";
    if (q.choices.some((c) => !c.text.trim())) return "กรุณากรอกข้อความของทุกตัวเลือก หรือลบตัวเลือกที่ไม่ใช้ออก";
    if (!q.choices.some((c) => c.isCorrect)) return "กรุณาเลือกตัวเลือกที่ถูก 1 ข้อ";
    // ไม่ส่ง remaining เข้าไปตรงนี้ เพราะหน้านี้บันทึกหลายข้อพร้อมกัน ต้องเทียบผลรวมของทุกข้อทีเดียว
    // (ดู handleSubmit) ไม่ใช่ทีละข้อ ไม่งั้นแต่ละข้อจะผ่านหมดทั้งที่รวมกันแล้วเกิน
    if (useScoring) {
        const scoreError = validateQuestionScoreInput(q.quesScore);
        if (scoreError) return scoreError;
    }
    return null;
}

export default function CreateQuestionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const productId = searchParams.get("id") ?? "";

    const [product, setProduct] = useState<Product | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()]);
    // เก็บ error รายคำถาม (key = q.key ไม่ใช่ index กันข้อความ error ค้างผิดข้อตอนเพิ่ม/ลบคำถามกลางลิสต์)
    // แสดงในการ์ดของคำถามข้อนั้นตรงๆ ไม่ใช่แค่สรุปเป็น list รวมท้ายฟอร์ม (ต้องเลื่อนหาเองว่าข้อไหนผิด)
    const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        if (!productId) return;
        // เคลียร์คำถามที่ยังไม่ได้บันทึกทิ้งทันทีที่ productId เปลี่ยน (navigate ไปสร้างคำถามให้ product อื่น
        // โดยไม่รีเฟรชหน้าเต็ม) ไม่งั้นคำถาม/รูปที่พิมพ์ค้างไว้ของ product เดิมจะติดไปด้วยทั้งที่ผิด product
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้อง reset ให้เสร็จก่อน fetch async เริ่ม กันข้อมูล/error เก่าของ product ก่อนหน้าค้างโชว์
        setNotFound(false);
        setErrors([]);
        setQuestionErrors({});
        setQuestions([emptyQuestion()]);
        fetchProductById(productId).then((data) => {
            if (!data) setNotFound(true);
            else setProduct(data);
        });
    }, [productId]);

    // ชุดนี้เปิดระบบคะแนนไหม + เหลือโควตาเท่าไร (มาจาก product.getOne ของ backend)
    const useScoring = product?.prod_total_score != null;
    const remainingScore = useScoring
        ? Math.round((Number(product!.prod_total_score) - Number(product!.used_score)) * 100) / 100
        : 0;

    function updateQuestion(qIndex: number, patch: Partial<QuestionForm>) {
        setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)));
        const key = questions[qIndex]?.key;
        if (key && questionErrors[key]) setQuestionErrors((prev) => ({ ...prev, [key]: "" }));
    }

    function addQuestion() {
        setQuestions((prev) => [...prev, emptyQuestion()]);
    }

    function removeQuestion(qIndex: number) {
        setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== qIndex)));
    }

    function updateChoice(qIndex: number, cIndex: number, patch: Partial<ChoiceForm>) {
        setQuestions((prev) => prev.map((q, i) => (
            i === qIndex
                ? { ...q, choices: q.choices.map((c, ci) => (ci === cIndex ? { ...c, ...patch } : c)) }
                : q
        )));
        const key = questions[qIndex]?.key;
        if (key && questionErrors[key]) setQuestionErrors((prev) => ({ ...prev, [key]: "" }));
    }

    function markCorrect(qIndex: number, cIndex: number) {
        setQuestions((prev) => prev.map((q, i) => (
            i === qIndex
                ? { ...q, choices: q.choices.map((c, ci) => ({ ...c, isCorrect: ci === cIndex })) }
                : q
        )));
        const key = questions[qIndex]?.key;
        if (key && questionErrors[key]) setQuestionErrors((prev) => ({ ...prev, [key]: "" }));
    }

    function addChoice(qIndex: number) {
        setQuestions((prev) => prev.map((q, i) => (
            i === qIndex && q.choices.length < MAX_CHOICES
                ? { ...q, choices: [...q.choices, emptyChoice()] }
                : q
        )));
    }

    function removeChoice(qIndex: number, cIndex: number) {
        setQuestions((prev) => prev.map((q, i) => (
            i === qIndex && q.choices.length > 2
                ? { ...q, choices: q.choices.filter((_, ci) => ci !== cIndex) }
                : q
        )));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors([]);

        const nextQuestionErrors: Record<string, string> = {};
        const clientErrors: string[] = [];
        questions.forEach((q, i) => {
            const err = validateQuestion(q, useScoring);
            if (err) {
                nextQuestionErrors[q.key] = err;
                clientErrors.push(`ข้อที่ ${i + 1}: ${err}`);
            }
        });

        // เทียบผลรวมของทุกข้อที่กำลังจะบันทึกกับโควตาที่เหลือทีเดียว — บันทึกเป็น all-or-nothing อยู่แล้ว
        // ถ้าเช็คทีละข้อจะผ่านข้อแรกๆ แล้วไปตกข้อท้าย ทั้งที่ผลลัพธ์คือไม่มีอะไรถูกบันทึกเหมือนกัน
        if (useScoring && clientErrors.length === 0) {
            const sum = questions.reduce((acc, q) => acc + Number(q.quesScore), 0);
            if (sum > remainingScore) {
                clientErrors.push(
                    `คะแนนรวมของ ${questions.length} ข้อนี้ (${formatScore(sum)}) เกินคะแนนที่เหลือของชุดข้อสอบ (เหลือ ${formatScore(remainingScore)})`
                );
            }
        }

        if (clientErrors.length > 0) { setQuestionErrors(nextQuestionErrors); setErrors(clientErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/products/${productId}/questions/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    questions: questions.map((q) => ({
                        ques_text: q.quesText,
                        ques_explanation: q.quesExplanation || null,
                        ques_topic_id: q.quesTopicId || null,
                        ques_score: useScoring ? Number(q.quesScore) : undefined,
                        choices: q.choices.map((c) => ({
                            cho_text: c.text,
                            cho_is_correct: c.isCorrect,
                            cho_wrong_reason: c.isCorrect ? null : c.wrongReason || null,
                        })),
                    })),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.status === 422 && Array.isArray(data.errors)) {
                setErrors(data.errors);
                return;
            }
            if (!res.ok) {
                setErrors([data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"]);
                return;
            }

            // อัปโหลดรูปแยกจากการสร้างคำถามหลัก (endpoint หลักรับ JSON ส่วนรูปต้องเป็น multipart)
            // ทำต่อทันทีหลังบันทึกสำเร็จ โดยจับคู่ ques_ids/choice_ids ที่ backend คืนมากับลำดับที่ส่งไป
            const quesIds: string[] = data.ques_ids ?? [];
            const choiceIdsByQuestion: string[][] = data.choice_ids ?? [];
            const uploadFailures: string[] = [];
            await Promise.all(
                questions.map(async (q, i) => {
                    if (!quesIds[i]) return;
                    const tasks: Promise<unknown>[] = [];
                    if (q.imageFile) {
                        tasks.push(
                            uploadQuestionImage(productId, quesIds[i], q.imageFile).catch(() => {
                                uploadFailures.push(`ข้อที่ ${i + 1} (รูปคำถาม)`);
                            })
                        );
                    }
                    q.choices.forEach((c, ci) => {
                        const choiceId = choiceIdsByQuestion[i]?.[ci];
                        if (!c.imageFile || !choiceId) return;
                        tasks.push(
                            uploadChoiceImage(productId, quesIds[i], choiceId, c.imageFile).catch(() => {
                                uploadFailures.push(`ข้อที่ ${i + 1} (รูปตัวเลือกที่ ${ci + 1})`);
                            })
                        );
                    });
                    await Promise.all(tasks);
                })
            );
            if (uploadFailures.length > 0) {
                toast.error(`บันทึกคำถามสำเร็จ แต่แนบรูปไม่สำเร็จ: ${uploadFailures.join(", ")}`);
            } else {
                toast.success(data.message ?? "บันทึกสำเร็จ");
            }
            router.push(`/products/questions?id=${productId}`);
        });
    }

    if (!productId || notFound) return <p className="p-6 text-gray-500">ไม่พบชุดข้อสอบนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">สร้างคำถาม</h1>
            <p className="text-sm text-gray-500 mb-6">ชุดข้อสอบ: {product?.prod_name ?? "..."}</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {questions.map((q, qi) => (
                    <div key={q.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">ข้อที่ {qi + 1}</h2>
                            {questions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(qi)}
                                    className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" /> ลบข้อนี้
                                </button>
                            )}
                        </div>

                        {questionErrors[q.key] && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{questionErrors[q.key]}</p>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">คำถาม</label>
                            <textarea
                                value={q.quesText}
                                onChange={(e) => updateQuestion(qi, { quesText: e.target.value })}
                                rows={3}
                                className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 ${
                                    questionErrors[q.key] && !q.quesText.trim()
                                        ? "border-red-400 focus:border-red-400 focus:ring-red-500/20"
                                        : "border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                                }`}
                                placeholder="พิมพ์คำถาม"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพประกอบโจทย์ (ไม่บังคับ)</label>
                            <DragDropImage
                                onChange={(file) => updateQuestion(qi, { imageFile: file })}
                                disabled={isPending}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วิธีคิด (เฉลย)</label>
                            <textarea
                                value={q.quesExplanation}
                                onChange={(e) => updateQuestion(qi, { quesExplanation: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                                placeholder="อธิบายวิธีคิดทีละขั้น"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่คำถาม</label>
                            <SearchableSelect
                                loadOptions={(search) => loadTopicOptions(product?.prod_category_id, search)}
                                value={q.quesTopicId}
                                onChange={(v) => updateQuestion(qi, { quesTopicId: v })}
                                placeholder="— เลือกหมวดหมู่ (ไม่บังคับ) —"
                                disabled={isPending}
                            />
                        </div>

                        {useScoring && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนของข้อนี้</label>
                                <input
                                    type="number" min={0} max={MAX_QUESTION_SCORE} step="0.01"
                                    value={q.quesScore}
                                    onChange={(e) => updateQuestion(qi, { quesScore: e.target.value })}
                                    className="w-32 px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                                />
                                <p className="text-xs text-gray-400 mt-1">ชุดนี้เหลือโควตา {formatScore(remainingScore)} คะแนน</p>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">ตัวเลือก</label>
                                {q.choices.length < MAX_CHOICES && (
                                    <button
                                        type="button"
                                        onClick={() => addChoice(qi)}
                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        <Plus className="w-4 h-4" /> เพิ่มตัวเลือก
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {q.choices.map((c, ci) => (
                                    <div key={c.key} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                                        <div className="flex items-start gap-2">
                                            <input
                                                type="radio"
                                                name={`correctChoice-${qi}`}
                                                checked={c.isCorrect}
                                                onChange={() => markCorrect(qi, ci)}
                                                className="w-4 h-4 accent-green-500 shrink-0 mt-2.5"
                                                title="เลือกเป็นคำตอบที่ถูก"
                                            />
                                            <Input
                                                value={c.text}
                                                onChange={(e) => updateChoice(qi, ci, { text: e.target.value })}
                                                placeholder={`ตัวเลือกที่ ${ci + 1}`}
                                                className="flex-1"
                                            />
                                            <div className="w-20 shrink-0">
                                                <DragDropImage
                                                    compact
                                                    onChange={(file) => updateChoice(qi, ci, { imageFile: file })}
                                                    disabled={isPending}
                                                />
                                            </div>
                                            {q.choices.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeChoice(qi, ci)}
                                                    className="text-gray-400 hover:text-red-500 shrink-0 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        {!c.isCorrect && (
                                            <Input
                                                value={c.wrongReason}
                                                onChange={(e) => updateChoice(qi, ci, { wrongReason: e.target.value })}
                                                placeholder="เหตุผลที่ตัวเลือกนี้ผิด (ไม่บังคับ)"
                                                className="w-full text-sm ml-6"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">คลิกวงกลมด้านหน้าตัวเลือกเพื่อกำหนดว่าข้อไหนคือคำตอบที่ถูก</p>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                    <Plus className="w-5 h-5" /> เพิ่มคำถาม
                </button>

                {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
                        <p className="text-sm font-medium text-red-700">พบข้อผิดพลาด {errors.length} รายการ:</p>
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                            {errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push(`/products/questions?id=${productId}`)}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "กำลังบันทึก..." : `บันทึกทั้งหมด (${questions.length} ข้อ)`}
                    </Button>
                </div>
            </form>
        </div>
    );
}
