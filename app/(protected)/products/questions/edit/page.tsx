"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { loadTopicOptions } from "@/app/lib/categoryOptions";
import { uploadQuestionImage, deleteQuestionImage, uploadChoiceImage } from "@/app/lib/questionImage";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import SearchableSelect from "@/components/ui/SearchableSelect";
import DragDropImage from "@/components/ui/DragDropImage";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const MAX_CHOICES = 6;
const SERVER_BASE = new URL(api).origin;

// key เป็น id ฝั่ง client เท่านั้น (สุ่มตอนโหลด/เพิ่มแถวใหม่) ใช้เป็น React key แทน index — กัน
// DragDropImage (เก็บ preview เป็น internal state) โดน React reuse ข้ามแถวตอนลบตัวเลือกกลางลิสต์แล้วแถว
// หลังจากนั้นเลื่อนขึ้นมาใช้ index เดิม
type ChoiceForm = {
    key: string;
    cho_id: string | null; // id เดิมจาก server ถ้ามี — ส่งกลับตอน submit เพื่อให้ backend "แก้ไขในที่เดิม"
    // แทนลบ+สร้างใหม่ (ไม่งั้น attempt ที่เคยมีคนตอบคำถามนี้ไปแล้วจะพังตาม FK ดู update() ฝั่ง backend)
    // null = ตัวเลือกที่เพิ่งเพิ่มใหม่ในฟอร์มนี้ ยังไม่มีอยู่จริงใน DB
    text: string; isCorrect: boolean; wrongReason: string;
    existingImageUrl: string | null; // path เดิมจาก server (ไม่ใช่ absolute URL) — ส่งกลับตอน submit เพื่อไม่ให้รูปหาย
    imageFile: File | null;
    imageRemoved: boolean;
};

type Product = { prod_id: string; prod_name: string; prod_category_id: string | null };

type QuestionDetail = {
    ques_id: string;
    ques_text: string;
    ques_explanation: string | null;
    ques_image_url: string | null;
    ques_topic_id: string | null;
    choices: { cho_id: string; cho_text: string; cho_is_correct: number | boolean; cho_wrong_reason: string | null; cho_image_url: string | null }[];
};

