// แปลง Date เป็น "YYYY-MM-DD" ตามวันที่ท้องถิ่นของเครื่อง (เวลาไทย) — ห้ามใช้ d.toISOString().slice(0,10)
// เด็ดขาด เพราะ toISOString() แปลงเป็น UTC ก่อนเสมอ ช่วงเที่ยงคืน-7โมงเช้าเวลาไทย (เวลาไทย = UTC+7) วันที่ตาม
// UTC จะยังเป็น "เมื่อวาน" อยู่ ทำให้พรีเซ็ต "วันนี้"/"เดือนนี้" คำนวณผิดเป็นช่วงที่ตัดข้อมูลของ "วันนี้" ทิ้งไป
// (เจอบั๊กจริงจากการทดสอบ — ยอดขายที่เพิ่งเกิดตอนตี 0 กว่าหายไปจากตัวกรอง "เดือนนี้" ในแดชบอร์ด)
export function toDateInput(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// วันเวลาแบบไทย ตรึง timeZone ไว้ที่กรุงเทพฯ เสมอ — เครื่องของแอดมินอาจตั้ง timezone อื่นไว้ (หรือเปิดจาก
// ต่างประเทศ) แล้วเวลาในตารางประวัติจะไม่ตรงกับที่ลูกค้าเห็น ซึ่งทำให้ไล่เหตุการณ์ย้อนหลังผิดตัว
export function thaiDateTime(value: string | null | undefined, { year = false } = {}): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("th-TH", {
        day: "2-digit",
        month: "short",
        ...(year ? { year: "numeric" as const } : {}),
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
    });
}
