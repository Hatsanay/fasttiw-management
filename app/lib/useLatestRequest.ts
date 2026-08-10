import { useCallback, useRef } from "react";

// กัน response จาก request เก่ามาทับ state ทีหลัง request ใหม่กว่า (เช่น พิมพ์ค้นหาเร็วๆ หรือกดเปลี่ยน
// หน้า/ลบรายการซ้อนกันจนสอง fetch ค้างพร้อมกัน แล้ว response ของ request แรกดันมาถึงทีหลัง request ที่สอง)
// เรียก begin() ทุกครั้งก่อนเริ่ม fetch ใหม่ ได้ token กลับมา แล้วเช็ค isCurrent(token) ก่อน apply ผลลัพธ์ —
// ถ้าไม่ current แปลว่ามี reload() ใหม่กว่าเริ่มไปแล้วระหว่างที่ request นี้ยังไม่เสร็จ ให้ทิ้งผลลัพธ์นี้ไปเงียบๆ
export function useLatestRequest() {
    const counter = useRef(0);
    const begin = useCallback(() => ++counter.current, []);
    const isCurrent = useCallback((token: number) => token === counter.current, []);
    return { begin, isCurrent };
}
