import { api } from "@/app/constans";
import { authHeader } from "./auth";

export type SelectOption = { value: string; label: string };

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
export async function loadTopicOptions(categoryId: string | null | undefined, search: string): Promise<SelectOption[]> {
    const query = new URLSearchParams({ limit: "20", offset: "0", status: "active", search });
    if (categoryId) query.set("category_id", categoryId);
    const res = await fetch(`${api}/topics?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { tpc_id: string; tpc_name: string }[] };
    return data.map((t) => ({ value: t.tpc_id, label: t.tpc_name }));
}
