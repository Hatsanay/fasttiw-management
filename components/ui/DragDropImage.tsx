"use client";

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { Upload, X } from "lucide-react";

type Props = {
    value?: string;            // URL รูปปัจจุบัน (สำหรับ edit)
    file?: File | null;        // ไฟล์ที่เพิ่งเลือกไว้แต่ยังไม่อัปโหลด (ถ้าผู้เรียกเก็บ state นี้แยกจาก value
                               // เช่น CarouselEditor) — ใช้สร้าง preview ใหม่ตอน mount ได้เสมอแม้ component
                               // จะถูก remount ไปแล้ว (เช่น สลับสไลด์แล้วย้อนกลับมา) ต่างจาก value ที่เป็นแค่
                               // string เก็บ blob URL เดิมไว้ไม่ได้ (ไฟล์จริงยังอยู่ใน memory เสมอ สร้าง URL
                               // ใหม่จากมันได้ตลอด ไม่ต้องพึ่ง object URL ที่อาจถูก revoke ไปแล้วตอน unmount)
    onChange: (file: File | null) => void; // null = ผู้ใช้กดลบรูปที่เลือกไว้ทิ้ง (ไม่มีอะไรจะอัปโหลด)
    disabled?: boolean;
    maxSizeMB?: number;
    compact?: boolean;         // ย่อความสูงลง ใช้ตอนวางเรียงหลายจุดในหน้าเดียว (เช่น รูปต่อตัวเลือก)
    overlay?: ReactNode;       // เนื้อหาซ้อนทับบนรูป (เช่น caption + ลูกศรเลื่อนของ carousel ให้ตรงกับที่
                               // ลูกค้าเห็นจริง) แสดงเฉพาะตอนมีรูปแล้ว — ห่อด้วย wrapper "inset-0" เต็มรูป
                               // ผู้เรียกจึงต้องกำหนดตำแหน่งของตัวเองเพิ่ม (เช่น absolute bottom-0 หรือ
                               // top-1/2) — หยุด event ไม่ให้เด้ง picker เลือกไฟล์ตอนคลิกโดนเนื้อหาข้างใน
};

export default function DragDropImage({ value, file, onChange, disabled, maxSizeMB = 5, compact = false, overlay }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    // lazy initializer รันครั้งเดียวตอน mount เท่านั้น — ถ้ามี file (ไฟล์ที่เลือกไว้ก่อนหน้าแต่ยังไม่อัปโหลด)
    // ให้สร้าง object URL ใหม่จากมันเสมอ แทนที่จะพึ่ง value (ซึ่งจะเป็น undefined เสมอตอนมี file ค้างอยู่ ดู
    // imageUrlFor ฝั่งเรียกใช้) จุดนี้สำคัญเวลาถูก remount (เช่น สลับสไลด์ Carousel แล้วย้อนกลับมาที่สไลด์เดิม
    // ที่เพิ่งเลือกรูปไว้) ถ้าไม่มี logic นี้ preview จะหายไปเงียบๆ ทั้งที่ไฟล์ยังอยู่ใน state ปกติ (แค่ยังไม่ได้
    // สร้าง URL ใหม่ให้มันหลังถูก unmount/remount)
    const [preview, setPreview] = useState<string | null>(() => (file ? URL.createObjectURL(file) : (value ?? null)));
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // ห้ามเขียน ref ตรงๆ กลาง render (React ไม่รับประกันว่า render body จะถูก commit เสมอ เช่น concurrent
    // rendering) ต้อง sync ผ่าน effect แทน — ยังได้ค่าล่าสุดทันเวลาก่อน effect cleanup ตอน unmount ด้านล่าง
    // เพราะ effect รันเรียงตามลำดับที่ประกาศไว้ทุกครั้งที่ preview เปลี่ยนแปลงจริง (commit แล้ว)
    const previewRef = useRef(preview);
    useEffect(() => {
        previewRef.current = preview;
    }, [preview]);

    const handleFile = useCallback((file: File) => {
        setError(null);
        if (!file.type.startsWith("image/")) {
            setError("กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น");
            return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`ขนาดไฟล์ต้องไม่เกิน ${maxSizeMB} MB`);
            return;
        }
        // revoke URL เดิมก่อนสร้างใหม่เพื่อป้องกัน memory leak
        if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(file));
        onChange(file);
    }, [onChange, maxSizeMB, preview]);

    const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop      = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };
    const handleClick       = () => { if (!disabled) inputRef.current?.click(); };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = ""; // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้
    };
    // เดิมแค่เคลียร์ preview ในตัวเอง ไม่บอก parent เลยว่าถูกลบแล้ว — พอกด submit ฟอร์ม parent ยังถือไฟล์
    // เดิมอยู่ (state ไม่เคยถูกเคลียร์) เลยอัปโหลดรูปที่ผู้ใช้เพิ่งกดลบทิ้งไปซ้ำอีกรอบ ต้องเรียก onChange(null)
    // ด้วยเสมอให้ parent เคลียร์ state ฝั่งตัวเองตาม
    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
        setPreview(null);
        setError(null);
        onChange(null);
    };

    // เคลียร์ blob URL ทิ้งตอน component unmount (เช่น ปิดฟอร์ม/เปลี่ยนหน้าโดยไม่ submit) กันหลุดค้างใน
    // memory ตลอดอายุของ SPA session (Next.js client-side navigation ไม่ unload document เต็มๆ) — อ่านจาก
    // ref แทน state ตรงๆ เพราะ cleanup ต้องเห็นค่าล่าสุด ณ ตอน unmount จริง ไม่ใช่ค่าตอน effect ถูกสร้าง
    useEffect(() => {
        return () => {
            if (previewRef.current?.startsWith("blob:")) URL.revokeObjectURL(previewRef.current);
        };
    }, []);

    return (
        <div className="flex flex-col gap-2">
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                    "relative border-2 border-dashed rounded-xl overflow-hidden transition-colors",
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    isDragging
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
                ].join(" ")}
            >
                {preview ? (
                    <div className={`relative w-full ${compact ? "h-20" : "h-48"}`}>
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                        {!disabled && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                className={`absolute bg-red-500 text-white rounded-full hover:bg-red-600 z-10 ${compact ? "top-1 right-1 p-0.5" : "top-2 right-2 p-1"}`}
                            >
                                <X className={compact ? "w-3 h-3" : "w-4 h-4"} />
                            </button>
                        )}
                        {overlay && (
                            <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                {overlay}
                            </div>
                        )}
                    </div>
                ) : compact ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-4 text-gray-400">
                        <Upload className="w-5 h-5" />
                        <p className="text-xs text-gray-500">แนบรูป</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
                        <Upload className="w-10 h-10" />
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-600">
                                ลากรูปมาวางที่นี่ หรือ{" "}
                                <span className="text-blue-500 underline">คลิกเพื่อเลือก</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP ไม่เกิน {maxSizeMB} MB</p>
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
                disabled={disabled}
            />
        </div>
    );
}