async function fetchProductById(id: string): Promise<Product | null> {
    const res = await fetch(`${api}/products/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function fetchQuestionById(productId: string, id: string): Promise<QuestionDetail | null> {
    const res = await fetch(`${api}/products/${productId}/questions/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

function emptyChoice(): ChoiceForm {
    return { key: crypto.randomUUID(), cho_id: null, text: "", isCorrect: false, wrongReason: "", existingImageUrl: null, imageFile: null, imageRemoved: false };
}

type FormErrors = { ques_text?: string; choices?: string };

function validate(quesText: string, choices: ChoiceForm[]): FormErrors {
    const errors: FormErrors = {};

    if (!quesText.trim()) errors.ques_text = "กรุณากรอกคำถาม";

    const filled = choices.filter((c) => c.text.trim());
    if (filled.length < 2) errors.choices = "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ";
    else if (choices.some((c) => !c.text.trim())) errors.choices = "กรุณากรอกข้อความของทุกตัวเลือก หรือลบตัวเลือกที่ไม่ใช้ออก";
    else if (!choices.some((c) => c.isCorrect)) errors.choices = "กรุณาเลือกตัวเลือกที่ถูก 1 ข้อ";

    return errors;
}

export default function EditQuestionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const productId = searchParams.get("productId") ?? "";
    const id = searchParams.get("id") ?? "";

    const [product, setProduct] = useState<Product | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [quesText, setQuesText] = useState("");
    const [quesExplanation, setQuesExplanation] = useState("");
    const [quesTopicId, setQuesTopicId] = useState("");
    const [choices, setChoices] = useState<ChoiceForm[]>([emptyChoice(), emptyChoice()]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [error, setError] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [removingImage, setRemovingImage] = useState(false);

    useEffect(() => {
        if (!productId || !id) return;
        // เคลียร์ state ที่ผูกกับ "คำถามข้อก่อนหน้า" ทันทีที่ productId/id เปลี่ยน ไม่งั้นถ้าเปลี่ยน query
        // param ไปแก้คำถามข้อใหม่โดยไม่รีเฟรชหน้าเต็ม (เช่น navigate ผ่าน router) รูปที่เพิ่งเลือกไว้ค้าง/
        // ข้อความ error เก่า/สถานะ notFound เก่า จะติดมาด้วยทั้งที่เป็นของคำถามคนละข้อ
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้อง reset ให้เสร็จก่อน fetch async เริ่ม กันข้อมูล/error เก่าของคำถามก่อนหน้าค้างโชว์
        setNotFound(false);
        setErrors({});
        setError(null);
        setImageFile(null);
        setRemovingImage(false);
        Promise.all([fetchProductById(productId), fetchQuestionById(productId, id)]).then(([p, q]) => {
            if (!p || !q) { setNotFound(true); return; }
            setProduct(p);
            setQuesText(q.ques_text);
            setQuesExplanation(q.ques_explanation ?? "");
            setQuesTopicId(q.ques_topic_id ?? "");
            setImageUrl(q.ques_image_url ? `${SERVER_BASE}${q.ques_image_url}` : undefined);
            setChoices(
                q.choices.length > 0
                    ? q.choices.map((c) => ({
                        key: crypto.randomUUID(),
                        cho_id: c.cho_id,
                        text: c.cho_text,
                        isCorrect: !!c.cho_is_correct,
                        wrongReason: c.cho_wrong_reason ?? "",
                        existingImageUrl: c.cho_image_url,
                        imageFile: null,
                        imageRemoved: false,
                    }))
                    : [emptyChoice(), emptyChoice()]
            );
        });
    }, [productId, id]);

    function updateChoice(index: number, patch: Partial<ChoiceForm>) {
        setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
        if (errors.choices) setErrors((prev) => ({ ...prev, choices: undefined }));
    }

    function markCorrect(index: number) {
        setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === index })));
        if (errors.choices) setErrors((prev) => ({ ...prev, choices: undefined }));
    }

    function handleQuesTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setQuesText(e.target.value);
        if (errors.ques_text) setErrors((prev) => ({ ...prev, ques_text: undefined }));
    }

    function addChoice() {
        setChoices((prev) => (prev.length >= MAX_CHOICES ? prev : [...prev, emptyChoice()]));
    }

    function removeChoice(index: number) {
        setChoices((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fieldErrors = validate(quesText, choices);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            const res = await fetch(`${api}/products/${productId}/questions/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({
                    ques_text: quesText,
                    ques_explanation: quesExplanation || null,
                    ques_topic_id: quesTopicId || null,
                    choices: choices.map((c) => ({
                        cho_id: c.cho_id,
                        cho_text: c.text,
                        cho_is_correct: c.isCorrect,
                        cho_wrong_reason: c.isCorrect ? null : c.wrongReason || null,
                        // ส่ง path เดิมกลับไปถ้าไม่ได้แนบรูปใหม่/ไม่ได้กดลบ — กัน backend ลบรูปเดิมทิ้งตอน
                        // แทนที่ตัวเลือกทั้งชุด (ดูคอมเมนต์ใน update() ฝั่ง backend)
                        cho_image_url: !c.imageFile && !c.imageRemoved ? c.existingImageUrl : null,
                    })),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            // อัปโหลดรูปแยกจากการแก้ไขคำถามหลัก (endpoint หลักรับ JSON ส่วนรูปต้องเป็น multipart) —
            // ทำต่อหลังบันทึกคำถามสำเร็จเลย ไม่บังคับแอดมินต้องมาอัปโหลดซ้ำทีหลัง
            const uploadFailures: string[] = [];
            const tasks: Promise<unknown>[] = [];
            if (imageFile) {
                tasks.push(
                    uploadQuestionImage(productId, id, imageFile).catch(() => {
                        uploadFailures.push("รูปคำถาม");
                    })
                );
            }
            const newChoiceIds: string[] = data.choice_ids ?? [];
            choices.forEach((c, ci) => {
                if (!c.imageFile || !newChoiceIds[ci]) return;
                tasks.push(
                    uploadChoiceImage(productId, id, newChoiceIds[ci], c.imageFile).catch(() => {
                        uploadFailures.push(`รูปตัวเลือกที่ ${ci + 1}`);
                    })
                );
            });
            await Promise.all(tasks);

            if (uploadFailures.length > 0) {
                toast.error(`แก้ไขคำถามสำเร็จ แต่แนบรูปไม่สำเร็จ: ${uploadFailures.join(", ")}`);
            } else {
                toast.success("แก้ไขคำถามสำเร็จ");
            }
            router.push(`/products/questions?id=${productId}`);
        });
    }

    async function handleRemoveImage() {
        setRemovingImage(true);
        try {
            await deleteQuestionImage(productId, id);
            setImageUrl(undefined);
            toast.success("ลบรูปภาพแล้ว");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "ลบรูปภาพไม่สำเร็จ");
        } finally {
            setRemovingImage(false);
        }
    }

    if (!productId || !id || notFound) return <p className="p-6 text-gray-500">ไม่พบคำถามนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">แก้ไขคำถาม</h1>
            <p className="text-sm text-gray-500 mb-6">ชุดข้อสอบ: {product?.prod_name ?? "..."}</p>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำถาม</label>
                    <textarea
                        value={quesText}
                        onChange={handleQuesTextChange}
                        rows={3}
                        className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 ${
                            errors.ques_text
                                ? "border-red-400 focus:border-red-400 focus:ring-red-500/20"
                                : "border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                        }`}
                    />
                    {errors.ques_text && <p className="text-xs text-red-500 mt-1">{errors.ques_text}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพประกอบโจทย์ (ไม่บังคับ)</label>
                    <DragDropImage
                        key={imageUrl ?? "empty"}
                        value={imageFile ? undefined : imageUrl}
                        onChange={setImageFile}
                        disabled={isPending || removingImage}
                    />
                    {imageUrl && !imageFile && (
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={removingImage}
                            className="text-xs text-red-500 hover:text-red-600 mt-1 disabled:opacity-50"
                        >
                            {removingImage ? "กำลังลบ..." : "ลบรูปภาพนี้"}
                        </button>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">วิธีคิด (เฉลย)</label>
                    <textarea
                        value={quesExplanation}
                        onChange={(e) => setQuesExplanation(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่คำถาม</label>
                    <SearchableSelect
                        loadOptions={(search) => loadTopicOptions(product?.prod_category_id, search)}
                        value={quesTopicId}
                        onChange={setQuesTopicId}
                        placeholder="— เลือกหมวดหมู่ (ไม่บังคับ) —"
                        disabled={isPending}
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">ตัวเลือก</label>
                        {choices.length < MAX_CHOICES && (
                            <button
                                type="button"
                                onClick={addChoice}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                                <Plus className="w-4 h-4" /> เพิ่มตัวเลือก
                            </button>
                        )}
                    </div>
                    {errors.choices && <p className="text-xs text-red-500 mb-2">{errors.choices}</p>}

                    <div className="space-y-3">
                        {choices.map((c, i) => (
                            <div key={c.key} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                                <div className="flex items-start gap-2">
                                    <input
                                        type="radio"
                                        name="correctChoice"
                                        checked={c.isCorrect}
                                        onChange={() => markCorrect(i)}
                                        className="w-4 h-4 accent-green-500 shrink-0 mt-2.5"
                                        title="เลือกเป็นคำตอบที่ถูก"
                                    />
                                    <Input
                                        value={c.text}
                                        onChange={(e) => updateChoice(i, { text: e.target.value })}
                                        placeholder={`ตัวเลือกที่ ${i + 1}`}
                                        className="flex-1"
                                    />
                                    <div className="w-20 shrink-0">
                                        <DragDropImage
                                            compact
                                            key={c.existingImageUrl ?? `empty-${c.key}`}
                                            value={c.imageFile || c.imageRemoved ? undefined : (c.existingImageUrl ? `${SERVER_BASE}${c.existingImageUrl}` : undefined)}
                                            onChange={(file) => updateChoice(i, { imageFile: file, imageRemoved: false })}
                                            disabled={isPending}
                                        />
                                    </div>
                                    {choices.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeChoice(i)}
                                            className="text-gray-400 hover:text-red-500 shrink-0 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {c.existingImageUrl && !c.imageFile && !c.imageRemoved && (
                                    <button
                                        type="button"
                                        onClick={() => updateChoice(i, { imageRemoved: true })}
                                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 ml-6"
                                    >
                                        <X className="w-3 h-3" /> ลบรูปตัวเลือกนี้
                                    </button>
                                )}
                                {!c.isCorrect && (
                                    <Input
                                        value={c.wrongReason}
                                        onChange={(e) => updateChoice(i, { wrongReason: e.target.value })}
                                        placeholder="เหตุผลที่ตัวเลือกนี้ผิด (ไม่บังคับ)"
                                        className="w-full text-sm ml-6"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">คลิกวงกลมด้านหน้าตัวเลือกเพื่อกำหนดว่าข้อไหนคือคำตอบที่ถูก</p>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.push(`/products/questions?id=${productId}`)}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        ยกเลิก
                    </button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
