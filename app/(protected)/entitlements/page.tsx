"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import formatDate from "@/app/function";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import { useRouter } from "next/navigation";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { toast } from "sonner";
import { Ban, User } from "lucide-react";

type EntitlementRow = {
    ent_id: string;
    prod_name: string;
    ent_granted_via: "manual" | "payment" | "renewal";
    ent_granted_at: string;
    ent_expires_at: string | null;
    effective_status: "active" | "expired" | "revoked";
};

type CustomerGroup = {
    cus_id: string;
    cus_username: string;
    cus_fullname: string | null;
    entitlements: EntitlementRow[];
};

type RevokeTarget = { ent_id: string; prod_name: string; cus_username: string };

const GRANTED_VIA_LABEL: Record<EntitlementRow["ent_granted_via"], string> = {
    manual: "แอดมินให้เอง",
    payment: "ชำระเงิน",
    renewal: "ต่ออายุ",
};

const STATUS_LABEL: Record<EntitlementRow["effective_status"], string> = {
    active: "ใช้งานอยู่",
    expired: "หมดอายุแล้ว",
    revoked: "ถูกยกเลิก",
};

const STATUS_BADGE: Record<EntitlementRow["effective_status"], string> = {
    active: "bg-green-50 text-green-600",
    expired: "bg-amber-50 text-amber-600",
    revoked: "bg-gray-100 text-gray-400",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

async function fetchEntitlements(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/entitlements?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as CustomerGroup[], total: 0 };
    return res.json() as Promise<{ data: CustomerGroup[]; total: number }>;
}

export default function EntitlementsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const [isPending, startTransition] = useTransition();
    const [groups, setGroups] = useState<CustomerGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const result = await fetchEntitlements({ limit, offset, search });
            setGroups(result.data);
            setTotal(result.total);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize]);

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }

    async function handleRevoke() {
        if (!revokeTarget) return;
        setIsRevoking(true);
        try {
            const res = await fetch(`${api}/entitlements/${revokeTarget.ent_id}/revoke`, {
                method: "PUT",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ยกเลิกสิทธิ์ "${revokeTarget.prod_name}" ของ ${revokeTarget.cus_username} สำเร็จ`);
                reload();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ยกเลิกไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsRevoking(false);
            setRevokeTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ภาพรวมสิทธิ์การเข้าถึง</h1>
                    <p className="text-sm text-gray-400 mt-0.5">ใครถือสิทธิ์ชุดข้อสอบอะไรบ้าง หมดอายุเมื่อไหร่</p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/customers")}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 shrink-0"
                >
                    ← ลูกค้า
                </button>
            </div>

            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาลูกค้าหรือชุดข้อสอบ..." className="w-full sm:w-80 mb-4" />

            {isPending ? (
                <p className="text-sm text-gray-400 py-6 text-center">กำลังโหลด...</p>
            ) : groups.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                    {search ? "ไม่พบข้อมูลที่ตรงกับคำค้นหา" : "ยังไม่มีลูกค้าคนไหนถือสิทธิ์เลย"}
                </p>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <div key={group.cus_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* หัวการ์ด — แยกแต่ละคนให้เห็นชัดว่าเป็นลูกค้าคนไหน */}
                            <div className="px-4 py-3 flex items-center gap-2.5 bg-gray-50/70 border-b border-gray-100">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{group.cus_username}</p>
                                    {group.cus_fullname && <p className="text-xs text-gray-400 truncate">{group.cus_fullname}</p>}
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">{group.entitlements.length} รายการ</span>
                            </div>

                            <div className="divide-y divide-gray-50">
                                {group.entitlements.map((ent) => (
                                    <div key={ent.ent_id} className="px-4 py-3 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">{ent.prod_name}</p>
                                            <p className="text-xs text-gray-400">
                                                ให้สิทธิ์ {formatDate(ent.ent_granted_at)} · {GRANTED_VIA_LABEL[ent.ent_granted_via]}
                                                {" · "}
                                                {ent.ent_expires_at ? `หมดอายุ ${formatDate(ent.ent_expires_at)}` : "ไม่มีวันหมดอายุ"}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[ent.effective_status]}`}>
                                            {STATUS_LABEL[ent.effective_status]}
                                        </span>
                                        {hasBit(BITS.editCustomer) && ent.effective_status === "active" && (
                                            <button
                                                onClick={() => setRevokeTarget({ ent_id: ent.ent_id, prod_name: ent.prod_name, cus_username: group.cus_username })}
                                                title="ยกเลิกสิทธิ์"
                                                className="shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Ban className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                        />
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!revokeTarget}
                variant="warning"
                title="ยกเลิกสิทธิ์นี้?"
                description={revokeTarget ? `"${revokeTarget.prod_name}" ของ ${revokeTarget.cus_username} จะถูกยกเลิกทันที ลูกค้าจะเข้าทำข้อสอบชุดนี้ไม่ได้อีก` : undefined}
                confirmLabel="ยกเลิกสิทธิ์"
                loading={isRevoking}
                onConfirm={handleRevoke}
                onCancel={() => setRevokeTarget(null)}
            />
        </div>
    );
}
