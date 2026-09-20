import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiOrigin, apiBasePath } from "@/app/constans";

// ตัวกลางส่งต่อคำขอจากเบราว์เซอร์ไป backend พร้อมแนบ token จาก httpOnly cookie (2026-09-20)
//
// **ทำไมต้องมี**: เดิมหน้าแอดมินเก็บ JWT ไว้ใน localStorage แล้วแปะ Authorization header เอง ซึ่งแปลว่า
// **ถ้ามี XSS ที่ไหนสักจุดเดียวในระบบหลังบ้าน token จะถูกขโมยไปใช้ได้ทันที** (JS อ่าน localStorage ได้เสมอ)
// ย้ายมาเก็บใน cookie httpOnly แล้ว JS อ่านไม่ได้ — ฝั่งลูกค้า (tiwwai-store) ใช้วิธีนี้มาตั้งแต่ต้น
//
// โค้ดหน้าเว็บไม่ต้องแก้ทีละจุด เพราะ `api` ของฝั่ง client ชี้มาที่ /api/be แทนโดเมน backend ตรงๆ
// (ดู app/constans.tsx) — ทุก fetch เดิมจึงวิ่งผ่านที่นี่อัตโนมัติ
//
// ส่งต่อแบบดิบทั้ง body และ header ที่จำเป็น: รองรับทั้ง JSON, อัปโหลดไฟล์ (multipart) และไฟล์ที่ดาวน์โหลด
// กลับมา (Excel/PDF) โดยไม่ต้องรู้ว่า endpoint ไหนเป็นแบบไหน
const HOP_BY_HOP = new Set([
    "host", "connection", "keep-alive", "transfer-encoding", "upgrade",
    "content-length", // ให้ fetch คำนวณใหม่เอง ไม่งั้นไม่ตรงกับ body ที่ส่งจริง
    "authorization",  // ห้ามให้ client กำหนดเอง — ตัวจริงมาจาก cookie เท่านั้น
    // สองตัวนี้เป็นของเซิร์ฟเวอร์เท่านั้น — ถ้าปล่อยให้ผ่านจากเบราว์เซอร์ ใครก็ปลอม IP ลง audit log ได้
    "x-client-ip",
    "x-internal-secret",
]);

async function forward(req: NextRequest, path: string[]) {
    const token = (await cookies()).get("token")?.value;
    const search = req.nextUrl.search;
    const target = `${apiOrigin}${apiBasePath}/${path.map(encodeURIComponent).join("/")}${search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
    });
    if (token) headers.set("Authorization", `Bearer ${token}`);

    // IP จริงของแอดมินคนที่กดปุ่ม — ทุกคำขอวิ่งผ่านเซิร์ฟเวอร์ Next ก่อนเสมอ ถ้าไม่ส่งต่อไป
    // ร่องรอยใน audit log จะบันทึก IP ของเซิร์ฟเวอร์เหมือนกันหมดทุกคนจนใช้สืบอะไรไม่ได้เลย
    // backend เชื่อ header นี้ก็ต่อเมื่อ x-internal-secret ตรงเท่านั้น (ดู rateLimit.middleware.js)
    // ไม่ได้ตั้ง secret ไว้ = ไม่ส่ง แล้ว backend ถอยไปใช้ IP ที่เห็นเอง (ระบบยังทำงานปกติ)
    const internalSecret = process.env.INTERNAL_PROXY_SECRET;
    const clientIp = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim();
    if (internalSecret && clientIp) {
        headers.set("x-client-ip", clientIp);
        headers.set("x-internal-secret", internalSecret);
    }

    // GET/HEAD ไม่มี body · เมธอดอื่นอ่านเป็น buffer (ไฟล์ที่อัปโหลดในระบบนี้เป็นรูป/Excel ขนาดไม่ใหญ่)
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer());

    try {
        const res = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
        const outHeaders = new Headers();
        for (const key of ["content-type", "content-disposition", "cache-control"]) {
            const value = res.headers.get(key);
            if (value) outHeaders.set(key, value);
        }
        return new NextResponse(res.body, { status: res.status, headers: outHeaders });
    } catch {
        // backend ล่ม/ต่อไม่ติด — ตอบรูปแบบเดียวกับ error อื่นของ backend เพื่อให้หน้าเว็บแสดงข้อความได้ตามปกติ
        return NextResponse.json({ message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่" }, { status: 502 });
    }
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => forward(req, (await ctx.params).path);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
