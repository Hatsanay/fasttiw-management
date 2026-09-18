import { api } from "@/app/constans";
import { authHeader } from "./auth";

// name/category แยกไว้ให้ผู้เรียกที่ต้องใช้ค่าดิบ (เช่น เก็บลง state) — ห้ามแยกเอาเองจาก label ด้วยการตัดสตริง
// เพราะชื่อหัวข้อมีตัวคั่นปนอยู่ได้ · SearchableSelect ใช้แค่ value/label เหมือนเดิม
export type SelectOption = { value: string; label: string; name?: string; category?: string | null };

// ใช้กับ SearchableSelect ตอนเลือกหมวดหมู่ชุดข้อสอบ (product create/edit, topic create/edit)
export async function loadCategoryOptions(search: string): Promise<SelectOption[]> {
    const res = await fetch(
        `${api}/categories?${new URLSearchParams({ limit: "20", offset: "0", status: "active", search })}`,
        { headers: authHeader() }
    );
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { cat_id: string; cat_name: string }[] };
    return data.map((c) => ({ value: c.cat_id, label: c.cat_name }));
}

// ใช้กับ SearchableSelect ตอนเลือกหมวดหมู่คำถาม — สโคปด้วย categoryId ของ product นั้นเสมอ
// (ตรงกับ logic ฝั่ง backend ที่ผูกหมวดหมู่คำถามเข้ากับหมวดหมู่ชุดข้อสอบ) categoryId ว่างได้ถ้า
// product ยังไม่ได้เลือกหมวดหมู่ — จะคืนหัวข้อทั้งหมดแทนการกรอง
// withCategory: ใส่ชื่อหมวดหมู่กำกับท้ายชื่อหัวข้อ — จำเป็นตอนเลือกข้ามหมวด (เช่น สนามสอบเสมือน)
// เพราะหัวข้อชื่อซ้ำกันได้ข้ามหมวด ("วิชาภาษาอังกฤษ" มีได้ทุกหมวด) แล้วในรายการจะแยกไม่ออกว่าอันไหนของหมวดไหน
export async function loadTopicOptions(
    categoryId: string | null | undefined,
    search: string,
    options: { withCategory?: boolean } = {}
): Promise<SelectOption[]> {
    const query = new URLSearchParams({ limit: "20", offset: "0", status: "active", search });
    if (categoryId) query.set("category_id", categoryId);
    const res = await fetch(`${api}/topics?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { tpc_id: string; tpc_name: string; tpc_category_name: string | null }[] };
    return data.map((t) => ({
        value: t.tpc_id,
        label: options.withCategory && t.tpc_category_name ? `${t.tpc_name} · ${t.tpc_category_name}` : t.tpc_name,
        name: t.tpc_name,
        category: t.tpc_category_name,
    }));
}
