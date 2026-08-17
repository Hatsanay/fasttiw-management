"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { toDateInput } from "@/app/lib/date";
import DataTable, { Column } from "@/components/ui/datatable/datatable";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { formatBaht } from "@/app/function";
import { toast } from "sonner";
import { Users } from "lucide-react";

type Partner = {
    user_id: string;
    fullname: string;
    user_email: string;
    share_percent: number;
};

type ShareRow = { user_id: string; fullname: string; share_percent: number; share_amount: number };
type ShareData = { profit: number; dividend_percent: number; dividend_amount: number; total_share_percent: number; partners: ShareRow[] };
type PresetKey = "this_month" | "last_month" | "this_year" | "custom";

async function loadStaffOptions(search: string) {
    const res = await fetch(`${api}/users?${new URLSearchParams({ limit: "20", offset: "0", search })}`, {
        headers: authHeader(),
    });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: { user_id: string; by_fullname: string }[] };
    return data.map((u) => ({ value: u.user_id, label: u.by_fullname }));
}

async function fetchPartners(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit), offset: String(params.offset), search: params.search,
    });
    const res = await fetch(`${api}/partners?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Partner[], total: 0 };
    return res.json() as Promise<{ data: Partner[]; total: number }>;
}


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

async function fetchShare(from: string, to: string): Promise<ShareData | null> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const res = await fetch(`${api}/reports/partner-share?${query}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

export default function PartnersPage() {
    const hasBit = usePermission();
    const router = useRouter();

    const columns: Column<Partner>[] = [
        { key: "fullname", header: "หุ้นส่วน" },
        { key: "user_email", header: "อีเมล" },
        { key: "share_percent", header: "สัดส่วนหุ้น", render: (v) => `${Number(v)}%` },
    ];

    const [isPending, startTransition] = useTransition();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [formUserId, setFormUserId] = useState("");
    const [formSharePercent, setFormSharePercent] = useState("");
    const [formErrors, setFormErrors] = useState<{ staff?: string; share?: string }>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingExisting, setEditingExisting] = useState(false);

    function handleStaffChange(v: string) {
        setFormUserId(v);
        if (formErrors.staff) setFormErrors((prev) => ({ ...prev, staff: undefined }));
    }

    function handleSharePercentChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFormSharePercent(e.target.value);
        if (formErrors.share) setFormErrors((prev) => ({ ...prev, share: undefined }));
    }

    const [removeTarget, setRemoveTarget] = useState<Partner | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    const [preset, setPreset] = useState<PresetKey>("this_month");
    // lazy initializer แทนการ setState ในเอฟเฟกต์ตอน mount (กัน cascading render)
    const [from, setFrom] = useState(() => presetRange("this_month").from);
    const [to, setTo] = useState(() => presetRange("this_month").to);
    const [share, setShare] = useState<ShareData | null>(null);
    const [shareLoading, setShareLoading] = useState(false);

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        startTransition(async () => {
            const result = await fetchPartners({ limit, offset, search });
            setPartners(result.data);
            setTotal(result.total);
        });
    }

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize]);

    useEffect(() => {
        if (!from && !to) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ต้องตั้ง loading ก่อน fetch async เริ่ม
        setShareLoading(true);
        fetchShare(from, to).then((result) => {
            setShare(result);
            setShareLoading(false);
        });
    }, [from, to]);

    function handlePresetChange(value: PresetKey) {
        setPreset(value);
        if (value !== "custom") {
            const range = presetRange(value);
            setFrom(range.from);
            setTo(range.to);
        }
    }

    function handleSearch(val: string) {
        setSearch(val);
        setPage(1);
    }

    function handlePageSizeChange(size: number) {
        setPageSize(size);
        setPage(1);
    }

    function startEdit(partner: Partner) {
        setEditingExisting(true);
        setFormUserId(partner.user_id);
        setFormSharePercent(String(partner.share_percent));
        setFormErrors({});
        setFormError(null);
    }

    function resetForm() {
        setEditingExisting(false);
        setFormUserId("");
        setFormSharePercent("");
        setFormErrors({});
        setFormError(null);
    }

    function handleSubmitForm(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError(null);

        const fieldErrors: { staff?: string; share?: string } = {};
        if (!formUserId) fieldErrors.staff = "กรุณาเลือกพนักงาน";
        const shareNum = Number(formSharePercent);
        if (!formSharePercent || !Number.isFinite(shareNum) || shareNum <= 0 || shareNum > 100) {
            fieldErrors.share = "กรุณากรอกสัดส่วนหุ้น (0-100)";
        }
        if (Object.keys(fieldErrors).length > 0) { setFormErrors(fieldErrors); return; }

        setIsSaving(true);
        startTransition(async () => {
            try {
                const res = await fetch(`${api}/partners`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", ...authHeader() },
                    body: JSON.stringify({ user_id: formUserId, share_percent: shareNum }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setFormError(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                    return;
                }
                toast.success(editingExisting ? "แก้ไขสัดส่วนหุ้นสำเร็จ" : "เพิ่มหุ้นส่วนสำเร็จ");
                resetForm();
                reload();
            } finally {
                setIsSaving(false);
            }
        });
    }

    async function handleRemove() {
        if (!removeTarget) return;
        setIsRemoving(true);
        try {
            const res = await fetch(`${api}/partners/${removeTarget.user_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success("ถอดออกจากหุ้นส่วนสำเร็จ");
                reload();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsRemoving(false);
            setRemoveTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">หุ้นส่วน</h1>
                {hasBit(BITS.partnerDistributionsManagement) && (
                    <button
                        type="button"
                        onClick={() => router.push("/partners/distributions")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 w-fit"
                    >
                        จ่ายส่วนแบ่งกำไรหุ้นส่วน
                    </button>
                )}
            </div>
            <p className="text-sm text-gray-400 mb-4">จัดการรายชื่อหุ้นส่วนและสัดส่วนแบ่งกำไร</p>

            {hasBit(BITS.editPartner) && (
                <form onSubmit={handleSubmitForm} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-50">
                        <label className="block text-xs font-medium text-gray-500 mb-1">พนักงาน</label>
                        <SearchableSelect
                            loadOptions={loadStaffOptions}
                            value={formUserId}
                            onChange={handleStaffChange}
                            placeholder="— เลือกพนักงาน —"
                            disabled={editingExisting}
                            error={!!formErrors.staff}
                        />
                        {formErrors.staff && <p className="text-xs text-red-500 mt-1">{formErrors.staff}</p>}
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-medium text-gray-500 mb-1">สัดส่วนหุ้น (%)</label>
                        <Input
                            type="number" min={0} max={100} step="0.01"
                            value={formSharePercent}
                            onChange={handleSharePercentChange}
                            className="w-full"
                            error={!!formErrors.share}
                        />
                        {formErrors.share && <p className="text-xs text-red-500 mt-1">{formErrors.share}</p>}
                    </div>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? "กำลังบันทึก..." : editingExisting ? "บันทึกการแก้ไข" : "เพิ่มหุ้นส่วน"}
                    </Button>
                    {editingExisting && (
                        <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                            ยกเลิก
                        </button>
                    )}
                    {formError && <p className="w-full text-sm text-red-600">{formError}</p>}
                </form>
            )}

            <DataTable
                columns={columns}
                data={partners}
                rowKey="user_id"
                loading={isPending}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                searchable
                searchValue={search}
                onSearch={handleSearch}
                searchPlaceholder="ค้นหาชื่อหุ้นส่วน..."
                actions={(row) => (
                    <div className="flex items-center gap-2 justify-end">
                        {hasBit(BITS.editPartner) && <EditButton onClick={() => startEdit(row)} />}
                        {hasBit(BITS.editPartner) && <DeleteButton onClick={() => setRemoveTarget(row)} />}
                    </div>
                )}
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-700">ส่วนแบ่งกำไรตามช่วงเวลา</h2>
                    </div>
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
                        {preset === "custom" && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                                <span className="text-sm text-gray-400">ถึง</span>
                                <input
                                    type="date" value={to} onChange={(e) => setTo(e.target.value)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {shareLoading || !share ? (
                    <p className="text-sm text-gray-400 py-10 text-center">กำลังโหลด...</p>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 px-5 pt-4">
                            กำไรสุทธิในช่วงเวลานี้ {formatBaht(share.profit)} — ตามนโยบายจ่ายปันผล {share.dividend_percent}% จะประกาศจ่ายปันผลรวม {formatBaht(share.dividend_amount)}
                            {" "}(ที่เหลือกันไว้เป็นทุนสำรอง/กำไรสะสมของบริษัท) — รวมสัดส่วนหุ้นที่ตั้งไว้ {share.total_share_percent}%
                            {share.total_share_percent > 100 && (
                                <span className="text-red-500 font-medium"> (รวมเกิน 100% กรุณาตรวจสอบ)</span>
                            )}
                        </p>
                        {share.dividend_percent === 0 && (
                            <p className="text-xs text-amber-600 px-5 pt-1">
                                ยังไม่ได้ตั้ง % จ่ายปันผล ส่วนแบ่งกำไรด้านล่างจึงเป็น 0 บาททุกคน — ไปตั้งค่าที่{" "}
                                <a href="/settings/dividend" className="underline">หน้าตั้งค่าการจัดสรรกำไร</a>
                            </p>
                        )}

                        {share.partners.length === 0 ? (
                            <p className="text-sm text-gray-400 py-10 text-center pb-5">ยังไม่มีหุ้นส่วนในระบบ</p>
                        ) : (
                            <div className="overflow-x-auto mt-4 pb-2">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-gray-400">
                                            <th className="text-left font-medium px-5 py-2">หุ้นส่วน</th>
                                            <th className="text-right font-medium px-5 py-2">สัดส่วนหุ้น</th>
                                            <th className="text-right font-medium px-5 py-2">ส่วนแบ่งปันผล ({share.dividend_percent}%)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {share.partners.map((p) => (
                                            <tr key={p.user_id} className="border-b border-gray-50 last:border-0">
                                                <td className="px-5 py-3 text-gray-700">{p.fullname}</td>
                                                <td className="px-5 py-3 text-right text-gray-500">{p.share_percent}%</td>
                                                <td className={`px-5 py-3 text-right font-medium ${p.share_amount >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                                    {formatBaht(p.share_amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ConfirmDialog
                open={!!removeTarget}
                title="ถอดออกจากหุ้นส่วน?"
                description={removeTarget ? `"${removeTarget.fullname}" จะไม่ได้รับส่วนแบ่งกำไรอีกต่อไป (ไม่ได้ลบผู้ใช้งานออกจากระบบ)` : undefined}
                confirmLabel="ถอดออก"
                loading={isRemoving}
                onConfirm={handleRemove}
                onCancel={() => setRemoveTarget(null)}
            />
        </div>
    );
}
