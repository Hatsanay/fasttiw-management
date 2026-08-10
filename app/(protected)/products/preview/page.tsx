"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";

const SERVER_BASE = new URL(api).origin;
const STATUS_LABEL: Record<string, string> = { draft: "ฉบับร่าง", published: "เผยแพร่แล้ว", archived: "เก็บถาวร" };

type Choice = { cho_id: string; cho_text: string; cho_is_correct: number | boolean; cho_wrong_reason: string | null; cho_image_url: string | null };
type Question = {
    ques_id: string;
    ques_text: string;
    ques_explanation: string | null;
    ques_image_url: string | null;
    choices: Choice[];
};
type Preview = { prod_id: string; prod_name: string; prod_status: string; questions: Question[] };

async function fetchPreview(id: string): Promise<Preview | null> {
    const res = await fetch(`${api}/products/${id}/preview`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function ProductPreviewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get("id") ?? "";

    const [preview, setPreview] = useState<Preview | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchPreview(id).then((data) => {
            if (!data) { setNotFound(true); return; }
            setPreview(data);
        });
    }, [id]);

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบชุดข้อสอบนี้</p>;
    if (!preview) return <p className="p-6 text-gray-400">กำลังโหลด...</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">พรีวิวชุดข้อสอบ</h1>
                <button
                    type="button"
                    onClick={() => router.push("/products")}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                    กลับ
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
                {preview.prod_name} — สถานะ: <span className="font-medium">{STATUS_LABEL[preview.prod_status] ?? preview.prod_status}</span> —{" "}
                {preview.questions.length} ข้อ
            </p>

            {preview.questions.length === 0 ? (
                <p className="text-gray-400 py-12 text-center">ชุดข้อสอบนี้ยังไม่มีคำถาม</p>
            ) : (
                <div className="flex flex-col gap-5">
                    {preview.questions.map((q, i) => (
                        <div key={q.ques_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            {q.ques_image_url && (
                                <div className="relative mb-3 h-48 w-full overflow-hidden rounded-lg bg-gray-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`${SERVER_BASE}${q.ques_image_url}`}
                                        alt=""
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                            )}
                            <h2 className="font-medium text-gray-800 leading-relaxed whitespace-pre-line mb-3">
                                <span className="text-gray-400 mr-1.5">ข้อ {i + 1}.</span>
                                {q.ques_text}
                            </h2>

                            <div className="flex flex-col gap-2 mb-3">
                                {q.choices.map((c) => (
                                    <div key={c.cho_id}>
                                        <div
                                            className={`px-3.5 py-2.5 rounded-lg border text-sm flex items-start justify-between gap-2 ${
                                                c.cho_is_correct ? "border-green-300 bg-green-50" : "border-gray-100 text-gray-500"
                                            }`}
                                        >
                                            <span className="flex-1">
                                                {c.cho_image_url && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={`${SERVER_BASE}${c.cho_image_url}`}
                                                        alt=""
                                                        className="mb-1.5 h-16 w-auto max-w-32 rounded border border-gray-100 object-contain bg-white"
                                                    />
                                                )}
                                                {c.cho_text}
                                            </span>
                                            {c.cho_is_correct ? (
                                                <Check size={15} className="text-green-600 shrink-0" />
                                            ) : (
                                                <X size={15} className="text-gray-300 shrink-0" />
                                            )}
                                        </div>
                                        {!c.cho_is_correct && c.cho_wrong_reason && (
                                            <p className="text-xs text-gray-400 mt-1 px-1">{c.cho_wrong_reason}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {q.ques_explanation && (
                                <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                                    <p className="text-xs font-medium text-blue-700 mb-1">วิธีคิด</p>
                                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{q.ques_explanation}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
