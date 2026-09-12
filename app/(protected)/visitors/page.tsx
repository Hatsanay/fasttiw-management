"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, Users, FileStack, Layers, TrendingUp, TrendingDown, Info } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { BITS, usePermission } from "@/app/components/permission-provider";
import PeriodFilter, { type PeriodPreset, type PeriodRange } from "@/app/components/PeriodFilter";
import VisitorTrendChart from "./VisitorTrendChart";
import { Card, DevicesCard, FunnelCard, SourcesCard, TopPagesCard } from "./Breakdowns";
import { dateLabel, formatInt, type Granularity, type Overview } from "./labels";

const PRESETS: PeriodPreset[] = ["today", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_year", "custom"];
const ONLINE_POLL_MS = 30_000;

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
    { value: "day", label: "รายวัน" },
    { value: "month", label: "รายเดือน" },
    { value: "year", label: "รายปี" },
];

async function fetchOverview(range: PeriodRange, granularity: Granularity): Promise<Overview | null> {
    const q = new URLSearchParams({ granularity });
    if (range.from) q.set("from", range.from);
    if (range.to) q.set("to", range.to);
    const res = await fetch(`${api}/visitors/overview?${q}`, { headers: authHeader() }).catch(() => null);
    return res?.ok ? res.json() : null;
}

// ช่วงยาวเกิน ~3 เดือนดูเป็นรายวันแล้วเส้นแน่นจนอ่านไม่ออก — ตั้งรายเดือนให้ก่อนตอนกดปุ่มช่วงเวลา (เปลี่ยนเองได้)
const suggestGranularity = (preset: PeriodPreset): Granularity => (preset === "this_year" ? "month" : "day");

// ป้ายเปลี่ยนแปลงเทียบช่วงก่อนหน้า — สีบอกทิศทาง + ไอคอน + ตัวเลข (ไม่ใช้สีอย่างเดียว)
function Delta({ current, previous }: { current: number; previous: number }) {
    if (previous === 0) return <span className="text-xs text-gray-400">ยังเทียบไม่ได้ — ช่วงก่อนหน้าไม่มีข้อมูล</span>;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return <span className="text-xs text-gray-500">เท่ากับช่วงก่อนหน้า</span>;
    const up = pct > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
            <Icon className="h-3.5 w-3.5" />
            {up ? "+" : ""}{pct}% <span className="font-normal text-gray-400">จากช่วงก่อนหน้า</span>
        </span>
    );
}

// hint = คำอธิบายว่าตัวเลขนี้คืออะไร — แสดงตลอดใต้ตัวเลข ไม่ซ่อนไว้ใน tooltip เพราะแอดมินที่เปิดจากมือถือชี้เมาส์ไม่ได้
// และคนที่ไม่คุ้นกับคำว่า "ผู้เยี่ยมชม" กับ "ยอดเปิดหน้า" มักสับสนว่าต่างกันยังไง (ผู้ใช้ถามจริง)
function StatTile({ icon: Icon, label, value, footer, hint }: {
    icon: typeof Eye; label: string; value: React.ReactNode; footer?: React.ReactNode; hint: string;
}) {
    return (
        <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">{label}</span>
            </div>
            <div className="mb-3">
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                {footer && <div className="mt-1">{footer}</div>}
            </div>
            {/* mt-auto: คำอธิบายชิดล่างเสมอ การ์ดทั้งแถวจึงวางคำอธิบายตรงแนวเดียวกันแม้บางใบมีบรรทัดเทียบ บางใบไม่มี */}
            <p className="mt-auto border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-400">{hint}</p>
        </div>
    );
}

