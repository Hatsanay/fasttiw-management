import { cookies } from "next/headers";

// ที่เดียวที่เขียน cookie ของ session แอดมิน (2026-09-20)
//
// เดิมตั้งค่า cookie ไว้ 3 ที่ด้วยตัวเลือกที่พิมพ์ซ้ำกันเอง — วันไหนแก้ที่หนึ่งแล้วลืมอีกที่ ความต่างจะเงียบ
// (เช่น secure ติดบ้างไม่ติดบ้าง) จึงรวมมาไว้ที่นี่ · ตัวเลือกชุดเดียวกับฝั่งลูกค้า (tiwwai-store/lib/session.ts)
//
// secure เปิดเฉพาะ production เพราะบนเครื่อง dev เป็น http ล้วน ถ้าบังคับ secure เบราว์เซอร์จะทิ้ง cookie
// ทันทีแล้วล็อกอินไม่ติดเลย · maxAge 30 วันให้ตรงกับอายุ JWT ฝั่ง backend
export async function setTokenCookie(token: string) {
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
    });
}
