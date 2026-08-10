// อ่าน token จาก localStorage แปะเป็น Authorization header — ใช้ร่วมกันทุกหน้าที่เรียก API
// แบบ client-side fetch (แยกจาก cookie ที่ server component ใช้ตอน SSR)
export function authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}
