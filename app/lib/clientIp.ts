// (โปรเจกต์นี้ไม่ได้ติดตั้ง server-only ไว้เหมือน tiwwai-store — การ import next/headers ก็กันการเอาไปใช้ใน client component อยู่แล้ว)
import { headers } from "next/headers";

// ส่ง IP จริงของแอดมินต่อไปให้ backend — ใช้กับคำขอที่ยิงจาก Server Action/Server Component เท่านั้น
// (คำขอที่วิ่งผ่านตัวกลาง /api/be ใส่ header ชุดนี้ให้เองอยู่แล้ว)
//
// ทำไมต้องมี: หน้าเข้าสู่ระบบ/ออกจากระบบเรียก backend จากฝั่งเซิร์ฟเวอร์ Next โดยตรง backend จึงเห็น IP ของ
// เซิร์ฟเวอร์ Next เหมือนกันหมดทุกคน ผลคือ tb_login_logs บันทึก IP เดียวกันทุกแถว (สืบย้อนหลังไม่ได้ว่าใคร
// ล็อกอินจากที่ไหน) และ rate limit หน้า login ก็นับรวมกันเป็นก้อนเดียวทั้งออฟฟิศ
//
// `x-internal-secret` คือตัวยืนยันว่า header นี้มาจากเซิร์ฟเวอร์เราจริง — ไม่มีตัวนี้ backend จะไม่เชื่อ
// ไม่ได้ตั้ง secret ไว้ = ไม่ส่งอะไรเลย แล้ว backend ถอยไปใช้ IP ที่มันเห็นเอง (ยังทำงานได้ แค่หยาบกว่า)
export async function forwardedClientHeaders(): Promise<Record<string, string>> {
    const secret = process.env.INTERNAL_PROXY_SECRET;
    if (!secret) return {};

    const headerList = await headers();
    // x-forwarded-for อาจมีหลาย IP ต่อกัน (client, proxy1, proxy2) ตัวแรกคือ client จริง
    const ip = (headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip") ?? "").split(",")[0].trim();
    if (!ip) return {};

    return { "x-client-ip": ip, "x-internal-secret": secret };
}
