"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type Props = {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
};

// footer สำหรับ paging รายการที่ไม่ได้อยู่ในรูปตาราง (เช่น การ์ดคำถามในหน้า products/questions)
// ดีไซน์ตาม pagination footer เดียวกับ DataTable เพื่อความสม่ำเสมอ แต่แยกไฟล์เพราะ DataTable
// ผูกกับโครงสร้างตาราง (rows/columns) ใช้กับ layout แบบการ์ดตรงๆ ไม่ได้
export default function Pagination({
    page,
    pageSize,
    total,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: Props) {
    const showAll = pageSize === -1;
    const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = total === 0 ? 0 : showAll ? 1 : (safePage - 1) * pageSize + 1;
    const to = showAll ? total : Math.min(safePage * pageSize, total);

    const pageNumbers = useMemo(() => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safePage > 3) pages.push("...");
            for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
            if (safePage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, safePage]);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 border-t border-gray-100 bg-gray-50/80 rounded-b-xl">
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                    {total === 0 ? "ไม่มีข้อมูล" : `${from}–${to} จาก ${total} รายการ`}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400">แถวต่อหน้า</span>
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer transition"
                    >
                        {pageSizeOptions.map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                        <option value={-1}>ทั้งหมด</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center gap-0.5 flex-wrap">
                <button
                    onClick={() => onPageChange(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map((p, i) =>
                    p === "..." ? (
                        <span key={`e-${i}`} className="w-8 text-center text-gray-400 text-sm">…</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={[
                                "min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition",
                                safePage === p ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
                            ].join(" ")}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
