"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht, effectivePrice } from "@/app/function";
import SearchInput from "@/components/ui/SearchInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Check, ChevronLeft, ChevronRight, PackageCheck, Tag, X } from "lucide-react";
import { toast } from "sonner";

type Product = {
    prod_id: string; prod_name: string; prod_price: number; prod_is_free: boolean; prod_cover_url: string | null;
    prod_entitlement_duration_months: number | null;
};
type CouponInfo = { cpn_id: string; cpn_code: string; cpn_discount_type: "percent" | "fixed"; cpn_discount_value: number };
type CouponRow = { cpn_code: string; cpn_discount_type: "percent" | "fixed"; cpn_discount_value: number };

const PAGE_SIZE = 8;
const SERVER_BASE = new URL(api).origin;

// ปุ่มลัดพื้นฐาน — ให้เลือกระยะเวลาเองได้อิสระเสมอ (ไม่บังคับ) เผื่อกรณีพิเศษที่แอดมินตัดสินใจเอง
const BASE_DURATION_OPTIONS = [
    { value: "3", label: "3 เดือน" },
    { value: "6", label: "6 เดือน" },
    { value: "12", label: "12 เดือน" },
    { value: "", label: "ไม่มีวันหมดอายุ" },
];

// แทรกปุ่มค่า default ของ product ที่เลือกเข้าไปด้วย ถ้าไม่ตรงกับปุ่มพื้นฐานที่มีอยู่แล้ว (เช่น product ตั้ง
// default ไว้ 9 เดือน) กันกรณีแอดมินไม่มีปุ่มให้กดตรงกับค่า default จริงของ product เลย
function buildDurationOptions(impliedDuration: string | null) {
    if (impliedDuration === null || BASE_DURATION_OPTIONS.some((o) => o.value === impliedDuration)) {
        return BASE_DURATION_OPTIONS;
    }
    const numeric = BASE_DURATION_OPTIONS.filter((o) => o.value !== "");
    const lifetime = BASE_DURATION_OPTIONS.find((o) => o.value === "")!;
    const merged = [...numeric, { value: impliedDuration, label: `${impliedDuration} เดือน` }]
        .sort((a, b) => Number(a.value) - Number(b.value));
    return [...merged, lifetime];
}

async function fetchPublishedProducts(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit), offset: String(params.offset),
        search: params.search, status: "published",
    });
    const res = await fetch(`${api}/products?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Product[], total: 0 };
    return res.json() as Promise<{ data: Product[]; total: number }>;
}

async function validateCoupon(code: string): Promise<CouponInfo> {
    const res = await fetch(`${api}/coupons/validate/${encodeURIComponent(code.trim())}`, { headers: authHeader() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "โค้ดไม่ถูกต้อง");
    return data;
}

// เฉพาะโค้ดที่ใช้ได้จริง ณ ตอนนี้ (usable=true) — กันแอดมินเลือกโค้ดที่หมดอายุ/ครบโควตาไปแล้วจาก dropdown
async function loadCouponOptions(search: string) {
    const query = new URLSearchParams({ limit: "20", offset: "0", search, usable: "true" });
    const res = await fetch(`${api}/coupons?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: CouponRow[] };
    return data.map((c) => ({
        value: c.cpn_code,
        label: `${c.cpn_code} — ${c.cpn_discount_type === "percent" ? `${Number(c.cpn_discount_value)}%` : formatBaht(c.cpn_discount_value)}`,
    }));
}

