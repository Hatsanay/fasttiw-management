"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { toDateInput } from "@/app/lib/date";
import { formatBaht } from "@/app/function";
import { usePermission, BITS } from "@/app/components/permission-provider";
import {
    TrendingUp, TrendingDown, Scale, PiggyBank, Receipt,
    Users, BookOpen, Banknote, Clock, ArrowRight, Gift, ShoppingCart, Flag,
} from "lucide-react";
import ProductRankingWidget from "./widgets/ProductRankingWidget";
import PackageRankingWidget from "./widgets/PackageRankingWidget";
import ConversionWidget from "./widgets/ConversionWidget";
import TopCategoriesWidget from "./widgets/TopCategoriesWidget";
import SalesTrendChart from "./widgets/SalesTrendChart";

type Summary = {
    revenue: number;
    expenses: number;
    commission: number;
    gateway_fee: number;
    profit: number;
    sale_count: number;
};

type RetainedEarnings = { retained_earnings: number };

type PayrollSummary = { eligible_count: number; paid_count: number; paid_amount: number; owed_count: number; owed_amount: number };

function thisMonthRange(): { from: string; to: string } {
    const now = new Date();
    return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
}

async function fetchJson<T>(path: string): Promise<T | null> {
    const res = await fetch(`${api}${path}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

// ป้ายหัวข้อเล็กๆ คั่นแต่ละโซนของแดชบอร์ด (ตัวพิมพ์เล็ก+tracking กว้าง) แทนการพึ่งกรอบการ์ดล้วนๆ
// ให้สแกนหน้าเป็นโซนได้ง่ายขึ้นโดยไม่ต้องเพิ่มเส้นแบ่ง/สีพื้นหลังซึ่งจะทำให้ดูรกกว่าเดิม
function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</p>;
}

// ไอคอนอยู่ใน "ชิป" พื้นหลังสีอ่อนแทนไอคอนลอยตัวสีเข้ม — โทนสีอ่อนลงทำให้การ์ดหลายใบเรียงกันดูสงบตากว่า
// เดิม (ไอคอนสีเข้มจัดบนพื้นขาวหลายอันติดกันจะดูแน่น/ฉูดฉาดเกินไปสำหรับแดชบอร์ดที่เน้นความมินิมอล)
function IconChip({ icon: Icon, tone }: { icon: React.ElementType; tone: string }) {
    return (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
            <Icon className="w-4.5 h-4.5" />
        </div>
    );
}

// การ์ดสรุปตัวเลขทรงเดียวกันทุกจุดในแดชบอร์ด กันสไตล์เพี้ยนไม่ตรงกันระหว่าง widget
function StatCard({
    icon, tone, label, value, sub,
}: {
    icon: React.ElementType; tone: string; label: string; value: string; sub?: string;
}) {
    return (
        <div className="flex-1 min-w-45 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
                <IconChip icon={icon} tone={tone} />
                <span className="text-sm text-gray-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

// การ์ดทางลัด (คลิกไปหน้าอื่นได้) ใช้ชิปสีกลาง (neutral) เป็นค่าเริ่มต้น สงวนสีเหลืองไว้เฉพาะรายการที่
// "ต้องการความสนใจ" จริงๆ (มีของค้างอยู่) ให้สีมีความหมาย ไม่ใช่สีสันตกแต่งเฉยๆ
function LinkCard({
    icon, tone, label, value, valueSub, onClick, badge,
}: {
    icon: React.ElementType; tone: string; label: string; value: string; valueSub?: string; onClick: () => void; badge?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex-1 min-w-45 text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
            <div className="flex items-center justify-between mb-3">
                <IconChip icon={icon} tone={tone} />
                <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800">
                {value} {valueSub && <span className="text-sm font-normal text-gray-400">{valueSub}</span>}
            </p>
            {badge && <p className="text-xs text-amber-600 mt-1">{badge}</p>}
        </button>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const canSeeReports = hasBit(BITS.reportsManagement);
    const canSeeRetained = hasBit(BITS.reportsManagement) || hasBit(BITS.partnersManagement);
    const canSeePayroll = hasBit(BITS.payrollManagement);
    const canSeeCustomers = hasBit(BITS.customersManagement);
    const canSeeProducts = hasBit(BITS.productsManagement);
    const hasAnyWidget = canSeeReports || canSeeRetained || canSeePayroll || canSeeCustomers || canSeeProducts;

    const [summary, setSummary] = useState<Summary | null>(null);
    const [retained, setRetained] = useState<RetainedEarnings | null>(null);
    const [pendingOrderCount, setPendingOrderCount] = useState<number | null>(null);
    const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
    const [customerCount, setCustomerCount] = useState<number | null>(null);
    const [productCount, setProductCount] = useState<number | null>(null);
    const [pendingReportCount, setPendingReportCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const { from, to } = thisMonthRange();
        const now = new Date();

        Promise.all([
            canSeeReports ? fetchJson<Summary>(`/reports/summary?from=${from}&to=${to}`) : Promise.resolve(null),
            canSeeRetained ? fetchJson<RetainedEarnings>("/reports/retained-earnings") : Promise.resolve(null),
            canSeeReports ? fetchJson<{ data: unknown[] }>("/orders?status=pending") : Promise.resolve(null),
            canSeePayroll ? fetchJson<{ summary: PayrollSummary }>(`/payrolls/run-status?month=${now.getMonth() + 1}&year=${now.getFullYear()}`) : Promise.resolve(null),
            canSeeCustomers ? fetchJson<{ total: number }>("/customers?limit=1") : Promise.resolve(null),
            canSeeProducts ? fetchJson<{ total: number }>("/products?limit=1") : Promise.resolve(null),
            canSeeProducts ? fetchJson<{ data: unknown[] }>("/question-reports?status=open") : Promise.resolve(null),
        ]).then(([summaryRes, retainedRes, ordersRes, payrollRes, customersRes, productsRes, reportsRes]) => {
            setSummary(summaryRes);
            setRetained(retainedRes);
            setPendingOrderCount(ordersRes ? ordersRes.data.length : null);
            setPayroll(payrollRes ? payrollRes.summary : null);
            setCustomerCount(customersRes ? customersRes.total : null);
            setProductCount(productsRes ? productsRes.total : null);
            setPendingReportCount(reportsRes ? reportsRes.data.length : null);
            setLoading(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">แดชบอร์ด</h1>
            <p className="text-sm text-gray-400 mb-8">ภาพรวมธุรกิจและการวิเคราะห์การขาย</p>

            {!hasAnyWidget ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
                    ยังไม่มีสิทธิ์เข้าถึงข้อมูลสรุปใดๆ — ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม
                </div>
            ) : loading ? (
                <div className="flex flex-wrap gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex-1 min-w-45 h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-10">
                    {canSeeReports && summary && (
                        <div>
                            <SectionLabel>ภาพรวมการเงินเดือนนี้</SectionLabel>
                            <div className="flex flex-wrap gap-4">
                                <StatCard
                                    icon={TrendingUp} tone="bg-green-50 text-green-600"
                                    label="รายได้เดือนนี้" value={formatBaht(summary.revenue)}
                                    sub={`${summary.sale_count} รายการขาย`}
                                />
                                <StatCard
                                    icon={TrendingDown} tone="bg-red-50 text-red-600"
                                    label="ค่าใช้จ่าย+ค่าคอม+ค่าธรรมเนียม" value={formatBaht(summary.expenses + summary.commission + summary.gateway_fee)}
                                />
                                <StatCard
                                    icon={Scale} tone="bg-blue-50 text-blue-600"
                                    label="กำไรสุทธิเดือนนี้" value={formatBaht(summary.profit)}
                                />
                                {canSeeRetained && retained && (
                                    <StatCard
                                        icon={PiggyBank} tone="bg-indigo-50 text-indigo-600"
                                        label="กำไรสะสมคงเหลือ" value={formatBaht(retained.retained_earnings)}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {(canSeeReports || canSeePayroll || canSeeCustomers || canSeeProducts) && (
                        <div>
                            <SectionLabel>ทางลัด</SectionLabel>
                            <div className="flex flex-wrap gap-4">
                                {canSeeReports && (
                                    <LinkCard
                                        icon={Clock} tone="bg-amber-50 text-amber-600"
                                        label="คำสั่งซื้อรอดำเนินการ" value={String(pendingOrderCount ?? 0)}
                                        onClick={() => router.push("/orders")}
                                    />
                                )}

                                {canSeePayroll && payroll && (
                                    <LinkCard
                                        icon={Banknote} tone="bg-gray-100 text-gray-500"
                                        label="เงินเดือนพนักงานเดือนนี้"
                                        value={`${payroll.paid_count}/${payroll.eligible_count}`} valueSub="จ่ายแล้ว"
                                        badge={payroll.owed_count > 0 ? `ค้างจ่าย ${payroll.owed_count} คน (${formatBaht(payroll.owed_amount)})` : undefined}
                                        onClick={() => router.push("/payroll")}
                                    />
                                )}

                                {canSeeCustomers && (
                                    <LinkCard
                                        icon={Users} tone="bg-gray-100 text-gray-500"
                                        label="ลูกค้าทั้งหมด" value={String(customerCount ?? 0)}
                                        onClick={() => router.push("/customers")}
                                    />
                                )}

                                {canSeeProducts && (
                                    <LinkCard
                                        icon={BookOpen} tone="bg-gray-100 text-gray-500"
                                        label="ชุดข้อสอบทั้งหมด" value={String(productCount ?? 0)}
                                        onClick={() => router.push("/products")}
                                    />
                                )}

                                {canSeeProducts && (
                                    <LinkCard
                                        icon={Flag} tone="bg-amber-50 text-amber-600"
                                        label="แจ้งปัญหาข้อสอบค้างอยู่" value={String(pendingReportCount ?? 0)}
                                        onClick={() => router.push("/question-reports")}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {canSeeReports && (
                        <button
                            type="button"
                            onClick={() => router.push("/reports")}
                            className="self-start -mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                            <Receipt className="w-4 h-4" />
                            ดูรายงานการเงินฉบับเต็ม
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* widget วิเคราะห์เชิงลึก — ทุกตัวมีตัวกรองวัน/เดือน/ปีเป็นอิสระต่อ widget เอง
                        (ไม่ใช้ตัวกรองร่วมกันทั้งหน้า เพราะแต่ละ widget มักอยากดูช่วงเวลาต่างกัน) */}
                    {canSeeReports && (
                        <div>
                            <SectionLabel>วิเคราะห์การใช้งานและการขาย</SectionLabel>
                            <div className="flex flex-col gap-4">
                                <SalesTrendChart />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <ProductRankingWidget
                                        isFree
                                        title="คนใช้สิทธิ์ฟรี"
                                        icon={Gift}
                                        iconColor="text-green-600"
                                        iconTone="bg-green-50"
                                        countLabel="ใช้สิทธิ์ฟรีไปแล้ว"
                                        revenueLabel="ยอดขายรวม"
                                    />
                                    <ProductRankingWidget
                                        isFree={false}
                                        title="คนซื้อจ่ายเงิน"
                                        icon={ShoppingCart}
                                        iconColor="text-blue-600"
                                        iconTone="bg-blue-50"
                                        countLabel="ซื้อไปแล้ว"
                                        revenueLabel="ยอดขายรวม"
                                    />
                                </div>

                                <PackageRankingWidget />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <ConversionWidget />
                                    <TopCategoriesWidget />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
