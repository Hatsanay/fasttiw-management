"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import Button from "@/components/ui/Button/Button";
import EditButton from "@/components/ui/Button/EditButton";
import DeleteButton from "@/components/ui/Button/DeleteButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";

type Package = {
    pkg_id: string;
    pkg_name: string;
    pkg_price: number;
    pkg_cover_url: string | null;
    pkg_status: "draft" | "published" | "archived";
    product_count: number;
    pkg_created_at: string;
};

const SERVER_BASE = new URL(api).origin;
const PAGE_SIZE_OPTIONS = [24, 48, 96, 192];

const STATUS_LABEL: Record<Package["pkg_status"], string> = {
    draft: "ฉบับร่าง",
    published: "เผยแพร่แล้ว",
    archived: "เก็บถาวร",
};

const STATUS_BADGE: Record<Package["pkg_status"], string> = {
    draft: "bg-gray-100 text-gray-500",
    published: "bg-green-50 text-green-600",
    archived: "bg-amber-50 text-amber-600",
};

async function fetchPackages(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    const res = await fetch(`${api}/packages?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Package[], total: 0 };
    return res.json() as Promise<{ data: Package[]; total: number }>;
}

export default function PackagesPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const [isPending, startTransition] = useTransition();
    const [packages, setPackages] = useState<Package[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(24);

    const [deleteTarget, setDeleteTarget] = useState<Package | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchPackages({ limit, offset, search });
            if (!isCurrent(token)) return; // มี reload() ใหม่กว่าเริ่มไปแล้วระหว่างรอ ทิ้งผลลัพธ์นี้
            setPackages(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage); // total ลดลงจนหน้าปัจจุบันเกินขอบเขต — เด้งกลับหน้าที่มีข้อมูลจริง
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

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/packages/${deleteTarget.pkg_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.pkg_name}" สำเร็จ`);
                reload();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">แพ็กเกจรวมชุด</h1>
                {hasBit(BITS.createPackage) && (
                    <Button onClick={() => router.push("/packages/create")}>สร้างแพ็กเกจ</Button>
                )}
            </div>

            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาชื่อแพ็กเกจ..." className="w-full sm:w-72 mb-4" />

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">
                    {search ? "ไม่พบแพ็กเกจที่ตรงกับเงื่อนไข" : "ยังไม่มีแพ็กเกจ — ลองสร้างแพ็กเกจใหม่"}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {packages.map((p, i) => (
                            <div
                                key={p.pkg_id}
                                onClick={() => router.push(`/packages/edit?id=${p.pkg_id}`)}
                                className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="relative w-full aspect-3/4 bg-gray-50 shrink-0">
                                    <Image
                                        src={p.pkg_cover_url ? `${SERVER_BASE}${p.pkg_cover_url}` : "/defult.png"}
                                        alt={p.pkg_name}
                                        fill
                                        unoptimized={!!p.pkg_cover_url}
                                        priority={i < 6}
                                        className="object-cover"
                                    />
                                    <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${STATUS_BADGE[p.pkg_status]}`}>
                                        {STATUS_LABEL[p.pkg_status]}
                                    </span>
                                </div>

                                <div className="p-2 flex flex-col gap-0.5">
                                    <h3 className="font-semibold text-gray-800 text-xs leading-snug line-clamp-2">{p.pkg_name}</h3>
                                    <p className="text-xs text-gray-400">{p.product_count} ชุด</p>
                                    <p className="text-xs font-medium text-gray-700">
                                        {formatBaht(p.pkg_price)}
                                    </p>

                                    {/* stopPropagation กันไม่ให้ click ปุ่มพวกนี้ไปสั่ง navigate ของการ์ดซ้ำ */}
                                    <div className="pt-1.5 flex items-center justify-end gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                        {hasBit(BITS.editPackage) && (
                                            <EditButton onClick={() => router.push(`/packages/edit?id=${p.pkg_id}`)} />
                                        )}
                                        {hasBit(BITS.deletePackage) && (
                                            <DeleteButton onClick={() => setDeleteTarget(p)} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                        />
                    </div>
                </>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="ลบแพ็กเกจนี้?"
                description={deleteTarget ? `"${deleteTarget.pkg_name}" จะถูกลบและไม่สามารถกู้คืนได้` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
