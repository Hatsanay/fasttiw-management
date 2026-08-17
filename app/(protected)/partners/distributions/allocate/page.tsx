"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { toDateInput } from "@/app/lib/date";
import { formatBaht } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import { toast } from "sonner";

type PartnerPreview = {
    user_id: string;
    fullname: string;
    share_percent: number;
    gross_amount: number;
    tax_amount: number;
    net_amount: number;
};

type AllocationPreview = {
    period_profit: number;
    reserve_percent: number;
    reserve_amount: number;
    reserve_capped: boolean;
    dividend_percent: number;
    dividend_amount: number;
    withholding_tax_percent: number;
    total_share_percent: number;
    distributions: PartnerPreview[];
};

type PresetKey = "this_month" | "last_month" | "this_year" | "all_time" | "custom";

function presetRange(preset: PresetKey): { from: string; to: string } {
    const now = new Date();
    if (preset === "this_month") return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
    if (preset === "last_month") {
        return {
            from: toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            to: toDateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
    }
    if (preset === "this_year") return { from: toDateInput(new Date(now.getFullYear(), 0, 1)), to: toDateInput(now) };
    return { from: "", to: "" };
}

const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
    { value: "this_month", label: "เดือนนี้" },
    { value: "last_month", label: "เดือนที่แล้ว" },
    { value: "this_year", label: "ปีนี้" },
    { value: "all_time", label: "ทั้งหมดตั้งแต่เริ่ม" },
    { value: "custom", label: "กำหนดเอง" },
];

export default function AllocateProfitPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isConfirming, setIsConfirming] = useState(false);

    const [preset, setPreset] = useState<PresetKey>("this_month");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [note, setNote] = useState("");
    const [preview, setPreview] = useState<AllocationPreview | null>(null);
    const [error, setError] = useState<string | null>(null);

    function handlePresetChange(value: PresetKey) {
        setPreset(value);
        setPreview(null);
        if (value !== "custom") {
            const range = presetRange(value);
            setFrom(range.from);
            setTo(range.to);
        }
    }

    function handleCalculate() {
        setError(null);
        setPreview(null);
        startTransition(async () => {
            const query = new URLSearchParams();
            if (from) query.set("period_from", from);
            if (to) query.set("period_to", to);
            const res = await fetch(`${api}/profit-allocations/preview?${query}`, { headers: authHeader() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message ?? "คำนวณไม่สำเร็จ กรุณาลองใหม่");
                return;
            }
            setPreview(data);
        });
    }

    async function handleConfirm() {
        setIsConfirming(true);
        try {
            const res = await fetch(`${api}/profit-allocations`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ period_from: from || null, period_to: to || null, note: note || null }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message ?? "จัดสรรกำไรไม่สำเร็จ กรุณาลองใหม่");
                return;
            }
            toast.success("จัดสรรกำไรสำเร็จ");
            router.push("/partners/distributions");
        } finally {
            setIsConfirming(false);
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">จัดสรรกำไร</h1>
            <p className="text-sm text-gray-400 mb-6">
                เลือกช่วงเวลาที่จะคำนวณกำไร ระบบจะกันทุนสำรองตามกฎหมายและประกาศจ่ายปันผลตามสัดส่วนหุ้นให้อัตโนมัติตามที่ตั้งค่าไว้ที่{" "}
                <a href="/settings/dividend" className="text-blue-600 hover:underline">หน้าตั้งค่าการจัดสรรกำไร</a>
            </p>

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
                            type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                        <span className="text-sm text-gray-400">ถึง</span>
                        <input
                            type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                    </div>
                )}
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    placeholder="ไม่บังคับ"
                />
            </div>

            <Button onClick={handleCalculate} disabled={isPending} className="mb-6">
                {isPending ? "กำลังคำนวณ..." : "คำนวณ"}
            </Button>

            {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

            {preview && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">ตัวอย่างผลการจัดสรร</h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5 text-sm">
                        <div>
                            <p className="text-xs text-gray-400">กำไรงวดที่เลือก</p>
                            <p className="font-semibold text-gray-800">{formatBaht(preview.period_profit)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">ทุนสำรอง ({preview.reserve_percent}%)</p>
                            <p className="font-semibold text-gray-800">{formatBaht(preview.reserve_amount)}</p>
                            {preview.reserve_capped && (
                                <p className="text-xs text-amber-600 mt-0.5">ชนเพดานทุนสำรองตามกฎหมาย กันได้น้อยกว่า % ที่ตั้งไว้</p>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">เงินปันผลรวม ({preview.dividend_percent}%)</p>
                            <p className="font-semibold text-gray-800">{formatBaht(preview.dividend_amount)}</p>
                        </div>
                    </div>

                    {preview.total_share_percent !== 100 && (
                        <p className="text-xs text-red-500 mb-4">
                            รวมสัดส่วนหุ้นของหุ้นส่วนทั้งหมดตอนนี้ = {preview.total_share_percent}% (ไม่ครบ 100%)
                            {preview.total_share_percent > 100
                                ? " — เงินปันผลที่แจกจะเกินยอดที่ประกาศจ่ายจริง กรุณาแก้ไขสัดส่วนหุ้นที่หน้าหุ้นส่วนก่อนยืนยัน"
                                : " — จะมีเงินปันผลส่วนที่เหลือไม่ถูกแจกให้ใคร กรุณาตรวจสอบสัดส่วนหุ้นที่หน้าหุ้นส่วนก่อนยืนยัน"}
                        </p>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-400">
                                    <th className="text-left font-medium px-2 py-2">หุ้นส่วน</th>
                                    <th className="text-right font-medium px-2 py-2">สัดส่วนหุ้น</th>
                                    <th className="text-right font-medium px-2 py-2">ยอดประกาศจ่าย</th>
                                    <th className="text-right font-medium px-2 py-2">หักภาษี ({preview.withholding_tax_percent}%)</th>
                                    <th className="text-right font-medium px-2 py-2">รับจริง</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.distributions.map((p) => (
                                    <tr key={p.user_id} className="border-b border-gray-50 last:border-0">
                                        <td className="px-2 py-2 text-gray-700">{p.fullname}</td>
                                        <td className="px-2 py-2 text-right text-gray-500">{p.share_percent}%</td>
                                        <td className="px-2 py-2 text-right text-gray-700">{formatBaht(p.gross_amount)}</td>
                                        <td className="px-2 py-2 text-right text-red-500">-{formatBaht(p.tax_amount)}</td>
                                        <td className="px-2 py-2 text-right font-medium text-blue-600">{formatBaht(p.net_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-gray-400 mt-4">
                        ยอดข้างต้นเป็นการคำนวณล่วงหน้า ยังไม่บันทึกอะไรลงระบบ — กดยืนยันด้านล่างเพื่อบันทึกจริง (กำไรสะสมจะถูกหักทันทีตอนยืนยัน ไม่ต้องรอจ่ายเงินจริงให้หุ้นส่วน)
                    </p>

                    <div className="flex justify-end mt-4">
                        <Button onClick={handleConfirm} disabled={isConfirming}>
                            {isConfirming ? "กำลังบันทึก..." : "ยืนยันจัดสรร"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