async function grantProducts(customerId: string, productIds: string[], durationMonths: string, couponCode: string) {
    const res = await fetch(`${api}/customers/${customerId}/entitlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
            product_ids: productIds,
            duration_months: durationMonths ? Number(durationMonths) : null,
            coupon_code: couponCode || null,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

type Props = {
    open: boolean;
    customerId: string;
    onClose: () => void;
    onDone?: () => void;
};

// modal เลือกชุดข้อสอบให้สิทธิ์ลูกค้าแบบเลือกได้หลายชุดพร้อมกัน — ใช้ตอนสร้างลูกค้าใหม่
// รับแค่ customerId เฉยๆ เลยเรียกใช้ซ้ำจากหน้าแก้ไขลูกค้าในอนาคตได้โดยไม่ต้องแก้อะไร
// เก็บ selected เป็น Map<id, Product> แทน Set<id> เพราะต้องคำนวณราคารวมของสิ่งที่เลือกไว้
// ข้ามหน้า (pagination) ได้ — ถ้าเก็บแค่ id เฉยๆ จะไม่มีราคาของ item ที่เลือกจากหน้าอื่นมาคำนวณ
export default function GrantProductsModal({ open, customerId, onClose, onDone }: Props) {
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Map<string, Product>>(new Map());
    const [duration, setDuration] = useState("12");
    // true ทันทีที่แอดมินกดปุ่มระยะเวลาเอง — หยุด auto pre-select จากค่า default ของ product ไม่ให้ไปแย่ง
    // ค่าที่แอดมินตั้งใจเลือกไว้แล้วทุกครั้งที่ toggle เพิ่ม/ลบ product ออกจากตะกร้า
    const [durationTouched, setDurationTouched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [couponValue, setCouponValue] = useState("");
    const [coupon, setCoupon] = useState<CouponInfo | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [checkingCoupon, setCheckingCoupon] = useState(false);

    // reset state ทุกครั้งที่เปิด modal ใหม่ — กัน selection/โค้ดของลูกค้าคนก่อนค้างมาโผล่กับคนใหม่
    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้อง reset ให้เสร็จก่อน fetch async เริ่ม กันข้อมูลของลูกค้าคนก่อนค้างโชว์
            setSelected(new Map()); setSearch(""); setPage(1); setDuration("12"); setDurationTouched(false);
            setCouponValue(""); setCoupon(null); setCouponError(null);
        }
    }, [open, customerId]);

    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้องตั้ง loading ก่อน fetch async เริ่ม
        setLoading(true);
        fetchPublishedProducts({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, search })
            .then((result) => { setProducts(result.data); setTotal(result.total); })
            .finally(() => setLoading(false));
    }, [open, page, search]);

    // ค่า duration ที่ "โดยนัย" จาก product ที่เลือกอยู่ตอนนี้ — มีค่าเฉพาะตอนเลือกอย่างน้อย 1 ชุด และทุกชุด
    // ที่เลือกมี default ตรงกันหมด (เลือกหลายชุดที่ default ต่างกัน = ไม่มีคำตอบเดียวที่ถูกต้อง ปล่อยว่างไว้
    // ไม่บังคับเดาให้)
    const selectedProducts = [...selected.values()];
    const impliedDuration = selectedProducts.length > 0
        && selectedProducts.every((p) => p.prod_entitlement_duration_months === selectedProducts[0].prod_entitlement_duration_months)
        ? (selectedProducts[0].prod_entitlement_duration_months == null ? "" : String(selectedProducts[0].prod_entitlement_duration_months))
        : null;

    // ดึงค่า default ของ product มา pre-select ปุ่มที่ตรงกันให้อัตโนมัติ — ตัดความเสี่ยงแอดมิน "ลืม" ว่า
    // product นี้ตั้ง default ต่างจากปุ่มที่กำลังเลือกอยู่ ยังกดเปลี่ยนปุ่มเองได้ปกติถ้าต้องการดีลพิเศษ
    // (ทำงานเฉพาะตอนแอดมินยังไม่เคยกดปุ่มเองในรอบนี้ — durationTouched — กันไป "แย่ง" ค่าที่ตั้งใจเลือกไว้แล้ว)
    useEffect(() => {
        if (durationTouched || impliedDuration === null) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync ค่า duration ตาม product ที่เลือกอยู่ตอนนี้โดยตรง ไม่ใช่ผลจาก external system
        setDuration(impliedDuration);
    }, [impliedDuration, durationTouched]);

    function handleDurationSelect(value: string) {
        setDuration(value);
        setDurationTouched(true);
    }

    function toggleProduct(p: Product) {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(p.prod_id)) next.delete(p.prod_id); else next.set(p.prod_id, p);
            return next;
        });
    }

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    // validate ซ้ำอีกทีตอนเลือกจาก dropdown (ไม่เชื่อ list ที่โหลดไว้ก่อนหน้าเฉยๆ) กันกรณีโค้ดเพิ่งหมดอายุ/ครบโควตา
    // ไปพอดีระหว่างที่ modal เปิดค้างอยู่
    async function handleSelectCoupon(code: string) {
        setCouponValue(code);
        if (!code) { setCoupon(null); setCouponError(null); return; }

        setCheckingCoupon(true);
        setCouponError(null);
        try {
            const result = await validateCoupon(code);
            setCoupon(result);
        } catch (err) {
            setCoupon(null);
            setCouponValue("");
            setCouponError(err instanceof Error ? err.message : "โค้ดไม่ถูกต้อง");
        } finally {
            setCheckingCoupon(false);
        }
    }

    function clearCoupon() {
        setCouponValue(""); setCoupon(null); setCouponError(null);
    }

    async function handleSubmit() {
        if (selected.size === 0) return;
        setSubmitting(true);
        try {
            await grantProducts(customerId, [...selected.keys()], duration, coupon?.cpn_code ?? "");
            toast.success(`ให้สิทธิ์สำเร็จ ${selected.size} ชุด`);
            onDone?.();
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const subtotal = [...selected.values()].reduce((sum, p) => sum + effectivePrice(p), 0);
    const discount = coupon
        ? coupon.cpn_discount_type === "percent"
            ? subtotal * (Number(coupon.cpn_discount_value) / 100)
            : Math.min(subtotal, Number(coupon.cpn_discount_value))
        : 0;
    const grandTotal = Math.max(0, subtotal - discount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
                {/* header */}
                <div className="px-6 pt-6 pb-4 flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-800">เพิ่มสิทธิ์ชุดข้อสอบ</h2>
                        <p className="text-xs text-gray-400">เลือกชุดข้อสอบที่เผยแพร่แล้ว — เลือกได้หลายชุด</p>
                    </div>
                </div>

                {/* search + list */}
                <div className="px-6 pb-2 shrink-0">
                    <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาชุดข้อสอบ..." className="w-full" />
                </div>

                {/* ส่วนที่เหลือทั้งหมด (รายการ+เพจ+footer) อยู่ใน scroll container เดียวกัน กันปุ่มด้านล่าง
                    ถูกตัดหายไปเงียบๆ เวลาจอเตี้ย/เนื้อหา footer ยาวขึ้น (โค้ดส่วนลด+สรุปราคาที่เพิ่งเพิ่มมา) —
                    footer ปักหมุดด้วย sticky bottom-0 ให้ยังกดปุ่มหลักได้ทันทีโดยไม่ต้อง scroll ถ้าพื้นที่พอ */}
                <div className="overflow-y-auto flex-1 flex flex-col">
                    <div className="px-4 min-h-70">
                        {loading ? (
                            <p className="text-sm text-gray-400 py-10 text-center">กำลังโหลด...</p>
                        ) : products.length === 0 ? (
                            <p className="text-sm text-gray-400 py-10 text-center">ไม่พบชุดข้อสอบที่เผยแพร่แล้ว</p>
                        ) : (
                            <div className="space-y-0.5 pb-2">
                                {products.map((p) => {
                                    const isSelected = selected.has(p.prod_id);
                                    return (
                                        <button
                                            key={p.prod_id}
                                            type="button"
                                            onClick={() => toggleProduct(p)}
                                            className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                                                isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                                <Image
                                                    src={p.prod_cover_url ? `${SERVER_BASE}${p.prod_cover_url}` : "/defult.png"}
                                                    alt=""
                                                    fill
                                                    unoptimized={!!p.prod_cover_url}
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{p.prod_name}</p>
                                                <p className="text-xs text-gray-400">{p.prod_is_free ? <span className="text-green-600 font-medium">ฟรี</span> : formatBaht(p.prod_price)}</p>
                                            </div>
                                            <div
                                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected ? "bg-blue-500" : "bg-gray-100"
                                                }`}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="px-6 py-2 flex items-center justify-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* footer */}
                    <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0 sticky bottom-0 bg-white">
                        {/* โค้ดส่วนลด */}
                        {coupon ? (
                            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
                                <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                                    <Tag className="w-3.5 h-3.5" /> {coupon.cpn_code}
                                    <span className="text-green-600 font-normal">
                                        ({coupon.cpn_discount_type === "percent" ? `${Number(coupon.cpn_discount_value)}%` : formatBaht(coupon.cpn_discount_value)})
                                    </span>
                                </span>
                                <button type="button" onClick={clearCoupon} className="text-green-600 hover:text-green-800">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <SearchableSelect
                                    loadOptions={loadCouponOptions}
                                    value={couponValue}
                                    onChange={handleSelectCoupon}
                                    placeholder="เลือกโค้ดส่วนลด (ไม่บังคับ)"
                                    disabled={checkingCoupon}
                                    error={!!couponError}
                                    className="w-full"
                                />
                                {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                            </div>
                        )}

                        {/* สรุปราคา */}
                        {selected.size > 0 && (
                            <div className="text-sm space-y-0.5">
                                <div className="flex items-center justify-between text-gray-500">
                                    <span>ยอดรวม {selected.size} ชุด</span>
                                    <span>{formatBaht(subtotal)}</span>
                                </div>
                                {coupon && (
                                    <div className="flex items-center justify-between text-green-600">
                                        <span>ส่วนลด ({coupon.cpn_code})</span>
                                        <span>-{formatBaht(discount)}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between font-semibold text-gray-800 pt-0.5">
                                    <span>ยอดสุทธิ</span>
                                    <span>{formatBaht(grandTotal)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                            {buildDurationOptions(impliedDuration).map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => handleDurationSelect(o.value)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                        duration === o.value
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    }`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                ข้าม
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={selected.size === 0 || submitting}
                                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                            >
                                <Check className="w-4 h-4" />
                                {submitting ? "กำลังบันทึก..." : `ให้สิทธิ์${selected.size > 0 ? ` (${selected.size})` : ""}`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
