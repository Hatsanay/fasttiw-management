"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Table2, LineChart } from "lucide-react";
import { formatAxis, formatInt, niceScale, periodLabel, Y_STEPS, type Granularity, type Overview } from "./labels";

// วาดตามความกว้างจริงของกล่อง (วัดด้วย ResizeObserver) ไม่ย่อ viewBox คงที่ลงมา — ถ้าย่อ 720px ลงจอมือถือ 360px
// ตัวหนังสือบนแกนจะเล็กลงครึ่งหนึ่งเหลือ ~5px อ่านไม่ออก (เจอจากภาพหน้าจอจริง) แบบนี้ตัวหนังสือคงขนาดเดิมทุกจอ
const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 280;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const LABEL_SPACING = 72; // px ต่อป้ายแกนนอนหนึ่งป้าย — จอแคบจึงได้ป้ายน้อยลงเอง ไม่ชนกัน

// ผู้เยี่ยมชมคือเรื่องหลักของหน้า → สีหลัก (ช่องที่ 1 ของชุดสีเดียวกับกราฟยอดขายในแดชบอร์ด) + พื้นจางๆ
// ยอดเปิดหน้าเป็นบริบทประกอบ → เส้นเทาไม่แย่งสายตา ทั้งคู่เป็น "จำนวนครั้ง" หน่วยเดียวกันจึงใช้แกนเดียว
// (ห้ามแยกสองแกน — สเกลสองข้างที่ตั้งเองจะสร้างความสัมพันธ์ที่ไม่มีอยู่จริงในข้อมูล)
const VISITOR_COLOR = "#2a78d6";
const PAGEVIEW_COLOR = "#9ca3af";
const SURFACE = "#ffffff";

type Series = Overview["series"];

