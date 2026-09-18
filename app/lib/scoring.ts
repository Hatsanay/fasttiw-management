// กฎของระบบคะแนนฝั่งหน้าเว็บ — ให้ตรงกับ backend/src/utils/scoring.js เป๊ะ
//
// ฝั่งนี้เป็นแค่การเตือนล่วงหน้าให้แอดมินเห็นทันทีก่อนกดบันทึก ตัวตัดสินจริงคือ backend เสมอ (ยิง API ตรง
// ก็ต้องโดนปฏิเสธเหมือนกัน) — แยกไว้เป็นไฟล์เดียวเพราะมีถึง 4 หน้าที่ใช้กฎชุดนี้: สร้าง/แก้ชุดข้อสอบ
// และ สร้าง/แก้คำถาม ถ้าปล่อยให้ก๊อปวางกันเองสี่ที่ วันหนึ่งแก้เพดานแล้วจะลืมแก้บางหน้าแน่นอน

export const MAX_TOTAL_SCORE = 10000;
export const MAX_QUESTION_SCORE = 1000;

// DECIMAL(x,2) ใน DB — ถ้าปล่อยให้ส่ง 0.005 ไป MySQL จะปัดเก็บเงียบๆ แล้วผลรวมที่หน้าเว็บคำนวณกับที่
// เก็บจริงจะไม่ตรงกัน
const hasTooManyDecimals = (value: number) => Math.round(value * 100) !== value * 100;

/** ตรวจคะแนนเต็มของชุดข้อสอบ — คืนข้อความ error หรือ undefined ถ้าผ่าน */
export function validateTotalScoreInput(value: string): string | undefined {
    const num = Number(value);
    if (!value.trim() || !Number.isFinite(num) || num <= 0) return "คะแนนเต็มต้องเป็นตัวเลขมากกว่า 0";
    if (num > MAX_TOTAL_SCORE) return `คะแนนเต็มต้องไม่เกิน ${MAX_TOTAL_SCORE}`;
    if (hasTooManyDecimals(num)) return "คะแนนเต็มมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
    return undefined;
}

/**
 * ตรวจคะแนนของคำถาม 1 ข้อ
 * @param remaining โควตาที่เหลือของชุด (คะแนนเต็ม - ที่ข้ออื่นใช้ไปแล้ว) — undefined = ชุดนี้ไม่ใช้ระบบคะแนน
 */
export function validateQuestionScoreInput(value: string, remaining?: number): string | undefined {
    const num = Number(value);
    if (!value.trim() || !Number.isFinite(num) || num <= 0) return "คะแนนของข้อต้องเป็นตัวเลขมากกว่า 0";
    if (num > MAX_QUESTION_SCORE) return `คะแนนของข้อต้องไม่เกิน ${MAX_QUESTION_SCORE}`;
    if (hasTooManyDecimals(num)) return "คะแนนของข้อมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
    if (remaining !== undefined && num > remaining) {
        return `เกินคะแนนที่เหลือของชุดข้อสอบ (เหลือ ${formatScore(remaining)} คะแนน)`;
    }
    return undefined;
}

/** เกณฑ์ผ่านกำหนดเป็น % หรือ "ขั้นต่ำ" (จำนวนข้อ / คะแนนถ้าชุดใช้ระบบคะแนน) อย่างใดอย่างหนึ่ง */
export type PassMode = "percent" | "min";
export type PassCriterionInput = { mode: PassMode; value: string };
export const EMPTY_PASS_CRITERION: PassCriterionInput = { mode: "percent", value: "" };

/** ตรวจเกณฑ์ผ่าน — ว่าง = ไม่ตั้งเกณฑ์ (ผ่าน) · ตรงกับ validatePassCriterion ใน product.controller.js */
export function validatePassCriterionInput({ mode, value }: PassCriterionInput, scored: boolean): string | undefined {
    if (!value.trim()) return undefined;
    const num = Number(value);
    if (mode === "percent") {
        if (!Number.isInteger(num) || num < 1 || num > 100) return "แบบ % ต้องเป็นจำนวนเต็ม 1-100 หรือเว้นว่างถ้าไม่ตั้งเกณฑ์";
        return undefined;
    }
    if (!Number.isFinite(num) || num <= 0) return "ขั้นต่ำต้องมากกว่า 0";
    if (!scored && !Number.isInteger(num)) return "จำนวนข้อขั้นต่ำต้องเป็นจำนวนเต็ม";
    if (scored && hasTooManyDecimals(num)) return "คะแนนขั้นต่ำมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง";
    return undefined;
}

/** แปลงค่าในฟอร์มเป็นคู่ฟิลด์ที่ backend รับ (ส่งค่าเดียว อีกตัวเป็น null) */
export function passCriterionPayload({ mode, value }: PassCriterionInput): { percent: number | null; min: number | null } {
    const num = value.trim() ? Number(value) : null;
    return { percent: mode === "percent" ? num : null, min: mode === "min" ? num : null };
}

/** ค่าจาก backend → ค่าในฟอร์ม */
export function passCriterionFromApi(percent: number | string | null | undefined, min: number | string | null | undefined): PassCriterionInput {
    if (percent != null) return { mode: "percent", value: String(percent) };
    if (min != null) return { mode: "min", value: formatScore(min) };
    return EMPTY_PASS_CRITERION;
}

/** ตัดศูนย์ท้ายทศนิยมทิ้งเพื่อให้อ่านง่าย: 2.00 -> "2", 2.50 -> "2.5" */
export function formatScore(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    return String(Math.round(num * 100) / 100);
}
