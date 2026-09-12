// ป้ายภาษาไทยและตัวจัดรูปแบบของหน้าสถิติผู้เยี่ยมชม — แยกไว้ที่เดียวให้ทุกการ์ดใช้ชุดเดียวกัน

export type Granularity = "day" | "month" | "year";

export type Overview = {
    range: { from: string; to: string; granularity: Granularity; auto_switched: boolean; days: number };
    tracking_since: string | null;
    online_now: number;
    totals: { visitors: number; pageviews: number };
    previous: { from: string; to: string; visitors: number; pageviews: number };
    series: { period: string; visitors: number; pageviews: number }[];
    sources: { source: string; visitors: number }[];
    devices: { device: "mobile" | "tablet" | "desktop"; visitors: number }[];
    pages: { path: string; product_name: string | null; is_sample: boolean; visitors: number; pageviews: number }[];
    funnel: { from: string; to: string; visitors: number; signups: number; buyers: number };
};

const SOURCE_LABELS: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    line: "LINE",
    google: "Google",
    tiktok: "TikTok",
    youtube: "YouTube",
    search_other: "เสิร์ชเอนจินอื่น",
    direct: "เข้าตรง / ไม่ทราบที่มา",
    other: "เว็บไซต์อื่น",
};

// ค่าอื่นที่ไม่อยู่ในรายการมาจาก utm_source ที่ตั้งเองในลิงก์โฆษณา — แสดงตามที่ตั้งไว้
export function sourceLabel(source: string): string {
    return SOURCE_LABELS[source] ?? `utm: ${source}`;
}

export const DEVICE_LABELS = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์" } as const;

const PAGE_LABELS: Record<string, string> = {
    "/": "หน้าแรก",
    "/products": "แนวข้อสอบทั้งหมด",
    "/packages": "แพ็กเกจ",
    "/cart": "ตะกร้าสินค้า",
    "/checkout": "ชำระเงิน",
    "/login": "เข้าสู่ระบบ",
    "/register": "สมัครสมาชิก",
    "/register/google": "สมัครด้วย Google",
    "/welcome": "หน้าต้อนรับหลังสมัคร",
    "/library": "คลังข้อสอบของฉัน",
    "/history": "ประวัติการทำข้อสอบ",
    "/history/mistakes": "ข้อที่ต้องทบทวน",
    "/bookmarks": "ข้อที่บันทึกไว้",
    "/account": "บัญชีของฉัน",
    "/orders": "คำสั่งซื้อของฉัน",
    "/orders/[id]": "หน้าคำสั่งซื้อ / ชำระเงิน",
    "/exam/attempts/[id]": "กำลังทำข้อสอบ",
    "/exam/attempts/[id]/review": "ดูเฉลย",
    "/news": "ข่าวสาร",
    "/privacy": "นโยบายความเป็นส่วนตัว",
    "/forgot-password": "ลืมรหัสผ่าน",
    "/reset-password": "ตั้งรหัสผ่านใหม่",
};

export function pageLabel(p: Overview["pages"][number]): string {
    if (p.product_name) {
        // ชนิดหน้าอยู่ "หน้า" ชื่อชุดเสมอ — ชื่อชุดยาวจนถูกตัดด้วย … ถ้าต่อท้ายไว้ หน้าตัวอย่างฟรีกับหน้าชุดจริง
        // จะเหลือข้อความเหมือนกันเป๊ะสองแถว (เจอจากภาพหน้าจอจริง)
        if (p.is_sample) return `ตัวอย่างฟรี · ${p.product_name}`;
        if (p.path.startsWith("/exam/")) return `เลือกโหมด · ${p.product_name}`;
        return p.product_name;
    }
    return PAGE_LABELS[p.path] ?? p.path;
}

/* ───────────── ตัวเลขและวันที่ ───────────── */

export const formatInt = (n: number) => n.toLocaleString("th-TH");

// ป้ายแกนแบบย่อ — 12,400 → 12.4K ให้ตัวเลขไม่ล้นขอบซ้ายของกราฟ
export function formatAxis(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(n);
}

// สร้าง Date จากสตริงแบบ UTC แล้วจัดรูปแบบด้วย timeZone UTC — กันเขตเวลาของเครื่องทำวันเลื่อน
function utcDate(period: string): Date {
    const [y, m = "01", d = "01"] = period.split("-");
    return new Date(Date.UTC(+y, +m - 1, +d));
}
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("th-TH", { ...opts, timeZone: "UTC" });
const DAY_SHORT = fmt({ day: "numeric", month: "short" });
const DAY_FULL = fmt({ day: "numeric", month: "short", year: "numeric" });
const MONTH_SHORT = fmt({ month: "short", year: "2-digit" });
const MONTH_FULL = fmt({ month: "long", year: "numeric" });
const YEAR = fmt({ year: "numeric" });

export function periodLabel(period: string, granularity: Granularity, full = false): string {
    const d = utcDate(period);
    if (granularity === "day") return (full ? DAY_FULL : DAY_SHORT).format(d);
    if (granularity === "month") return (full ? MONTH_FULL : MONTH_SHORT).format(d);
    return YEAR.format(d);
}

export const dateLabel = (iso: string) => DAY_FULL.format(utcDate(iso));

// แกน Y แบบ 4 ช่วง ที่ทุกเส้นตารางตกบนจำนวนเต็มจริง — เลือก "ระยะห่าง" ให้กลมก่อน (1/2/5 × กำลังสิบ)
// แล้วค่อยได้เพดาน = ระยะห่าง × 4 (ถ้าปัดเพดานก่อนแล้วหาร 4 เช่นเพดาน 5 จะได้เส้นที่ 1.25, 2.5 ซึ่งป้ายที่
// ปัดเป็น "1", "3" จะบอกค่าไม่ตรงกับตำแหน่งเส้นจริง — จำนวนคนต้องเป็นจำนวนเต็มเสมอ)
export const Y_STEPS = 4;
export function niceScale(max: number): { yMax: number; step: number } {
    const raw = max / Y_STEPS;
    if (raw <= 1) return { yMax: Y_STEPS, step: 1 };
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const normalized = raw / magnitude;
    // 2.5 ใช้ได้เฉพาะหลักสิบขึ้นไป (25, 250, ...) ที่ยังเป็นจำนวนเต็ม — กันเพดานเกินจริงเป็นเท่าตัว เช่น 99 → 100 ไม่ใช่ 200
    const allow25 = magnitude >= 10;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : allow25 && normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    const step = nice * magnitude;
    return { yMax: step * Y_STEPS, step };
}

export const percent = (part: number, whole: number, digits = 0) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(digits)}%` : "—";
