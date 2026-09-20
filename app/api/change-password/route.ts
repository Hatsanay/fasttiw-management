import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiOrigin, apiBasePath } from "@/app/constans";
import { forwardedClientHeaders } from "@/app/lib/clientIp";
import { setTokenCookie } from "@/app/lib/sessionCookie";

// เปลี่ยนรหัสผ่านของตัวเอง — ทำผ่านเซิร์ฟเวอร์ Next แทนที่จะให้เบราว์เซอร์ยิง backend ตรง (2026-09-20)
//
// **ทำไมต้องแยกออกมาเป็น route เฉพาะ ไม่ใช้ตัวกลาง /api/be เหมือน endpoint อื่น**:
// backend เตะทุก session ทิ้งตอนเปลี่ยนรหัสผ่าน แล้วออก **token ใบใหม่** ให้เครื่องที่กำลังใช้อยู่
// ถ้าปล่อยผ่านตัวกลางธรรมดา token ใบนั้นจะไหลไปถึง JavaScript ในเบราว์เซอร์ (เพื่อเอาไปตั้ง cookie ต่อ)
// ซึ่งทำลายเหตุผลทั้งหมดของการเก็บ token แบบ httpOnly — มี XSS จุดเดียวก็ขโมยไปใช้ได้
// ที่นี่ token ใบใหม่ถูกตั้งเป็น cookie ที่ฝั่งเซิร์ฟเวอร์เลย **ไม่เคยถูกส่งกลับไปให้หน้าเว็บ**
export async function POST(req: NextRequest) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const { new_password } = await req.json().catch(() => ({}));
    if (!new_password) return NextResponse.json({ message: "กรุณากรอกรหัสผ่านใหม่" }, { status: 400 });

    let res: Response;
    try {
        res = await fetch(`${apiOrigin}${apiBasePath}/users/me/password`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(await forwardedClientHeaders()),
            },
            body: JSON.stringify({ new_password }),
        });
    } catch {
        return NextResponse.json({ message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่" }, { status: 502 });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ message: data.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ" }, { status: res.status });

    // เครื่องที่เพิ่งเปลี่ยนรหัสเองต้องไม่หลุดออกไปด้วย — เขียนทับ cookie ด้วย token ใบใหม่ทันที
    if (data.token) await setTokenCookie(data.token);

    return NextResponse.json({ message: data.message ?? "เปลี่ยนรหัสผ่านสำเร็จ" });
}
