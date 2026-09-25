"use client";

import { useRef, useState } from "react";
import { Sigma } from "lucide-react";
import { MathText, hasMath } from "@/app/lib/math";

// ช่องพิมพ์ข้อความที่มีสูตรคณิตศาสตร์ได้ (2026-09-24)
//
// **ทำไมต้องมีพรีวิว**: แอดมินพิมพ์ `$\frac{3}{2}$` แล้วมองไม่ออกว่าออกมาหน้าตายังไง ถ้าไม่เห็นตอนพิมพ์
// จะไปรู้ตอนลูกค้าเจอ — พรีวิวขึ้นเฉพาะตอนมี `$` ในข้อความ ข้อสอบที่ไม่มีสูตรจึงหน้าตาเหมือนเดิมเป๊ะ
//
// **ทำไมต้องมีปุ่มแทรก**: คนไม่เคยเขียน LaTeX จำไม่ได้ว่าเศษส่วนพิมพ์ยังไง ปุ่มแทรกทำให้ไม่ต้องจำ
// และแทรกตรงตำแหน่งเคอร์เซอร์ (ไม่ใช่ต่อท้าย) เพราะส่วนใหญ่เป็นการเติมสูตรกลางประโยค
const SNIPPETS: { label: string; latex: string; hint: string }[] = [
    { label: "เศษส่วน", latex: String.raw`$\frac{a}{b}$`, hint: "a/b" },
    { label: "ยกกำลัง", latex: String.raw`$x^{2}$`, hint: "x²" },
    { label: "ห้อย", latex: String.raw`$x_{1}$`, hint: "x₁" },
    { label: "รากที่สอง", latex: String.raw`$\sqrt{x}$`, hint: "√x" },
    { label: "รากที่ n", latex: String.raw`$\sqrt[n]{x}$`, hint: "ⁿ√x" },
    { label: "คูณ/หาร", latex: String.raw`$a \times b \div c$`, hint: "× ÷" },
    { label: "ไม่เท่ากับ", latex: String.raw`$a \neq b$`, hint: "≠ ≤ ≥" },
    { label: "ผลรวม", latex: String.raw`$\sum_{i=1}^{n} i$`, hint: "Σ" },
    { label: "พาย/องศา", latex: String.raw`$\pi, 90^{\circ}$`, hint: "π °" },
];

export default function MathTextarea({
    value,
    onChange,
    rows = 3,
    placeholder,
    className = "",
    error = false,
}: {
    value: string;
    onChange: (next: string) => void;
    rows?: number;
    placeholder?: string;
    className?: string;
    error?: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [showTools, setShowTools] = useState(false);

    function insert(latex: string) {
        const el = ref.current;
        // ไม่มี ref (เช่นยังไม่ได้ focus) ก็ยังต้องแทรกได้ — ต่อท้ายไปเลยดีกว่าไม่ทำอะไร
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + latex + value.slice(end));
        // คืนเคอร์เซอร์ไปอยู่หลังสูตรที่เพิ่งแทรก ให้พิมพ์ต่อได้ทันที
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(start + latex.length, start + latex.length);
        });
    }

    return (
        <div>
            <textarea
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 ${
                    error
                        ? "border-red-400 focus:border-red-400 focus:ring-red-500/20"
                        : "border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                } ${className}`}
            />

            <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setShowTools((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                >
                    <Sigma className="w-3.5 h-3.5" />
                    {showTools ? "ซ่อนปุ่มสูตร" : "แทรกสูตรคณิตศาสตร์"}
                </button>
                <span className="text-xs text-gray-400">
                    พิมพ์สูตรคร่อมด้วย <code className="bg-gray-100 px-1 rounded">$...$</code> เช่น{" "}
                    <code className="bg-gray-100 px-1 rounded">$\frac{"{3}{2}"}$</code>
                </span>
            </div>

            {showTools && (
                <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2">
                    {SNIPPETS.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            onClick={() => insert(s.latex)}
                            title={s.latex}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600"
                        >
                            {s.label} <span className="text-gray-400">{s.hint}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* พรีวิวโผล่เฉพาะตอนมีสูตรจริง — ไม่รบกวนคนที่พิมพ์ข้อความธรรมดา */}
            {hasMath(value) && (
                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                    <p className="mb-1 text-[11px] text-blue-600">ตัวอย่างที่ลูกค้าจะเห็น</p>
                    <div className="whitespace-pre-line text-sm text-gray-800">
                        <MathText text={value} />
                    </div>
                </div>
            )}
        </div>
    );
}

/** พรีวิวบรรทัดเดียวสำหรับช่อง input สั้นๆ (ตัวเลือก/เหตุผลที่ผิด) — ขึ้นเฉพาะตอนมีสูตรจริง */
export function MathInlinePreview({ text }: { text: string }) {
    if (!hasMath(text)) return null;
    return (
        <p className="mt-1 px-1 text-xs text-gray-500">
            <span className="text-blue-500">แสดงเป็น:</span> <MathText text={text} />
        </p>
    );
}
