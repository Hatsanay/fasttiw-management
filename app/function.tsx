export default function formatDate(value: unknown): string {
    if (!value) return "-";
    const d = new Date(value as string);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", {
        year:     "numeric",
        month:    "short",
        day:      "2-digit",
        hour:     "2-digit",
        minute:   "2-digit",
        timeZone: "Asia/Bangkok",
    });
}

// ตัวเงินทุกจุดในระบบต้องบังคับทศนิยม 2 ตำแหน่งเสมอ (ไม่ใช้ toLocaleString เปล่าๆ เพราะ default
// ของ JS จะโชว์ 0-3 ตำแหน่งตามค่าจริง เช่น 50000.5 จะโชว์แค่ ".5" ดูเหมือนเลขผิด/พิมพ์ตก และค่าที่มา
// จากการคำนวณ % สดฝั่ง frontend ก่อนส่งเข้า backend อาจมีเศษทศนิยมเกิน 2 ตำแหน่งจาก floating point)
export function formatBaht(value: unknown): string {
    const n = Number(value) || 0;
    return `${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

// เวอร์ชัน frontend ของ getEffectivePrice() ฝั่ง backend (backend/src/utils/pricing.js) — ใช้ตอน
// preview ราคารวมก่อนส่ง request จริง (เช่น GrantProductsModal) ห้ามเขียน ternary ซ้ำเองในแต่ละที่
// ที่ต้องคิดราคารวม เพราะ backend เป็นคนตัดสินราคาจริงอยู่ดี พรีวิวแค่ต้องโชว์ตรงกับสิ่งที่จะเกิดขึ้นจริง
export function effectivePrice(item: { prod_price: unknown; prod_is_free?: boolean }): number {
    return item.prod_is_free ? 0 : Number(item.prod_price) || 0;
}
