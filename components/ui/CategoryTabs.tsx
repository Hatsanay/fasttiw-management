"use client";

type Category = { cat_id: string; cat_name: string };

type Props = {
    categories: Category[];
    value: string;
    onChange: (categoryId: string) => void;
    allLabel?: string;
};

// แถบปุ่มกรองตามหมวดหมู่ (pill tabs) — เริ่มใช้ที่หน้า /products แต่แยกเป็น component
// เพราะเป็น pattern ที่มีโอกาสใช้ซ้ำกับ list อื่นที่กรองตามหมวดหมู่ได้เหมือนกัน
export default function CategoryTabs({ categories, value, onChange, allLabel = "ทั้งหมด" }: Props) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
                onClick={() => onChange("")}
                className={`shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    value === "" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
                {allLabel}
            </button>
            {categories.map((c) => (
                <button
                    key={c.cat_id}
                    onClick={() => onChange(c.cat_id)}
                    className={`shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                        value === c.cat_id ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    {c.cat_name}
                </button>
            ))}
        </div>
    );
}
