"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { CheckCircle2, XCircle, FileUp } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

const SERVER_BASE = new URL(api).origin;

type Choice = {
    cho_id: string;
    cho_text: string;
    cho_is_correct: number | boolean;
    cho_wrong_reason: string | null;
    cho_image_url: string | null;
    cho_order: number;
};

type Question = {
    ques_id: string;
    ques_text: string;
    ques_explanation: string | null;
    ques_image_url: string | null;
    ques_order: number;
    ques_topic_name: string | null;
    choices: Choice[];
};

type Product = { prod_id: string; prod_name: string };

async function fetchProductById(id: string): Promise<Product | null> {
    const res = await fetch(`${api}/products/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function fetchQuestions(
    productId: string, limit: number, offset: number, search: string
): Promise<{ data: Question[]; total: number }> {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset), search });
    const res = await fetch(`${api}/products/${productId}/questions?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [], total: 0 };
    return res.json();
}

export default function ProductQuestionsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const hasBit = usePermission();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id") ?? "";

    const [product, setProduct] = useState<Product | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [notFound, setNotFound] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const token = begin();
        startTransition(async () => {
            const limit = pageSize === -1 ? 99999 : pageSize;
            const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
            const [productData, questionsResult] = await Promise.all([
                fetchProductById(id),
                fetchQuestions(id, limit, offset, search),
            ]);
            if (!isCurrent(token)) return; // มี reload() ใหม่กว่าเริ่มไปแล้วระหว่างรอ ทิ้งผลลัพธ์นี้
            if (!productData) { setNotFound(true); return; }
            setProduct(productData);
            setQuestions(questionsResult.data);
            setTotal(questionsResult.total);

            const correctPage = clampPage(questionsResult.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage); // total ลดลงจนหน้าปัจจุบันเกินขอบเขต — เด้งกลับหน้าที่มีข้อมูลจริง
        });
    }

    useEffect(() => {
        if (!id) return;
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, page, pageSize, search]);

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/products/${id}/questions/${deleteTarget.ques_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("ลบคำถามสำเร็จ");
                reload(); // โหลดใหม่แทนการตัดออกจาก state เฉยๆ กัน total/หน้าปัจจุบันไม่ตรงกับข้อมูลจริง
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบชุดข้อสอบนี้</p>;

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6 gap-2">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">คำถามในชุดข้อสอบ</h1>
                    <p className="text-sm text-gray-500">{product?.prod_name ?? "..."} — {total} ข้อ</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasBit(BITS.createProduct) && (
                        <button
                            onClick={() => router.push(`/products/import?id=${id}`)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors font-medium"
                        >
                            <FileUp className="w-4 h-4" /> นำเข้าคำถาม
                        </button>
                    )}
                    {hasBit(BITS.createProduct) && (
                        <Button onClick={() => router.push(`/products/questions/create?id=${id}`)}>สร้างคำถาม</Button>
                    )}
                    <button
                        onClick={() => router.push("/products")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        ย้อนกลับ
                    </button>
                </div>
            </div>

            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาคำถาม..." className="w-full sm:w-72 mb-4" />

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">
                    {search
                        ? "ไม่พบคำถามที่ตรงกับคำค้นหา"
                        : "ยังไม่มีคำถามในชุดข้อสอบนี้ — ลองสร้างคำถามเองหรือนำเข้าจาก CSV/Excel"}
                </p>
            ) : (
                <>
                    <div className="space-y-4">
                        {questions.map((q, qi) => (
                            <div key={q.ques_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                                {q.ques_image_url && (
                                    <div className="relative h-40 w-full overflow-hidden rounded-lg bg-gray-50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`${SERVER_BASE}${q.ques_image_url}`}
                                            alt=""
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-gray-800">
                                        {(pageSize === -1 ? 0 : (page - 1) * pageSize) + qi + 1}. {q.ques_text}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {q.ques_topic_name && (
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600">
                                                {q.ques_topic_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {q.choices.map((c) => {
                                        const isCorrect = !!c.cho_is_correct;
                                        return (
                                            <div
                                                key={c.cho_id}
                                                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                                                    isCorrect ? "bg-green-50 text-green-800" : "bg-gray-50 text-gray-700"
                                                }`}
                                            >
                                                {isCorrect ? (
                                                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 mt-0.5 text-gray-300 shrink-0" />
                                                )}
                                                <div>
                                                    {c.cho_image_url && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={`${SERVER_BASE}${c.cho_image_url}`}
                                                            alt=""
                                                            className="mb-1.5 h-16 w-auto max-w-32 rounded border border-gray-100 object-contain bg-white"
                                                        />
                                                    )}
                                                    <p>{c.cho_text}</p>
                                                    {!isCorrect && c.cho_wrong_reason && (
                                                        <p className="text-xs text-gray-400 mt-0.5">เหตุผลที่ผิด: {c.cho_wrong_reason}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {q.ques_explanation && (
                                    <div className="border-t border-gray-100 pt-3">
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">วิธีคิด</p>
                                        <p className="text-sm text-gray-600">{q.ques_explanation}</p>
                                    </div>
                                )}

                                {(hasBit(BITS.editProduct) || hasBit(BITS.deleteProduct)) && (
                                    <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2">
                                        {hasBit(BITS.editProduct) && (
                                            <EditButton onClick={() => router.push(`/products/questions/edit?productId=${id}&id=${q.ques_id}`)} />
                                        )}
                                        {hasBit(BITS.deleteProduct) && (
                                            <DeleteButton onClick={() => setDeleteTarget(q)} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </div>
                </>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบคำถามนี้?"
                description="คำถามและตัวเลือกทั้งหมดของข้อนี้จะถูกลบและไม่สามารถกู้คืนได้"
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
