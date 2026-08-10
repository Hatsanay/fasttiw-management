"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import PeriodFilter, { PeriodRange } from "@/app/components/PeriodFilter";
import { Activity } from "lucide-react";

type TrendPoint = { date: string; revenue: number; sale_count: number };

async function fetchTrend(range: PeriodRange): Promise<TrendPoint[]> {
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    const res = await fetch(`${api}/reports/daily-sales-trend?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: TrendPoint[] };
    return data;
}

function formatShortDate(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${Number(d)}/${Number(m)}`;
}

// ปัดเพดานแกน Y ให้เป็นเลขกลมๆ (1/2/5 × กำลังสิบ) แทนที่จะหารจาก max ดิบตรงๆ
function niceMax(max: number): number {
    if (max <= 0) return 100;
    const magnitude = 10 ** Math.floor(Math.log10(max));
    const normalized = max / magnitude;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const SERIES_COLOR = "#2a78d6";

// กราฟเส้นแนวโน้มยอดขายรายวัน เขียน SVG มือเอง (ไม่มี charting library ในโปรเจกต์นี้) — มี PeriodFilter
// เดียวกับ widget อื่นๆ ให้ดูย้อนหลังไปช่วงอื่นได้ ไม่ตายตัวที่ 30 วันล่าสุดเหมือนตอนแรก (backend จำกัดช่วง
// กว้างสุด 366 วัน กันกราฟแน่นเกินไปโดยไม่ตั้งใจ) — ยึดสเปกจาก skill dataviz: เส้น 2px, จุดปลายกลม 4px
// ขอบสีพื้นหลังกันกลืนเส้น, gridline hairline สีอ่อนไม่แย่งความสนใจ, crosshair+tooltip ตามเมาส์ (ซีรีส์เดียว
// ไม่ต้องมี legend เพราะหัวข้อบอกอยู่แล้ว)
export default function SalesTrendChart() {
    const [isPending, startTransition] = useTransition();
    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [data, setData] = useState<TrendPoint[] | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!range.from && !range.to) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchTrend(range);
            if (!isCurrent(token)) return;
            setData(result);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    const { points, yMax, totalRevenue } = useMemo(() => {
        if (!data || data.length === 0) return { points: [] as { x: number; y: number }[], yMax: 0, totalRevenue: 0 };
        const max = niceMax(Math.max(...data.map((d) => d.revenue)));
        const total = data.reduce((sum, d) => sum + d.revenue, 0);
        const pts = data.map((d, i) => ({
            x: PAD_LEFT + (data.length === 1 ? 0 : (i / (data.length - 1)) * PLOT_WIDTH),
            y: PAD_TOP + PLOT_HEIGHT - (max === 0 ? 0 : (d.revenue / max) * PLOT_HEIGHT),
        }));
        return { points: pts, yMax: max, totalRevenue: total };
    }, [data]);

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath = points.length
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_TOP + PLOT_HEIGHT).toFixed(1)} ` +
          `L ${points[0].x.toFixed(1)} ${(PAD_TOP + PLOT_HEIGHT).toFixed(1)} Z`
        : "";

    function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
        if (!data || data.length === 0 || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const xInSvg = (e.clientX - rect.left) * (WIDTH / rect.width);
        const ratio = Math.min(1, Math.max(0, (xInSvg - PAD_LEFT) / PLOT_WIDTH));
        setHoverIndex(Math.round(ratio * (data.length - 1)));
    }

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        y: PAD_TOP + PLOT_HEIGHT - t * PLOT_HEIGHT,
        value: Math.round(yMax * t),
    }));

    // แสดงป้ายวันที่บางจุดพอ กันตัวหนังสือชนกัน (ทุก ~5-6 จุด + จุดสุดท้ายเสมอ)
    const xLabelStep = data && data.length > 10 ? Math.ceil(data.length / 6) : 1;
    const hovered = hoverIndex !== null && data ? data[hoverIndex] : null;
    const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50">
                        <Activity className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-gray-700">แนวโน้มยอดขายรายวัน</h2>
                </div>
                <PeriodFilter onChange={setRange} />
            </div>

            {isPending || !data ? (
                <p className="text-sm text-gray-400 py-16 text-center">กำลังโหลด...</p>
            ) : data.every((d) => d.revenue === 0) ? (
                <p className="text-sm text-gray-400 py-16 text-center">ไม่มียอดขายในช่วงเวลานี้</p>
            ) : (
                <>
                    <p className="text-xs text-gray-400 mb-3">รวม {formatBaht(totalRevenue)} ในช่วงเวลานี้</p>
                    <div className="relative">
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                            className="w-full h-auto touch-none"
                            onPointerMove={handlePointerMove}
                            onPointerLeave={() => setHoverIndex(null)}
                        >
                            {yTicks.map((t) => (
                                <line key={t.y} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeWidth={1} />
                            ))}
                            {yTicks.map((t) => (
                                <text key={`label-${t.y}`} x={PAD_LEFT - 8} y={t.y + 3} textAnchor="end" fontSize={10} fill="#9ca3af">
                                    {t.value >= 1000 ? `${(t.value / 1000).toFixed(1)}K` : t.value}
                                </text>
                            ))}

                            {data.map((d, i) => (
                                (i % xLabelStep === 0 || i === data.length - 1) && (
                                    <text key={d.date} x={points[i].x} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
                                        {formatShortDate(d.date)}
                                    </text>
                                )
                            ))}

                            <path d={areaPath} fill={SERIES_COLOR} fillOpacity={0.08} stroke="none" />
                            <path d={linePath} fill="none" stroke={SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            {points.length > 0 && (
                                <circle
                                    cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={4}
                                    fill={SERIES_COLOR} stroke="#fff" strokeWidth={2}
                                />
                            )}

                            {hoveredPoint && (
                                <>
                                    <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={PAD_TOP} y2={PAD_TOP + PLOT_HEIGHT} stroke="#c3c2b7" strokeWidth={1} />
                                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={4} fill={SERIES_COLOR} stroke="#fff" strokeWidth={2} />
                                </>
                            )}
                        </svg>

                        {hovered && hoveredPoint && (
                            <div
                                className="absolute pointer-events-none bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full whitespace-nowrap"
                                style={{ left: `${(hoveredPoint.x / WIDTH) * 100}%`, top: `${(hoveredPoint.y / HEIGHT) * 100}%`, marginTop: "-8px" }}
                            >
                                <p className="font-semibold">{formatBaht(hovered.revenue)}</p>
                                <p className="text-gray-300">{formatShortDate(hovered.date)} · {hovered.sale_count} รายการ</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
