"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { toDateInput } from "@/app/lib/date";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { formatBaht } from "@/app/function";
import { TrendingUp, TrendingDown, Wallet, Scale, Package, Percent, Receipt, PiggyBank } from "lucide-react";

type ExpenseByCategory = { excat_id: string; excat_name: string; total: number };

type PartnerRetained = { user_id: string; fullname: string; share_percent: number; theoretical_share: number; total_paid: number };
type RetainedEarnings = {
    total_profit: number;
    total_reserve: number;
    reserve_cap: number;
    reserve_remaining: number;
    total_distributed: number;
    retained_earnings: number;
    dividend_percent: number;
    by_partner: PartnerRetained[];
};

type Summary = {
    revenue: number;
    expenses: number;
    commission: number;
    gateway_fee: number;
    profit: number;
    sale_count: number;
    expense_count: number;
    expense_by_category: ExpenseByCategory[];
};

type ByProductRow = {
    prod_id: string;
    prod_name: string;
    revenue: number;
    commission: number;
    expenses: number;
    profit: number;
};

type ViewKey = "overview" | "by_product";
type PresetKey = "this_month" | "last_month" | "this_year" | "custom";


// ช่วงวันที่ตามปุ่มลัด — คำนวณจากเวลาเครื่อง client ตอนกดปุ่ม (พอสำหรับรายงานสรุป ไม่ต้องเป๊ะระดับ timezone)
function presetRange(preset: PresetKey): { from: string; to: string } {
    const now = new Date();
    if (preset === "this_month") {
        return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
    }
    if (preset === "last_month") {
        return {
            from: toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            to: toDateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
    }
    if (preset === "this_year") {
        return { from: toDateInput(new Date(now.getFullYear(), 0, 1)), to: toDateInput(now) };
    }
    return { from: "", to: "" };
}

const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
    { value: "this_month", label: "เดือนนี้" },
    { value: "last_month", label: "เดือนที่แล้ว" },
    { value: "this_year", label: "ปีนี้" },
    { value: "custom", label: "กำหนดเอง" },
];

async function fetchSummary(from: string, to: string): Promise<Summary | null> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const res = await fetch(`${api}/reports/summary?${query}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function fetchRetainedEarnings(): Promise<RetainedEarnings | null> {
    const res = await fetch(`${api}/reports/retained-earnings`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function fetchByProduct(from: string, to: string): Promise<ByProductRow[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const res = await fetch(`${api}/reports/by-product?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: ByProductRow[] };
    return data;
}

