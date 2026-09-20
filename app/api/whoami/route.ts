import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiOrigin, apiBasePath } from "@/app/constans";
import { forwardedClientHeaders } from "@/app/lib/clientIp";

// ตัวตรวจเส้นทางของ "IP จริง" ทั้งสาย (2026-09-20) — เปิด /api/whoami ตอนล็อกอินอยู่แล้วอ่านผลได้เลย
//
// ลำดับที่ IP ต้องเดินทาง: เบราว์เซอร์ → nginx (ใส่ x-forwarded-for) → เซิร์ฟเวอร์ Next → backend
// (แนบ x-client-ip + x-internal-secret) — ถ้าขาดขั้นไหน IP ใน log จะเป็นค่าเดียวกันหมดทุกแถว
// หน้านี้บอกว่าขาดขั้นไหน แทนการไล่เดาทีละอย่างบน production
//
// ปลอดภัยที่จะเปิดค้างไว้: ต้องล็อกอินแอดมินก่อน (backend ตรวจ token ให้) และ**ไม่คืนค่า secret ออกมา**
// บอกแค่ว่าตั้งไว้ไหม/ตรงไหม เป็น true/false · ค่า IP ที่คืนคือ IP ของคนที่เปิดหน้านี้เอง
const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip", "forwarded", "x-client-ip"];

// **Next ใส่ x-forwarded-for ให้เองเสมอถ้าไม่มีมากับคำขอ** (เจอจากการทดสอบ) — การเช็คว่า "มี header ไหม"
// จึงตอบว่ามีเสมอ ตัวชี้ขาดจริงคือ "ค่าที่ได้เป็นเครื่องตัวเอง/วงในหรือเปล่า" ซึ่งแปลว่า IP จริงของคนใช้มาไม่ถึง
function isLocalOrPrivate(ip: string | undefined | null): boolean {
    if (!ip) return true;
    const v = ip.replace(/^::ffff:/, "");
    return v === "::1" || v === "127.0.0.1" || /^10\./.test(v) || /^192\.168\./.test(v)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(v) || /^f[cd]/i.test(v);
}

export async function GET(req: NextRequest) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

    const seenByNext: Record<string, string | null> = {};
    for (const key of IP_HEADERS) seenByNext[key] = req.headers.get(key);

    const sent = await forwardedClientHeaders();
    let backend: unknown = null;
    try {
        const res = await fetch(`${apiOrigin}${apiBasePath}/diagnostics/client-ip`, {
            headers: { Authorization: `Bearer ${token}`, ...sent },
            cache: "no-store",
        });
        backend = res.ok ? await res.json() : { error: `backend ตอบ ${res.status}` };
    } catch {
        backend = { error: "เรียก backend ไม่ได้" };
    }

    const b = backend as { resolved_ip?: string; internal_secret_matched?: boolean } | null;
    const resolved = b?.resolved_ip;
    const verdict = !process.env.INTERNAL_PROXY_SECRET
        ? "เซิร์ฟเวอร์ Next ยังไม่ได้ตั้ง INTERNAL_PROXY_SECRET — ตั้งค่าเดียวกันกับ backend แล้ว restart แอป Next"
        : !b?.internal_secret_matched
            ? "secret ของ Next กับ backend ไม่ตรงกัน (หรือ backend ยังไม่ได้ตั้ง) — ตั้งให้เป็นค่าเดียวกันแล้ว restart ทั้งสองฝั่ง"
            : isLocalOrPrivate(resolved)
                ? `โซ่ครบแต่ IP ที่ได้เป็นเครือข่ายภายใน (${resolved}) — reverse proxy ของโฮสต์ไม่ได้ส่ง IP จริงของผู้ใช้มาใน x-forwarded-for `
                  + "(บนเครื่อง dev ค่านี้ถูกแล้ว) — ดู seen_by_next ว่ามี header ชื่ออื่นที่ถือ IP จริงมาแทนไหม"
                : `ครบทั้งสาย — IP ที่จะถูกบันทึกลง log คือ ${resolved}`;

    return NextResponse.json({
        verdict,
        seen_by_next: seenByNext,
        next_sends_client_ip_header: !!sent["x-client-ip"],
        next_has_internal_secret: !!process.env.INTERNAL_PROXY_SECRET,
        backend,
    });
}
