"use client";

import { useState } from "react";
import formatDate, { formatBaht } from "@/app/function";
import { Ban, AlertTriangle } from "lucide-react";

// เหตุผลต้องตรงกับ REVOKE_REASONS ใน backend/src/controllers/entitlement.controller.js เป๊ะ
// (backend เป็นตัวตัดสินจริง ฝั่งนี้แค่เลือกให้แอดมินกดง่ายและกันเลือกตัวเลือกที่เป็นไปไม่ได้)
export type RevokeReason = "revoke_only" | "wrong_grant" | "refund_bank" | "refund_gateway";

export type RevokeTarget = {
    ent_id: string;
    prod_name: string;
    cus_username: string;
    /** ยอดที่จะถูกหักออกถ้าเลือกกลับรายการ — null = สิทธิ์เก่าที่ไม่ผูกกับบิลใดเลย */
    sale_amount: string | number | null;
    /** จ่ายผ่านเว็บจริงไหม (มี PaymentIntent ให้สั่งคืนเงินอัตโนมัติได้) */
    can_refund_gateway: boolean;
    /** ถ้าเป็นการต่ออายุ คืนเงินแล้วจะถอยวันหมดอายุกลับมาวันนี้ ไม่ใช่ยกเลิกทั้งใบ */
    rolls_back_to: string | null;
};

type Option = { value: RevokeReason; label: string; detail: string; warn?: string };

export default function RevokeEntitlementDialog({
    target,
    loading = false,
    onConfirm,
    onCancel,
}: {
    target: RevokeTarget | null;
    loading?: boolean;
    onConfirm: (reason: RevokeReason) => void;
    onCancel: () => void;
}) {
    // ผู้เรียกต้องใส่ key={ent_id} ให้ component นี้ เพื่อให้ React สร้างใหม่ทุกครั้งที่เปลี่ยนรายการ —
    // เหตุผลที่เลือกไว้ของรายการก่อนหน้าจะถูกล้างเองโดยไม่ต้อง reset ผ่าน useEffect (ซึ่ง React แนะนำให้เลี่ยง)
    const [reason, setReason] = useState<RevokeReason>("revoke_only");

    if (!target) return null;

    const linkedToSale = target.sale_amount !== null;
    const amount = linkedToSale ? formatBaht(target.sale_amount as string) : null;

    // ตัวเลือกที่ "เป็นไปได้จริง" เท่านั้น — สิทธิ์ที่ไม่ผูกกับบิลจะหักยอดออกไม่ได้ (backend ก็ปฏิเสธอยู่แล้ว)
    // และการคืนเงินอัตโนมัติทำได้เฉพาะยอดที่จ่ายผ่านเว็บจริง
    const options: Option[] = [
        {
            value: "revoke_only",
            label: "ยกเลิกเฉยๆ ไม่คืนเงิน",
            detail: "ลูกค้าผิดกติกา เช่น แชร์บัญชี — เงินที่รับมาแล้วไม่คืน ยอดขายคงเดิม",
        },
        ...(linkedToSale && target.can_refund_gateway
            ? [{
                value: "refund_gateway" as const,
                label: `ลูกค้าขอคืนเงิน — จ่ายผ่านเว็บ (${amount})`,
                detail: "ระบบสั่งคืนเงินผ่าน Stripe ให้อัตโนมัติ แล้วหักยอดออกจากรายงาน",
                warn: "ค่าธรรมเนียมที่ Stripe หักตอนรับเงินจะไม่ได้คืนกลับมาด้วย ส่วนนี้เป็นการขาดทุนจริง",
            }]
            : []),
        ...(linkedToSale
            ? [
                {
                    value: "refund_bank" as const,
                    label: `ลูกค้าขอคืนเงิน — โอนเข้าบัญชีธนาคาร (${amount})`,
                    detail: "หักยอดออกจากรายงานให้ แต่ระบบโอนเงินคืนแทนไม่ได้",
                    warn: "ต้องโอนเงินคืนลูกค้าเองทางธนาคาร ระบบไม่ได้ทำให้",
                },
                {
                    value: "wrong_grant" as const,
                    label: `ให้สิทธิ์ผิด ไม่เคยรับเงินจริง (${amount})`,
                    detail: "กลับรายการที่บันทึกผิด ไม่มีเงินเกี่ยวข้อง",
                },
            ]
            : []),
    ];

    const selected = options.find((o) => o.value === reason);
    const willReverse = reason !== "revoke_only";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-6 pt-6 pb-4 flex items-start gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <Ban className="w-4.5 h-4.5 text-red-500" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-800">ยกเลิกสิทธิ์</h2>
                        <p className="text-xs text-gray-400 truncate">
                            {target.prod_name} · {target.cus_username}
                        </p>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-2">
                    {!linkedToSale && (
                        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                            สิทธิ์นี้ให้ไว้ก่อนระบบเริ่มผูกกับรายการขาย จึงหักยอดออกอัตโนมัติไม่ได้ — ทำได้แค่ยกเลิกเฉยๆ
                        </p>
                    )}

                    {options.map((o) => (
                        <label
                            key={o.value}
                            className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                reason === o.value ? "border-blue-300 bg-blue-50/60" : "border-gray-200 hover:bg-gray-50"
                            }`}
                        >
                            <input
                                type="radio"
                                name="revoke-reason"
                                checked={reason === o.value}
                                onChange={() => setReason(o.value)}
                                className="mt-0.5 w-4 h-4 accent-blue-500 shrink-0"
                            />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-gray-800">{o.label}</span>
                                <span className="block text-xs text-gray-500 mt-0.5">{o.detail}</span>
                            </span>
                        </label>
                    ))}

                    {selected?.warn && (
                        <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {selected.warn}
                        </p>
                    )}

                    {/* บอกล่วงหน้าว่าสิทธิ์จะถูกยกเลิกทั้งใบ หรือแค่ถอยวันหมดอายุกลับ (กรณีต่ออายุ) */}
                    <p className="text-xs text-gray-500 pt-1">
                        {willReverse && target.rolls_back_to
                            ? `รายการนี้เป็นการต่ออายุ — สิทธิ์จะไม่ถูกยกเลิก แต่วันหมดอายุจะถอยกลับเป็น ${formatDate(target.rolls_back_to)}`
                            : "ลูกค้าจะเข้าทำข้อสอบชุดนี้ไม่ได้อีกทันที"}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(reason)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg shadow-sm transition-colors"
                    >
                        <Ban className="w-4 h-4" />
                        {loading ? "กำลังดำเนินการ..." : willReverse ? "ยืนยันและหักยอดขาย" : "ยืนยันยกเลิก"}
                    </button>
                </div>
            </div>
        </div>
    );
}
