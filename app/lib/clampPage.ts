// คืนหมายเลขหน้าที่ "มีข้อมูลจริง" ที่ใกล้ที่สุดกับหน้าปัจจุบัน — ใช้หลังลบรายการแล้ว total ลดลงจนหน้า
// ปัจจุบันเกินขอบเขต (เช่น อยู่หน้าสุดท้ายที่มี 1 รายการ ลบรายการนั้นทิ้ง หน้าเดิมจะว่างเปล่าทั้งที่ยังมี
// รายการอื่นอยู่หน้าก่อนหน้า) pageSize === -1 หมายถึง "แสดงทั้งหมด" ไม่มีแนวคิดหน้าเลยเสมอคืน 1
export function clampPage(total: number, pageSize: number, page: number): number {
    if (pageSize === -1 || total === 0) return 1;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    return Math.min(page, lastPage);
}