export default function ReportsPage() {
    const [isPending, startTransition] = useTransition();
    const [view, setView] = useState<ViewKey>("overview");
    const [preset, setPreset] = useState<PresetKey>("this_month");
    // lazy initializer แทนการ setState ในเอฟเฟกต์ตอน mount (กัน cascading render) — ตั้งค่าช่วงวันที่เริ่มต้น
    // ตาม preset "เดือนนี้" ทันทีตอนเปิดหน้าครั้งแรก
    const [from, setFrom] = useState(() => presetRange("this_month").from);
    const [to, setTo] = useState(() => presetRange("this_month").to);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [byProduct, setByProduct] = useState<ByProductRow[] | null>(null);
    const [retained, setRetained] = useState<RetainedEarnings | null>(null);

    const { begin, isCurrent } = useLatestRequest();

    // กำไรสะสมเป็นยอดสะสมทั้งหมด ไม่ขึ้นกับตัวกรองช่วงเวลา ดึงครั้งเดียวตอนเปิดหน้า แยกจาก effect ด้านล่าง
    useEffect(() => {
        fetchRetainedEarnings().then(setRetained);
    }, []);

    useEffect(() => {
        if (!from && !to) return;
        const token = begin();
        startTransition(async () => {
            if (view === "overview") {
                const result = await fetchSummary(from, to);
                if (!isCurrent(token)) return;
                setSummary(result);
            } else {
                const result = await fetchByProduct(from, to);
                if (!isCurrent(token)) return;
                setByProduct(result);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to, view]);

    function handlePresetChange(value: PresetKey) {
        setPreset(value);
        if (value !== "custom") {
            const range = presetRange(value);
            setFrom(range.from);
            setTo(range.to);
        }
    }

    const maxCategoryTotal = summary?.expense_by_category.length
        ? Math.max(...summary.expense_by_category.map((c) => Number(c.total)))
        : 0;

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">รายงานการเงิน</h1>
            <p className="text-sm text-gray-400 mb-4">สรุปรายได้ ค่าใช้จ่าย และกำไรสุทธิ ตามช่วงเวลาที่เลือก</p>

            {/* กำไรสะสมทั้งบริษัท — ยอดสะสมทั้งหมด ไม่ขึ้นกับตัวกรองช่วงเวลาด้านล่าง ตั้งใจแยกให้ชัดจากการ์ด
                สรุปด้านล่างที่กรองตามช่วงเวลา กันสับสนว่าเป็นตัวเลขคนละความหมายกัน */}
            {retained && (
                <div className="bg-linear-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-5 mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <PiggyBank className="w-4 h-4 text-blue-500" />
                        <h2 className="text-sm font-semibold text-gray-700">กำไรสะสมทั้งบริษัท</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">ยอดสะสมทั้งหมดตั้งแต่เริ่มกิจการ ไม่ขึ้นกับตัวกรองช่วงเวลาด้านล่าง</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <p className="text-xs text-gray-400">กำไรสุทธิสะสม</p>
                            <p className="text-lg font-bold text-gray-800">{formatBaht(retained.total_profit)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">ทุนสำรองตามกฎหมาย (สะสม)</p>
                            <p className="text-lg font-bold text-amber-600">{formatBaht(retained.total_reserve)}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                เพดาน {formatBaht(retained.reserve_cap)} — เหลือกันได้อีก {formatBaht(retained.reserve_remaining)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">จ่ายส่วนแบ่งหุ้นส่วนไปแล้ว</p>
                            <p className="text-lg font-bold text-red-500">{formatBaht(retained.total_distributed)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">กำไรสะสมคงเหลือ</p>
                            <p className={`text-lg font-bold ${retained.retained_earnings >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                {formatBaht(retained.retained_earnings)}
                            </p>
                        </div>
                    </div>

                    {retained.by_partner.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-blue-100 text-gray-400">
                                        <th className="text-left font-medium py-1.5">หุ้นส่วน</th>
                                        <th className="text-right font-medium py-1.5">สัดส่วนหุ้น</th>
                                        <th className="text-right font-medium py-1.5">ควรได้ตามนโยบายปันผล {retained.dividend_percent}% (สะสม)</th>
                                        <th className="text-right font-medium py-1.5">จ่ายจริงไปแล้ว</th>
                                        <th className="text-right font-medium py-1.5">ส่วนต่าง</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {retained.by_partner.map((p) => {
                                        const diff = p.theoretical_share - p.total_paid;
                                        return (
                                            <tr key={p.user_id} className="border-b border-blue-50 last:border-0">
                                                <td className="py-1.5 text-gray-700">{p.fullname}</td>
                                                <td className="py-1.5 text-right text-gray-500">{p.share_percent}%</td>
                                                <td className="py-1.5 text-right text-gray-500">{formatBaht(p.theoretical_share)}</td>
                                                <td className="py-1.5 text-right text-gray-500">{formatBaht(p.total_paid)}</td>
                                                <td className={`py-1.5 text-right font-medium ${diff >= 0 ? "text-amber-600" : "text-gray-400"}`}>
                                                    {formatBaht(diff)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* สลับมุมมอง: ภาพรวมทั้งหมด vs แยกตามชุดข้อสอบ */}
            <div className="flex items-center gap-1.5 mb-4">
                <button
                    type="button"
                    onClick={() => setView("overview")}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                        view === "overview" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    ภาพรวม
                </button>
                <button
                    type="button"
                    onClick={() => setView("by_product")}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                        view === "by_product" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                    แยกตามชุดข้อสอบ
                </button>
            </div>

            {/* ตัวกรองช่วงเวลา */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_OPTIONS.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => handlePresetChange(o.value)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                                preset === o.value ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                {preset === "custom" && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                        <span className="text-sm text-gray-400">ถึง</span>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                    </div>
                )}
            </div>

            {isPending || (view === "overview" ? !summary : !byProduct) ? (
                <p className="text-sm text-gray-400 py-10 text-center">กำลังโหลด...</p>
            ) : view === "by_product" ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 pt-5">
                        <Package className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-700">รายได้ / กำไร แยกตามชุดข้อสอบ</h2>
                    </div>

                    {byProduct!.length === 0 ? (
                        <p className="text-sm text-gray-400 py-10 text-center pb-5">ไม่มีความเคลื่อนไหวของชุดข้อสอบไหนในช่วงเวลานี้</p>
                    ) : (
                        <div className="overflow-x-auto mt-4 pb-2">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-400">
                                        <th className="text-left font-medium px-5 py-2">ชุดข้อสอบ</th>
                                        <th className="text-right font-medium px-5 py-2">รายได้</th>
                                        <th className="text-right font-medium px-5 py-2">ค่าใช้จ่าย</th>
                                        <th className="text-right font-medium px-5 py-2">ค่าคอม</th>
                                        <th className="text-right font-medium px-5 py-2">กำไร</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byProduct!.map((p) => (
                                        <tr key={p.prod_id} className="border-b border-gray-50 last:border-0">
                                            <td className="px-5 py-3 text-gray-700">{p.prod_name}</td>
                                            <td className="px-5 py-3 text-right text-green-600">{formatBaht(p.revenue)}</td>
                                            <td className="px-5 py-3 text-right text-red-500">{formatBaht(p.expenses)}</td>
                                            <td className="px-5 py-3 text-right text-amber-500">{formatBaht(p.commission)}</td>
                                            <td className={`px-5 py-3 text-right font-medium ${p.profit >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                                {formatBaht(p.profit)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (() => {
                const s = summary!;
                return (
                <>
                    {/* การ์ดสรุป */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                <span className="text-sm">รายได้รวม</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{formatBaht(s.revenue)}</p>
                            <p className="text-xs text-gray-400 mt-1">{s.sale_count} รายการขาย</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <TrendingDown className="w-4 h-4 text-red-500" />
                                <span className="text-sm">ค่าใช้จ่ายรวม</span>
                            </div>
                            <p className="text-2xl font-bold text-red-500">{formatBaht(s.expenses)}</p>
                            <p className="text-xs text-gray-400 mt-1">{s.expense_count} รายการ</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <Percent className="w-4 h-4 text-amber-500" />
                                <span className="text-sm">ค่าคอมมิชชั่นรวม</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-500">{formatBaht(s.commission)}</p>
                            <p className="text-xs text-gray-400 mt-1">หักจากกำไรแล้ว</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <Receipt className="w-4 h-4 text-orange-500" />
                                <span className="text-sm">ค่าธรรมเนียม payment gateway</span>
                            </div>
                            <p className="text-2xl font-bold text-orange-500">{formatBaht(s.gateway_fee)}</p>
                            <p className="text-xs text-gray-400 mt-1">หักจากกำไรแล้ว</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex items-center gap-2 text-gray-400 mb-2">
                                <Scale className="w-4 h-4 text-blue-500" />
                                <span className="text-sm">กำไรสุทธิ</span>
                            </div>
                            <p className={`text-2xl font-bold ${s.profit >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                {formatBaht(s.profit)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">รายได้ − ค่าใช้จ่าย − ค่าคอม − ค่าธรรมเนียม gateway</p>
                        </div>
                    </div>

                    {/* ค่าใช้จ่ายแยกตามหมวดหมู่ */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Wallet className="w-4 h-4 text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-700">ค่าใช้จ่ายแยกตามหมวดหมู่</h2>
                        </div>

                        {s.expense_by_category.length === 0 ? (
                            <p className="text-sm text-gray-400 py-4 text-center">ไม่มีค่าใช้จ่ายในช่วงเวลานี้</p>
                        ) : (
                            <div className="space-y-3">
                                {s.expense_by_category.map((c) => (
                                    <div key={c.excat_id}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-gray-700">{c.excat_name}</span>
                                            <span className="text-gray-500">{formatBaht(Number(c.total))}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-400 rounded-full"
                                                style={{ width: `${maxCategoryTotal ? (Number(c.total) / maxCategoryTotal) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
                );
            })()}
        </div>
    );
}