export default function VisitorsPage() {
    const hasBit = usePermission();
    const allowed = hasBit(BITS.visitorStats);

    const [range, setRange] = useState<PeriodRange>({ from: "", to: "" });
    const [granularity, setGranularity] = useState<Granularity>("day");
    const [data, setData] = useState<Overview | null>(null);
    const [failed, setFailed] = useState(false);
    const [online, setOnline] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();
    const { begin, isCurrent } = useLatestRequest();

    useEffect(() => {
        if (!allowed || (!range.from && !range.to)) return;
        const token = begin();
        startTransition(async () => {
            const result = await fetchOverview(range, granularity);
            if (!isCurrent(token)) return;
            setFailed(!result);
            if (result) {
                setData(result);
                setOnline(result.online_now);
                // ช่วงยาวเกินที่รายวันรองรับ backend สลับเป็นรายเดือนให้ — ให้ปุ่มตรงกับที่แสดงจริง
                if (result.range.granularity !== granularity) setGranularity(result.range.granularity);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, granularity, allowed]);

    // "ออนไลน์ตอนนี้" อัปเดตเองทุก 30 วินาทีเฉพาะตอนแท็บนี้เปิดดูอยู่ (ยิงแค่ตัวเลขเดียว ไม่ดึงรายงานทั้งชุด)
    useEffect(() => {
        if (!allowed) return;
        const timer = window.setInterval(async () => {
            if (document.visibilityState !== "visible") return;
            const res = await fetch(`${api}/visitors/online`, { headers: authHeader() }).catch(() => null);
            if (res?.ok) setOnline((await res.json()).online_now);
        }, ONLINE_POLL_MS);
        return () => window.clearInterval(timer);
    }, [allowed]);

    if (!allowed) return <p className="p-6 text-gray-500">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>;

    const totals = data?.totals;
    const pagesPerVisit = totals && totals.visitors > 0 ? (totals.pageviews / totals.visitors).toFixed(1) : "—";
    const beforeTracking = data?.tracking_since && data.range.from < data.tracking_since;

    return (
        <div className="mx-auto max-w-6xl">
            <h1 className="mb-1 text-xl font-bold text-gray-800 sm:text-2xl">สถิติผู้เยี่ยมชม</h1>
            <p className="mb-6 text-sm text-gray-400">
                คนที่เข้าเว็บฝั่งลูกค้า (fasttiw.com) — ไม่นับหน้าแอดมินและบอท
                {data?.tracking_since && ` · เริ่มเก็บข้อมูลเมื่อ ${dateLabel(data.tracking_since)}`}
            </p>

            {/* ตัวกรองแถวเดียวบนสุด — มีผลกับทุกตัวเลขและทุกกราฟในหน้านี้พร้อมกัน ตัวเลขจึงตรงกันเสมอ */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <PeriodFilter
                    presets={PRESETS}
                    defaultPreset="last_30_days"
                    onChange={setRange}
                    onPresetChange={(p) => { if (p !== "custom") setGranularity(suggestGranularity(p)); }}
                />
                <div className="flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="ความละเอียดของกราฟ">
                    {GRANULARITY_OPTIONS.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setGranularity(o.value)}
                            aria-pressed={granularity === o.value}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                granularity === o.value ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {failed && !data && <p className="py-16 text-center text-sm text-red-500">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>}
            {!data && !failed && <p className="py-16 text-center text-sm text-gray-400">กำลังโหลด...</p>}

            {data && totals && (
                // โหลดช่วงใหม่ = คงภาพเดิมไว้แต่จางลง ไม่กระพริบเป็นหน้าว่าง (ตัวเลขไม่กระโดดไปมา)
                <div className={`flex flex-col gap-6 transition-opacity ${isPending ? "opacity-60" : ""}`}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatTile
                            icon={Eye}
                            label="ออนไลน์ตอนนี้"
                            value={
                                <span className="flex items-center gap-2.5">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 motion-safe:animate-ping" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                                    </span>
                                    {formatInt(online ?? data.online_now)}
                                </span>
                            }
                            footer={<span className="text-xs text-gray-400">อัปเดตเองทุก 30 วินาที</span>}
                            hint="คนที่กำลังเปิดเว็บลูกค้าอยู่ตอนนี้ (ใช้งานภายใน 2 นาทีล่าสุด) ไม่นับคนที่เปิดหน้าแอดมิน"
                        />
                        <StatTile icon={Users} label="ผู้เยี่ยมชม" value={formatInt(totals.visitors)}
                            footer={<Delta current={totals.visitors} previous={data.previous.visitors} />}
                            hint="จำนวนคนที่เข้าเว็บในช่วงที่เลือก — คนเดิมเปิดหลายหน้าในวันเดียวกันนับเป็น 1 คน" />
                        <StatTile icon={FileStack} label="ยอดเปิดหน้า" value={formatInt(totals.pageviews)}
                            footer={<Delta current={totals.pageviews} previous={data.previous.pageviews} />}
                            hint="จำนวนครั้งที่มีการเปิดหน้าเว็บทั้งหมด — 1 คนเปิด 5 หน้า นับเป็น 5" />
                        <StatTile icon={Layers} label="หน้าต่อผู้เยี่ยมชม" value={pagesPerVisit}
                            hint="ยอดเปิดหน้า ÷ ผู้เยี่ยมชม — ใกล้ 1 = เข้ามาหน้าเดียวแล้วออก ยิ่งสูง = ยิ่งสนใจดูหลายหน้า" />
                    </div>

                    <Card icon={TrendingUp} title="แนวโน้มผู้เยี่ยมชม"
                        subtitle={`${dateLabel(data.range.from)} – ${dateLabel(data.range.to)} · เทียบกับ ${dateLabel(data.previous.from)} – ${dateLabel(data.previous.to)}`}>
                        {(data.range.auto_switched || beforeTracking || granularity !== "day") && (
                            <div className="mb-3 flex flex-col gap-1">
                                {data.range.auto_switched && (
                                    <p className="flex items-center gap-1.5 text-xs text-amber-700">
                                        <Info className="h-3.5 w-3.5" /> ช่วงที่เลือกยาวเกินกว่าจะดูเป็นรายวัน จึงแสดงเป็นรายเดือนแทน
                                    </p>
                                )}
                                {beforeTracking && (
                                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Info className="h-3.5 w-3.5" /> ก่อน {dateLabel(data.tracking_since!)} ยังไม่ได้เก็บข้อมูล ช่วงนั้นจึงเป็น 0
                                    </p>
                                )}
                                {granularity !== "day" && (
                                    // ผลของการไม่ใช้ cookie (ตัดสินใจร่วมกับเจ้าของ) — บอกตรงๆ ไม่ให้ตีความผิดว่าเป็น "คนไม่ซ้ำ"
                                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Info className="h-3.5 w-3.5" /> ผู้เยี่ยมชมรายเดือน/รายปี = ผลรวมผู้เยี่ยมชมรายวัน คนเดิมที่มาหลายวันจะนับทุกวัน
                                    </p>
                                )}
                            </div>
                        )}
                        {totals.pageviews === 0 ? (
                            <p className="py-16 text-center text-sm text-gray-400">ยังไม่มีผู้เยี่ยมชมในช่วงนี้</p>
                        ) : (
                            <VisitorTrendChart series={data.series} granularity={data.range.granularity} dimmed={isPending} />
                        )}
                    </Card>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                        <SourcesCard sources={data.sources} />
                        <DevicesCard devices={data.devices} />
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
                        <div className="lg:col-span-3"><TopPagesCard pages={data.pages} /></div>
                        <div className="lg:col-span-2"><FunnelCard funnel={data.funnel} trackingSince={data.tracking_since} /></div>
                    </div>
                </div>
            )}
        </div>
    );
}
