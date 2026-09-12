"use client";

import type { LucideIcon } from "lucide-react";
import { Compass, MonitorSmartphone, FileText, Filter } from "lucide-react";
import { DEVICE_LABELS, dateLabel, formatInt, pageLabel, percent, sourceLabel, type Overview } from "./labels";

const BAR_COLOR = "#2a78d6";
// อุปกรณ์ 3 กลุ่มเป็นสัดส่วนของทั้งหมด → สีแยกกลุ่ม 3 สีแรกของชุดสี (ผ่านตัวตรวจ colorblind แล้ว:
// ΔE ต่ำสุด 9.2 / สีเขียวน้ำทะเลคอนทราสต์ต่ำกว่า 3:1 จึงต้องมีป้ายชื่อ + ตัวเลขกำกับทุกแถวเสมอ)
const DEVICE_COLORS = { mobile: "#2a78d6", desktop: "#eb6834", tablet: "#1baf7a" } as const;
const DEVICE_ORDER = ["mobile", "desktop", "tablet"] as const; // ลำดับคงที่ สีตามกลุ่ม ไม่ตามอันดับ

export function Card({ icon: Icon, title, subtitle, children, className = "" }: {
    icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
    return (
        <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
            <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

const Empty = () => <p className="py-8 text-center text-sm text-gray-400">ยังไม่มีข้อมูลในช่วงนี้</p>;

// เทมเพลตคอลัมน์ต่อการ์ด: [ป้ายชื่อ | แถบ | ตัวเลข] — คอลัมน์ตัวเลข "กว้างคงที่" โดยตั้งใจ
// เดิมใช้ auto แล้วแต่ละแถวเป็น grid ของตัวเอง ตัวเลขยาวไม่เท่ากันทำให้รางแถบของแต่ละแถวยาวไม่เท่ากัน
// = 100% ของแต่ละแถวไม่เท่ากัน ความยาวแถบจึงเทียบกันไม่ได้ (เจอจากภาพหน้าจอจริง)
// เขียนเป็นสตริงเต็มให้ Tailwind สแกนเจอ ห้ามประกอบชื่อคลาสจากตัวแปร
const COLS = {
    compact: "grid-cols-[minmax(0,8rem)_1fr_6.5rem] sm:grid-cols-[minmax(0,11rem)_1fr_6.5rem]",
    pages: "grid-cols-[minmax(0,8rem)_1fr_8.5rem] sm:grid-cols-[minmax(0,13rem)_1fr_8.5rem]",
} as const;

// แถบแนวนอนสีเดียว — ความยาวบอกขนาด ป้ายชื่ออยู่ซ้าย ตัวเลขอยู่ขวาเสมอ (ไม่ต้องพึ่ง tooltip)
function BarRow({ label, sub, value, max, share, cols = COLS.compact }: {
    label: string; sub?: string; value: number; max: number; share?: string; cols?: string;
}) {
    const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
    return (
        <li className={`grid items-center gap-3 text-sm ${cols}`}>
            <div className="min-w-0">
                <p className="truncate text-gray-700" title={label}>{label}</p>
                {sub && <p className="truncate text-[11px] text-gray-400" title={sub}>{sub}</p>}
            </div>
            <div className="h-2 rounded-sm bg-gray-100" aria-hidden>
                <div className="h-full rounded-r" style={{ width: `${width}%`, background: BAR_COLOR }} />
            </div>
            <p className="whitespace-nowrap text-right tabular-nums">
                <span className="font-medium text-gray-800">{formatInt(value)}</span>
                {share && <span className="ml-1.5 text-xs text-gray-400">{share}</span>}
            </p>
        </li>
    );
}

export function SourcesCard({ sources }: { sources: Overview["sources"] }) {
    const total = sources.reduce((s, x) => s + x.visitors, 0);
    const max = Math.max(0, ...sources.map((s) => s.visitors));
    return (
        <Card icon={Compass} title="มาจากไหน" subtitle="ช่องทางที่พาคนเข้าเว็บครั้งแรกของวัน">
            {sources.length === 0 ? <Empty /> : (
                <ul className="flex flex-col gap-3">
                    {sources.map((s) => (
                        <BarRow key={s.source} label={sourceLabel(s.source)} value={s.visitors} max={max} share={percent(s.visitors, total)} />
                    ))}
                </ul>
            )}
        </Card>
    );
}

export function DevicesCard({ devices }: { devices: Overview["devices"] }) {
    const byDevice = Object.fromEntries(devices.map((d) => [d.device, d.visitors])) as Record<string, number>;
    const total = devices.reduce((s, d) => s + d.visitors, 0);
    const rows = DEVICE_ORDER.map((key) => ({ key, value: byDevice[key] ?? 0 }));
    return (
        <Card icon={MonitorSmartphone} title="มือถือ / คอม" subtitle="อุปกรณ์ที่ใช้เข้าเว็บ">
            {total === 0 ? <Empty /> : (
                <>
                    {/* แถบเดียวแบ่งสัดส่วน — ช่องว่าง 2px สีพื้นคั่นแต่ละส่วน ไม่ต้องตีเส้นขอบ */}
                    <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded bg-white" role="img"
                        aria-label={rows.map((r) => `${DEVICE_LABELS[r.key]} ${percent(r.value, total)}`).join(", ")}>
                        {rows.filter((r) => r.value > 0).map((r) => (
                            <div key={r.key} style={{ width: `${(r.value / total) * 100}%`, background: DEVICE_COLORS[r.key] }} title={`${DEVICE_LABELS[r.key]} ${formatInt(r.value)} คน`} />
                        ))}
                    </div>
                    <ul className="flex flex-col gap-2 text-sm">
                        {rows.map((r) => (
                            <li key={r.key} className="flex items-center gap-2.5">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DEVICE_COLORS[r.key] }} />
                                <span className="flex-1 text-gray-700">{DEVICE_LABELS[r.key]}</span>
                                <span className="tabular-nums font-medium text-gray-800">{formatInt(r.value)}</span>
                                <span className="w-12 text-right text-xs tabular-nums text-gray-400">{percent(r.value, total)}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

export function TopPagesCard({ pages }: { pages: Overview["pages"] }) {
    const max = Math.max(0, ...pages.map((p) => p.visitors));
    return (
        <Card icon={FileText} title="หน้าที่คนดูมากที่สุด" subtitle="10 อันดับแรก เรียงตามจำนวนผู้เยี่ยมชม">
            {pages.length === 0 ? <Empty /> : (
                <>
                    <div className={`mb-2 grid gap-3 text-[11px] text-gray-400 ${COLS.pages}`}>
                        <span>หน้า</span><span />
                        <span className="text-right">ผู้เยี่ยมชม · เปิดหน้า</span>
                    </div>
                    <ul className="flex flex-col gap-3">
                        {pages.map((p) => (
                            <BarRow
                                key={p.path}
                                label={pageLabel(p)}
                                sub={p.path}
                                value={p.visitors}
                                max={max}
                                share={`· ${formatInt(p.pageviews)}`}
                                cols={COLS.pages}
                            />
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

export function FunnelCard({ funnel, trackingSince }: { funnel: Overview["funnel"]; trackingSince: string | null }) {
    const steps = [
        { label: "ผู้เยี่ยมชม", value: funnel.visitors, note: "" },
        { label: "สมัครสมาชิกผ่านเว็บ", value: funnel.signups, note: percent(funnel.signups, funnel.visitors, 1) },
        { label: "ซื้อจริง", value: funnel.buyers, note: percent(funnel.buyers, funnel.visitors, 1) },
    ];
    const clipped = trackingSince !== null && funnel.from === trackingSince;
    return (
        <Card icon={Filter} title="อัตราเปลี่ยนเป็นลูกค้า" subtitle="เทียบกับจำนวนผู้เยี่ยมชมในช่วงเดียวกัน">
            {funnel.visitors === 0 ? <Empty /> : (
                <>
                    <ul className="flex flex-col gap-3">
                        {steps.map((s) => (
                            <BarRow key={s.label} label={s.label} value={s.value} max={funnel.visitors} share={s.note || undefined} />
                        ))}
                    </ul>
                    <p className="mt-4 text-xs leading-relaxed text-gray-400">
                        สมัครสมาชิก = สมัครเองผ่านหน้าเว็บหรือ Google (ไม่นับบัญชีที่แอดมินสร้างให้จากแชทเพจ) · ซื้อจริง =
                        ลูกค้าที่ชำระเงินสำเร็จในช่วงนี้ ไม่จำเป็นต้องเป็นคนที่สมัครในช่วงเดียวกัน
                        {clipped && ` · นับตั้งแต่ ${dateLabel(funnel.from)} ซึ่งเป็นวันแรกที่เริ่มเก็บสถิติ`}
                    </p>
                </>
            )}
        </Card>
    );
}
