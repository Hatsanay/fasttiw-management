import katex from "katex";
import { Fragment } from "react";

// แสดงคณิตศาสตร์ในโจทย์/ตัวเลือก/เฉลย (2026-09-24)
//
// **ไวยากรณ์: LaTeX คร่อมด้วย `$...$`** เช่น `ข้อใดมีค่าเท่ากับ $\frac{3}{2}$` — เลือก LaTeX เพราะเป็น
// ทางเดียวที่ครอบคลุม "คณิตศาสตร์" จริงๆ ทั้งเศษส่วน เลขยกกำลัง ราก ซิกม่า เมทริกซ์ ไม่ใช่แค่เศษส่วน
// (ทางเลือกอื่นที่ทิ้งไป: อักขระ Unicode เช่น ½ มีแค่ไม่กี่ตัว · HTML ในช่องข้อความ = เปิดช่อง XSS
// และแอดมินพิมพ์ยากกว่า)
//
// **ข้อความที่ไม่มี `$` จะไม่ถูกแตะเลย** — ข้อสอบเก่าทั้งหมดแสดงผลเหมือนเดิมเป๊ะ ไม่ต้องแก้อะไรย้อนหลัง
//
// ความปลอดภัย: ส่วนที่เป็นข้อความธรรมดาปล่อยให้ React escape ตามปกติ (ไม่ประกอบ HTML string เอง)
// ส่วนที่เป็นสูตรให้ KaTeX แปลงด้วย `trust: false` (ค่าเริ่มต้น) ซึ่งไม่ยอมให้ `\href`/`\url`/`\includegraphics`
// และ `throwOnError: false` เพื่อให้สูตรที่พิมพ์ผิดแสดงเป็นข้อความสีแดงในที่ของมัน **ไม่ทำให้ทั้งหน้าพัง**
// (ข้อสอบ 1 ข้อพิมพ์ผิดต้องไม่ทำให้ลูกค้าทำข้อสอบต่อไม่ได้)

// `$...$` ภายในบรรทัดเดียว — จำกัดไม่ให้ข้ามบรรทัดเพื่อไม่ให้ `$` ที่โดดเดี่ยวคนละบรรทัดจับคู่กันเองมั่ว
// `\$` = เครื่องหมายดอลลาร์จริงๆ (เผื่อวันหนึ่งมีโจทย์เรื่องเงินดอลลาร์)
const MATH_PATTERN = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;

// ตัวตรวจแยกอีกตัว **ห้ามใช้ MATH_PATTERN ตรวจ** — `.test()` ของ regex ที่มี /g เลื่อน `lastIndex` ค้างไว้
// แล้ว `matchAll` ครั้งถัดไป (ซึ่งคัดลอก `lastIndex` ไปด้วย) จะเริ่มอ่านกลางข้อความ สูตรหายเป็นครั้งๆ
// (จุดที่เจอจริง: ตัวอย่างสดใต้ช่องกรอกของแอดมิน ที่เรียก hasMath ก่อน MathText เสมอ)
const MATH_TEST = /(?<!\\)\$[^$\n]+?(?<!\\)\$/;

export type MathSegment = { type: "text" | "math"; value: string };

/** แยกข้อความเป็นช่วงข้อความธรรมดากับช่วงสูตร — แยกออกมาเป็นฟังก์ชันเพื่อให้เทสต์ได้โดยไม่ต้องเรนเดอร์ React */
export function splitMath(text: string): MathSegment[] {
    const segments: MathSegment[] = [];
    let last = 0;
    for (const match of text.matchAll(MATH_PATTERN)) {
        const start = match.index ?? 0;
        if (start > last) segments.push({ type: "text", value: text.slice(last, start) });
        segments.push({ type: "math", value: match[1] });
        last = start + match[0].length;
    }
    if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
    return segments;
}

/** มีสูตรอยู่ในข้อความไหม — ใช้เลี่ยงงานที่ไม่จำเป็นในจุดที่ข้อความส่วนใหญ่ไม่มีสูตร */
export function hasMath(text: string | null | undefined): boolean {
    return !!text && MATH_TEST.test(text);
}

/** คืนข้อความล้วนแบบไม่มีเครื่องหมาย `$` — ใช้กับที่ที่แสดง HTML ไม่ได้ เช่น title/aria-label */
export function stripMathDelimiters(text: string): string {
    return splitMath(text).map((s) => s.value).join("").replace(/\\\$/g, "$");
}

export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
    if (!text) return null;

    const segments = splitMath(text);
    return (
        <span className={className}>
            {segments.map((seg, i) =>
                seg.type === "math" ? (
                    <span
                        key={i}
                        // KaTeX คืน HTML ที่ sanitize มาแล้วในโหมด trust: false — ดูเหตุผลด้านบนของไฟล์
                        dangerouslySetInnerHTML={{
                            __html: katex.renderToString(seg.value, { throwOnError: false, output: "html" }),
                        }}
                    />
                ) : (
                    // ปล่อยให้ React escape เอง และคง `\$` ที่แอดมินตั้งใจพิมพ์เป็นดอลลาร์จริงไว้
                    <Fragment key={i}>{seg.value.replace(/\\\$/g, "$")}</Fragment>
                )
            )}
        </span>
    );
}
