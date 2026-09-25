// เลือก backend ตามโหมดเอง — ไม่ต้องสลับบรรทัดก่อน deploy อีก (เดิมต้องแก้มือ แล้ว deploy 2026-09-15 21:13 หลุด
// localhost ขึ้น production ไป แอดมิน login ไม่ได้ทั้งระบบ: Server Action บนเซิร์ฟเวอร์ต่อ localhost:3003 ไม่ติด)
// next build (production) = โดเมนจริง / next dev = เครื่องตัวเอง · ตั้ง NEXT_PUBLIC_API_URL ทับได้ถ้าจำเป็น
// NODE_ENV และ NEXT_PUBLIC_* ถูกฝังตอน build ทั้งฝั่ง server และ client เหมือนกัน
const backendUrl = process.env.NEXT_PUBLIC_API_URL
    ?? (process.env.NODE_ENV === "production"
        ? "https://fasttiwbackend.fasttiw.com/api/V1" // production (ย้ายจาก dktimeh.com แล้ว)
        : "http://localhost:3003/api/V1");

// URL ของ backend แบบแยกส่วน — ใช้ประกอบลิงก์รูปจาก /uploads และใช้ใน Route Handler ที่ต้องยิง backend ตรง
// (ฝั่ง browser `api` เป็น path สัมพัทธ์แล้ว ใช้ new URL(api) ไม่ได้ จึง export ค่าที่แยกไว้ให้ใช้แทน)
const apiOrigin = new URL(backendUrl).origin;
// ตัด "/" ท้ายออกเสมอ — ถ้า NEXT_PUBLIC_API_URL ถูกตั้งแบบมี "/" ปิดท้าย ปลายทางจะกลายเป็น ".../V1//users"
// ซึ่ง backend หา route ไม่เจอ หน้าแอดมินเรียก API ไม่ได้ทั้งหมด (เวอร์ชัน 2026-09-20 มีบรรทัดนี้ แล้วหลุดหายไปทีหลัง)
const apiBasePath = new URL(backendUrl).pathname.replace(/\/$/, "");

// **ฝั่ง server ยิง backend ตรง / ฝั่ง browser ยิงผ่านตัวกลาง `/api/be`** (2026-09-20)
// ตัวกลางเป็นคนแนบ token จาก cookie httpOnly ให้ — JS ในเบราว์เซอร์จึงไม่เคยถือ token เลย
// (ดูเหตุผลเต็มที่ app/api/be/[...path]/route.ts และ CLAUDE.md ข้อ 6.2.3)
// ห้ามเปลี่ยนกลับเป็น backendUrl เฉยๆ — `authHeader()` คืน object ว่างแล้ว ทุกหน้าจะได้ 401 ทันที
const api = typeof window === "undefined" ? backendUrl : "/api/be";

const theme = {
    sidebar: {
        bg:           "bg-white",
        border:       "border-r border-blue-100",
        headerBorder: "border-b border-blue-100",
        brandText:    "text-blue-600",
        brandIconBg:  "bg-blue-500",
        activeItem:   "bg-blue-500 text-white shadow-sm shadow-blue-200",
        inactiveItem: "text-gray-500 hover:bg-blue-50 hover:text-blue-600",
        tooltip:      "bg-blue-600 text-white",
        tooltipArrow: "border-r-blue-600",
        toggleBtn:    "border border-blue-200 bg-white text-blue-400 shadow-md hover:bg-blue-500 hover:text-white hover:border-blue-500",
    },
    navbar: {
        bg:          "bg-white border-b border-gray-200",
        brandText:   "text-blue-600",
        userText:    "text-gray-600",
        logoutText:  "text-red-500 hover:text-red-700",
        textNavbar: "text-gray-600 hover:text-gray-800",
    },
} as const;

export { api, apiOrigin, apiBasePath, theme };
