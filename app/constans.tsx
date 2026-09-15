// เลือก backend ตามโหมดเอง — ไม่ต้องสลับบรรทัดก่อน deploy อีก (เดิมต้องแก้มือ แล้ว deploy 2026-09-15 21:13 หลุด
// localhost ขึ้น production ไป แอดมิน login ไม่ได้ทั้งระบบ: Server Action บนเซิร์ฟเวอร์ต่อ localhost:3003 ไม่ติด)
// next build (production) = โดเมนจริง / next dev = เครื่องตัวเอง · ตั้ง NEXT_PUBLIC_API_URL ทับได้ถ้าจำเป็น
// NODE_ENV และ NEXT_PUBLIC_* ถูกฝังตอน build ทั้งฝั่ง server และ client เหมือนกัน
const api = process.env.NEXT_PUBLIC_API_URL
    ?? (process.env.NODE_ENV === "production"
        ? "https://fasttiwbackend.fasttiw.com/api/V1" // production (ย้ายจาก dktimeh.com แล้ว)
        : "http://localhost:3003/api/V1");


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

export { api, theme };