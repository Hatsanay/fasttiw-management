"use client";

import { Search } from "lucide-react";

type Props = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
};

// กล่องค้นหาแบบเดียวกับที่ DataTable ใช้ภายใน — แยกเป็น component ให้หน้าที่ไม่ได้ใช้ DataTable
// (เช่น layout แบบการ์ด) เรียกใช้ร่วมกันได้ ไม่ต้อง copy JSX ซ้ำทุกหน้า
export default function SearchInput({ value, onChange, placeholder = "ค้นหา...", className = "w-full sm:w-72" }: Props) {
    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
        </div>
    );
}
