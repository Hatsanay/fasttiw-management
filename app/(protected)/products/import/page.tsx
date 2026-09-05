"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import ProgressModal from "@/components/ui/ProgressModal";
import { toast } from "sonner";
import { UploadCloud, Download } from "lucide-react";

type Product = { prod_id: string; prod_name: string };
type Phase = "idle" | "uploading" | "importing" | "done";
type ImportStatus = {
    processed: number; total: number; done: boolean;
    error: string | null; message: string | null; cancelled: boolean;
};

async function fetchProductById(id: string): Promise<Product | null> {
    const res = await fetch(`${api}/products/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

// แปลง byte/วินาที เป็นหน่วยอ่านง่าย เช่น 2.3 KB/s, 1.8 MB/s, 3.1 GB/s
function formatSpeed(bytesPerSec: number): string {
    if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return "0 B/s";
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 ** 2) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    if (bytesPerSec < 1024 ** 3) return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
    return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GB/s`;
}

// error พิเศษที่ throw ตอนผู้ใช้กดยกเลิกการอัปโหลด (แยกจาก error จริงเพื่อไม่ให้ขึ้น toast แบบผิดพลาด)
class UploadAbortedError extends Error {}

// ใช้ XMLHttpRequest แทน fetch เพราะ fetch ไม่มี event ความคืบหน้าตอนอัปโหลด (upload progress)
// ในทุกเบราว์เซอร์แบบที่ทำได้เสถียร ส่วน onload คือตอนเซิร์ฟเวอร์ตอบกลับมาแล้ว (แค่ validate เสร็จ
// ไม่ใช่ insert เสร็จ — insert จริงรันเบื้องหลังต่อ ต้อง poll สถานะแยกดูความคืบหน้าอีกที)
// คืน abort() แยกออกมาด้วย เพื่อให้ยกเลิกกลางทางได้ตอนไฟล์ยังอัปโหลดไม่เสร็จ (ฝั่งเซิร์ฟเวอร์ยังไม่เริ่ม insert)
function uploadWithProgress(
    url: string,
    formData: FormData,
    headers: Record<string, string>,
    onProgress: (pct: number, speedBytesPerSec: number) => void
): { promise: Promise<{ status: number; data: Record<string, unknown> }>; abort: () => void } {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<{ status: number; data: Record<string, unknown> }>((resolve, reject) => {
        xhr.open("POST", url);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

        const startTime = Date.now();
        xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const elapsedSec = (Date.now() - startTime) / 1000;
            const speed = elapsedSec > 0 ? e.loaded / elapsedSec : 0;
            onProgress(Math.round((e.loaded / e.total) * 100), speed);
        };

        xhr.onload = () => {
            let data = {};
            try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON response */ }
            resolve({ status: xhr.status, data });
        };
        xhr.onerror = () => reject(new Error("การเชื่อมต่อล้มเหลว"));
        xhr.onabort = () => reject(new UploadAbortedError("อัปโหลดถูกยกเลิก"));
        xhr.send(formData);
    });
    return { promise, abort: () => xhr.abort() };
}

