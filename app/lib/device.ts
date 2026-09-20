// user-agent เต็มๆ อ่านไม่รู้เรื่องสำหรับคนทั่วไป — ตัดเหลือเท่าที่ดูออกว่า "เครื่องไหน"
// ใช้ร่วมกันทุกหน้าที่แสดงอุปกรณ์ (อุปกรณ์ที่ล็อกอินอยู่ / ประวัติการเข้าสู่ระบบของลูกค้า)
// ต้องให้ผลตรงกับ deviceKey() ฝั่ง backend ที่ใช้จับกลุ่มอุปกรณ์เวลาคิดสัญญาณการแชร์บัญชี
export function deviceLabel(ua: string | null | undefined): string {
    if (!ua) return "ไม่ทราบอุปกรณ์";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
        : /Safari\//.test(ua) ? "Safari" : "เบราว์เซอร์อื่น";
    const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS"
        : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    return [browser, os].filter(Boolean).join(" · ");
}