export default function VisitorTrendChart({ series, granularity, dimmed }: { series: Series; granularity: Granularity; dimmed: boolean }) {
    const [hover, setHover] = useState<number | null>(null);
    const [showTable, setShowTable] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, [showTable]); // กล่องกราฟถูกสร้างใหม่ทุกครั้งที่สลับกลับจากมุมมองตาราง

    const HEIGHT = width < 500 ? 220 : 260;
    const PLOT_W = width - PAD_LEFT - PAD_RIGHT;
    const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const { visitorPts, pageviewPts, yMax, step } = useMemo(() => {
        const { yMax, step } = niceScale(Math.max(0, ...series.map((s) => s.pageviews)));
        const x = (i: number) => PAD_LEFT + (series.length === 1 ? PLOT_W / 2 : (i / (series.length - 1)) * PLOT_W);
        const y = (v: number) => PAD_TOP + PLOT_H - (v / yMax) * PLOT_H;
        return {
            visitorPts: series.map((s, i) => ({ x: x(i), y: y(s.visitors) })),
            pageviewPts: series.map((s, i) => ({ x: x(i), y: y(s.pageviews) })),
            yMax,
            step,
        };
    }, [series, PLOT_W, PLOT_H]);

    const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + PLOT_H;
    const areaPath = visitorPts.length > 1
        ? `${path(visitorPts)} L${visitorPts.at(-1)!.x.toFixed(1)} ${baseline} L${visitorPts[0].x.toFixed(1)} ${baseline} Z`
        : "";

    // จำนวนป้ายแกนนอนตามความกว้างจริง + ป้ายสุดท้ายเสมอ กันตัวหนังสือชนกัน (ตัวที่ไม่มีป้ายยังดูได้จาก tooltip/ตาราง)
    const maxLabels = Math.max(2, Math.floor(PLOT_W / LABEL_SPACING));
    const labelEvery = series.length > maxLabels ? Math.ceil(series.length / maxLabels) : 1;
    const showLabelAt = (i: number) =>
        i === series.length - 1 || (i % labelEvery === 0 && series.length - 1 - i > labelEvery / 2);

    function indexFromPointer(e: React.PointerEvent<SVGSVGElement>) {
        const rect = svgRef.current!.getBoundingClientRect();
        const xInSvg = (e.clientX - rect.left) * (width / rect.width);
        if (series.length === 1) return 0;
        const ratio = Math.min(1, Math.max(0, (xInSvg - PAD_LEFT) / PLOT_W));
        return Math.round(ratio * (series.length - 1));
    }

    // คีย์บอร์ดได้ข้อมูลเท่ากับเมาส์: Tab เข้ามาที่กราฟ แล้วลูกศรซ้าย/ขวาเลื่อนดูทีละช่วง
    function handleKey(e: React.KeyboardEvent<SVGSVGElement>) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        const last = series.length - 1;
        setHover((h) => {
            if (e.key === "Home") return 0;
            if (e.key === "End") return last;
            const cur = h ?? last;
            return Math.min(last, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1)));
        });
    }

    const hovered = hover !== null ? series[hover] : null;
    const hv = hover !== null ? visitorPts[hover] : null;
    const tooltipLeftPct = hv ? (hv.x / width) * 100 : 0;

    return (
        <div className={`transition-opacity ${dimmed ? "opacity-50" : ""}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                {/* 2 ซีรีส์ = ต้องมีคำอธิบายเสมอ ไม่ให้ต้องเดาจากสีอย่างเดียว — key เป็นเส้นตามรูปทรงของ mark */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: VISITOR_COLOR }} />
                        ผู้เยี่ยมชม
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: PAGEVIEW_COLOR }} />
                        ยอดเปิดหน้า
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowTable((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                    {showTable ? <LineChart className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                    {showTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
                </button>
            </div>

            {showTable ? (
                <div className="max-h-80 overflow-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">ช่วงเวลา</th>
                                <th className="px-3 py-2 text-right font-medium">ผู้เยี่ยมชม</th>
                                <th className="px-3 py-2 text-right font-medium">ยอดเปิดหน้า</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {[...series].reverse().map((s) => (
                                <tr key={s.period} className="border-t border-gray-50">
                                    <td className="px-3 py-1.5 text-gray-600">{periodLabel(s.period, granularity, true)}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-gray-800">{formatInt(s.visitors)}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-500">{formatInt(s.pageviews)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div ref={wrapRef} className="relative">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${width} ${HEIGHT}`}
                        className="h-auto w-full touch-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        role="img"
                        aria-label="กราฟแนวโน้มผู้เยี่ยมชมและยอดเปิดหน้า — กดปุ่มลูกศรซ้ายขวาเพื่อดูทีละช่วง"
                        tabIndex={0}
                        onPointerMove={(e) => setHover(indexFromPointer(e))}
                        onPointerLeave={() => setHover(null)}
                        onKeyDown={handleKey}
                        onBlur={() => setHover(null)}
                    >
                        {Array.from({ length: Y_STEPS + 1 }, (_, i) => {
                            const value = i * step;
                            const y = PAD_TOP + PLOT_H - (value / yMax) * PLOT_H;
                            return (
                                <g key={value}>
                                    <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y} y2={y} stroke="#eef0f3" strokeWidth={1} />
                                    <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#9ca3af" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {formatAxis(value)}
                                    </text>
                                </g>
                            );
                        })}

                        {series.map((s, i) =>
                            showLabelAt(i) ? (
                                <text key={s.period} x={visitorPts[i].x} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
                                    {periodLabel(s.period, granularity)}
                                </text>
                            ) : null
                        )}

                        {areaPath && <path d={areaPath} fill={VISITOR_COLOR} fillOpacity={0.08} />}
                        {series.length > 1 && (
                            <>
                                <path d={path(pageviewPts)} fill="none" stroke={PAGEVIEW_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                <path d={path(visitorPts)} fill="none" stroke={VISITOR_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                            </>
                        )}

                        {/* จุดปลายเส้น (หรือจุดเดียวถ้ามีช่วงเดียว) มีขอบสีพื้น 2px กันกลืนกับอีกเส้น */}
                        {[pageviewPts, visitorPts].map((pts, k) =>
                            pts.length ? (
                                <circle
                                    key={k}
                                    cx={pts.at(-1)!.x}
                                    cy={pts.at(-1)!.y}
                                    r={4}
                                    fill={k ? VISITOR_COLOR : PAGEVIEW_COLOR}
                                    stroke={SURFACE}
                                    strokeWidth={2}
                                />
                            ) : null
                        )}

                        {hover !== null && hv && (
                            <>
                                <line x1={hv.x} x2={hv.x} y1={PAD_TOP} y2={baseline} stroke="#c3c2b7" strokeWidth={1} />
                                <circle cx={pageviewPts[hover].x} cy={pageviewPts[hover].y} r={4} fill={PAGEVIEW_COLOR} stroke={SURFACE} strokeWidth={2} />
                                <circle cx={hv.x} cy={hv.y} r={4} fill={VISITOR_COLOR} stroke={SURFACE} strokeWidth={2} />
                            </>
                        )}
                    </svg>

                    {hovered && hv && (
                        // tooltip เดียวบอกทุกซีรีส์ ณ จุดนั้น — ตัวเลขเด่น ชื่อซีรีส์รอง / ชิดขอบเมื่ออยู่ปลายกราฟ กันล้นจอ
                        <div
                            className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg"
                            style={
                                tooltipLeftPct > 50
                                    ? { right: `${100 - tooltipLeftPct}%`, marginRight: 10 }
                                    : { left: `${tooltipLeftPct}%`, marginLeft: 10 }
                            }
                        >
                            <p className="mb-1 text-gray-300">{periodLabel(hovered.period, granularity, true)}</p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: VISITOR_COLOR }} />
                                <span className="font-semibold tabular-nums">{formatInt(hovered.visitors)}</span>
                                <span className="text-gray-300">ผู้เยี่ยมชม</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: PAGEVIEW_COLOR }} />
                                <span className="font-semibold tabular-nums">{formatInt(hovered.pageviews)}</span>
                                <span className="text-gray-300">ยอดเปิดหน้า</span>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
