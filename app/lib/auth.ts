// เดิมอ่าน token จาก localStorage มาแปะ Authorization header เอง — ย้ายไปใช้ cookie httpOnly แล้ว
// (2026-09-20) token จึงไม่อยู่ในมือ JS อีกต่อไป และตัวกลาง /api/be เป็นคนแนบ Authorization ให้ฝั่ง server
//
// คงฟังก์ชันนี้ไว้ (คืน object ว่าง) เพื่อไม่ต้องไล่แก้จุดเรียกใช้ 80+ ไฟล์ — และถ้าวันหนึ่งต้องแนบ header
// อะไรเพิ่มกับทุกคำขอ ก็ยังมีที่เดียวให้แก้เหมือนเดิม
export function authHeader(): Record<string, string> {
    return {};
}

/** รหัสผู้ใช้ที่ล็อกอินอยู่ (อ่านจาก cookie ที่ไม่ใช่ httpOnly) — ใช้ตอนหน้าเว็บต้องดึงโปรไฟล์ของตัวเอง
 *  ไม่ใช่ข้อมูลที่ใช้ยืนยันตัวตน: backend ตัดสินสิทธิ์จาก token ใน cookie httpOnly เสมอ */
export function currentUserId(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)userId=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}
