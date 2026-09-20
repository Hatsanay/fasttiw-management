"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// แท็บสลับหน้า log (2026-09-20) — เมนูซ้ายมีรายการเดียวคือ "ประวัติระบบ" โดยตั้งใจ
// (จำนวนรายการเมนูผูกกับตำแหน่ง bit สิทธิ์แบบหนึ่งต่อหนึ่ง การเพิ่มเมนูใหม่ = ต้องเพิ่ม bit ใหม่ทุกครั้ง)
// สามหน้านี้เป็นเรื่องเดียวกัน (ร่องรอยการใช้งานระบบ) จึงรวมไว้ใต้สิทธิ์เดียวแล้วสลับด้วยแท็บแทน
const TABS = [
    { href: "/settings/audit-logs", label: "การแก้ไขข้อมูล" },
    { href: "/settings/error-logs", label: "ข้อผิดพลาดของระบบ" },
    { href: "/settings/logs", label: "การเข้าสู่ระบบ" },
];

export default function LogTabs() {
    const pathname = usePathname();
    return (
        <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
            {TABS.map((tab) => {
                const active = pathname === tab.href;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                            active
                                ? "border-blue-500 font-medium text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