export default function ImportQuestionsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const id = searchParams.get("id") ?? "";

    const [product, setProduct] = useState<Product | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [phase, setPhase] = useState<Phase>("idle");
    const [uploadPct, setUploadPct] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState(0);
    const [imported, setImported] = useState({ processed: 0, total: 0 });

    const [cancelling, setCancelling] = useState(false);

    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const uploadAbortRef = useRef<(() => void) | null>(null);
    const jobIdRef = useRef<string | null>(null);
    const isBusy = phase === "uploading" || phase === "importing";

    useEffect(() => {
        if (!id) return;
        fetchProductById(id).then((data) => {
            if (!data) setNotFound(true);
            else setProduct(data);
        });
    }, [id]);

    // เคลียร์ poll timer ถ้าออกจากหน้านี้ก่อน import เสร็จ (งาน insert เบื้องหลังยังทำต่อฝั่งเซิร์ฟเวอร์ตามปกติ)
    useEffect(() => {
        return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
    }, []);

    async function downloadTemplate() {
        const res = await fetch(`${api}/questions/template`, { headers: authHeader() });
        if (!res.ok) { toast.error("ดาวน์โหลดเทมเพลตไม่สำเร็จ"); return; }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "template_import_questions.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        setErrors([]);
        setSubmitError(null);
        setFile(e.target.files?.[0] ?? null);
    }

    function pollStatus(jobId: string) {
        jobIdRef.current = jobId;
        pollTimer.current = setTimeout(async () => {
            const res = await fetch(`${api}/products/${id}/questions/import/status/${jobId}`, {
                headers: authHeader(),
            });
            if (!res.ok) {
                setPhase("done");
                setSubmitError("ไม่พบสถานะการนำเข้า กรุณาตรวจสอบรายการคำถามอีกครั้ง");
                return;
            }

            const status: ImportStatus = await res.json();
            setImported({ processed: status.processed, total: status.total });

            if (!status.done) {
                pollStatus(jobId);
                return;
            }

            jobIdRef.current = null;

            // ยกเลิกสำเร็จ — ฝั่ง backend rollback transaction ไปแล้ว ไม่มีข้อมูลถูกบันทึกเข้า DB
            if (status.cancelled) {
                setPhase("idle");
                setFile(null);
                toast(status.message ?? "ยกเลิกการนำเข้าแล้ว ไม่มีข้อมูลถูกบันทึก");
                return;
            }

            setPhase("done");
            if (status.error) {
                setSubmitError(status.error);
                return;
            }
            toast.success(status.message ?? "นำเข้าสำเร็จ");
            router.push(`/products/questions?id=${id}`);
        }, 300);
    }

    // ยกเลิกระหว่างอัปโหลด (ยังไม่มี jobId เพราะเซิร์ฟเวอร์ยังไม่เริ่ม insert) — abort request ตรงๆ พอ
    // ยกเลิกระหว่างนำเข้า (มี jobId แล้ว) — ต้องยิงไปบอก backend ให้ rollback เอง เพราะ insert รันอยู่
    // ใน transaction เดียวกันฝั่งเซิร์ฟเวอร์ ไม่มีทางสั่งหยุดจาก client ตรงๆ ได้
    async function handleCancelImport() {
        if (phase === "uploading") {
            uploadAbortRef.current?.();
            return;
        }
        if (phase === "importing" && jobIdRef.current) {
            setCancelling(true);
            try {
                const res = await fetch(`${api}/products/${id}/questions/import/cancel/${jobIdRef.current}`, {
                    method: "POST",
                    headers: authHeader(),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    toast.error(data.message ?? "ยกเลิกไม่สำเร็จ");
                }
                // ไม่ต้อง set phase เอง — ปล่อยให้ pollStatus รอบถัดไปเจอ done+cancelled แล้วจัดการต่อเอง
            } finally {
                setCancelling(false);
            }
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors([]);
        setSubmitError(null);
        if (!file) { setSubmitError("กรุณาเลือกไฟล์ CSV หรือ Excel"); return; }

        setPhase("uploading");
        setUploadPct(0);
        setUploadSpeed(0);
        setImported({ processed: 0, total: 0 });

        try {
            const fd = new FormData();
            fd.append("file", file);

            const upload = uploadWithProgress(
                `${api}/products/${id}/questions/import`,
                fd,
                authHeader(),
                (pct, speed) => { setUploadPct(pct); setUploadSpeed(speed); }
            );
            uploadAbortRef.current = upload.abort;
            const { status, data } = await upload.promise;
            uploadAbortRef.current = null;

            if (status === 422 && Array.isArray(data.errors)) {
                setPhase("done");
                setErrors(data.errors as string[]);
                return;
            }
            if (status === 202) {
                setImported({ processed: 0, total: data.total as number });
                setPhase("importing");
                pollStatus(data.jobId as string);
                return;
            }
            setPhase("done");
            setSubmitError((data.message as string) ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        } catch (err) {
            uploadAbortRef.current = null;
            // ผู้ใช้กดยกเลิกเอง — ยังไม่ได้ส่งไป backend เลย (ยังอยู่ระหว่างอัปโหลด) ไม่ต้องแจ้ง error
            if (err instanceof UploadAbortedError) {
                setPhase("idle");
                setFile(null);
                toast("ยกเลิกการอัปโหลดแล้ว");
                return;
            }
            setPhase("done");
            setSubmitError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        }
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบชุดข้อสอบนี้</p>;

    const importPct = imported.total > 0 ? (imported.processed / imported.total) * 100 : 0;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">นำเข้าคำถามจาก CSV/Excel</h1>
            <p className="text-sm text-gray-500 mb-6">ชุดข้อสอบ: {product?.prod_name ?? "..."}</p>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-gray-700">รูปแบบคอลัมน์ที่รองรับ (แถวแรกเป็นหัวตาราง):</p>
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                        >
                            <Download className="w-4 h-4" /> ดาวน์โหลดเทมเพลต
                        </button>
                    </div>
                    <p><code className="text-blue-600">บทความร่วม</code>, <code className="text-blue-600">คำถาม</code>, <code className="text-blue-600">วิธีคิด</code>, <code className="text-blue-600">ข้อที่ถูก</code>, <code className="text-blue-600">คะแนน</code>, <code className="text-blue-600">หมวดหมู่</code>, <code className="text-blue-600">ตัวเลือก1</code>...<code className="text-blue-600">ตัวเลือก6</code>, <code className="text-blue-600">เหตุผลผิด1</code>...<code className="text-blue-600">เหตุผลผิด6</code></p>
                    <p className="text-gray-400">เติมตัวเลือกจากคอลัมน์ 1 ไล่ขึ้นไปโดยไม่เว้นช่องว่าง — &quot;ข้อที่ถูก&quot; ใส่เป็นเลขลำดับตัวเลือก (เช่น 1-4)</p>
                    <p className="text-gray-400">&quot;คะแนน&quot; ไม่บังคับ — เว้นว่าง = ข้อละ 1 คะแนน ใช้เฉพาะชุดข้อสอบที่ตั้งคะแนนเต็มไว้ (ตั้งที่หน้าแก้ไขชุดข้อสอบ) ถ้าชุดนี้ไม่ได้ตั้งคะแนนเต็ม ค่าในคอลัมน์นี้จะถูกเพิกเฉย และผลรวมคะแนนทุกข้อต้องไม่เกินคะแนนเต็มของชุด</p>
                    <p className="text-gray-400">&quot;หมวดหมู่&quot; ไม่บังคับ — ใส่ชื่อหัวข้อ (เช่น อนุกรม, อุปมาอุปไมย) ระบบจะสร้างหมวดหมู่ใหม่ให้อัตโนมัติถ้ายังไม่มี โดยผูกกับหมวดหมู่ของชุดข้อสอบนี้ให้เองอัตโนมัติ</p>
                    <p className="text-gray-400">ถ้าหลายข้อใช้บทความ/ตาราง/รูปเดียวกัน (เช่น อ่านบทความแล้วตอบข้อ 48-52) ใช้คอลัมน์ &quot;บทความร่วม&quot; — กรอกข้อความหรือแนบรูปครั้งเดียวที่แถวแรกของกลุ่ม แล้วลากเลือกเซลล์คอลัมน์นี้คลุมแถวของกลุ่มแล้วกด Merge &amp; Center ใน Excel ระบบจะคัดลอกให้ทุกข้อในกลุ่มอัตโนมัติตอนนำเข้า (ดูวิธีทำละเอียดในเทมเพลต)</p>
                    <p className="text-gray-400">เทมเพลตมีตัวอย่าง + คำอธิบายอยู่ในชีท &quot;คำอธิบาย + ตัวอย่าง&quot; แยกจากชีทที่ใช้กรอกจริง — อัปโหลดเทมเพลตกลับไปโดยไม่ลบตัวอย่างก็ไม่เป็นไร ระบบจะไม่นำตัวอย่างไปบันทึก</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label
                        className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl py-10 transition-colors ${
                            isBusy
                                ? "border-gray-200 cursor-not-allowed"
                                : "border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50"
                        }`}
                    >
                        <UploadCloud className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                            {file ? file.name : "คลิกเพื่อเลือกไฟล์ .csv, .xlsx หรือ .xls"}
                        </span>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isBusy}
                        />
                    </label>

                    {errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1 max-h-64 overflow-y-auto">
                            <p className="text-sm font-medium text-red-700">
                                พบข้อผิดพลาด {errors.length} รายการ กรุณาแก้ไขไฟล์แล้วอัปโหลดใหม่:
                            </p>
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                                {errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/products")}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            disabled={isBusy}
                        >
                            ยกเลิก
                        </button>
                        <Button type="submit" disabled={isBusy || !file}>
                            {phase === "uploading" ? "กำลังอัปโหลด..." : phase === "importing" ? "กำลังบันทึก..." : "นำเข้าคำถาม"}
                        </Button>
                    </div>
                </form>
            </div>

            <ProgressModal
                open={isBusy}
                percent={phase === "uploading" ? uploadPct : importPct}
                color={phase === "uploading" ? "stroke-blue-500" : "stroke-green-500"}
                title={phase === "uploading" ? "กำลังอัปโหลดไฟล์" : "กำลังนำเข้าคำถาม"}
                message={
                    phase === "uploading"
                        ? `ความเร็ว ${formatSpeed(uploadSpeed)}`
                        : `บันทึกไปแล้ว ${imported.processed} / ${imported.total} ข้อ`
                }
                onCancel={handleCancelImport}
                cancelling={cancelling}
            />
        </div>
    );
}
