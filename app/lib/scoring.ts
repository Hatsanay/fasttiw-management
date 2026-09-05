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

/** ตัดศูนย์ท้ายทศนิยมทิ้งเพื่อให้อ่านง่าย: 2.00 -> "2", 2.50 -> "2.5" */
export function formatScore(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    return String(Math.round(num * 100) / 100);
}
