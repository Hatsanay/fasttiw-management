"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import { formatBaht } from "@/app/function";
import EditButton from "@/components/ui/Button/EditButton";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";
import { ArrowLeft, ArchiveRestore, Eye } from "lucide-react";

type Product = {
    prod_id: string;
    prod_name: string;
    prod_price: number;
    prod_is_free: boolean;
    prod_cover_url: string | null;
};

const SERVER_BASE = new URL(api).origin;
const PAGE_SIZE_OPTIONS = [24, 48, 96, 192];

async function fetchArchivedProducts(params: { limit: number; offset: number; search: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
        status: "archived",
    });
    const res = await fetch(`${api}/products?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Product[], total: 0 };
    return res.json() as Promise<{ data: Product[]; total: number }>;
}

// หน้าคลังจัดเก็บ — โชว์เฉพาะชุดข้อสอบที่ archived (ซ่อนจากลูกค้าแล้ว) แยกจากหน้าจัดการหลักเพื่อไม่ให้ปน
// กับของที่ยังใช้งานปกติอยู่ — มีแค่ปุ่มกู้คืน/พรีวิว/แก้ไข ไม่มีปุ่มลบ (ถ้าจะลบจริงให้กู้คืนก่อนแล้วไปลบที่
// หน้าจัดการหลัก รวมจุด logic การลบไว้ที่เดียว)
export default function ArchivedProductsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const [isPending, startTransition] = useTransition();
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(24);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchArchivedProducts({ limit, offset, search });
            if (!isCurrent(token)) return;
            setProducts(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage);
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

    async function handleRestore(product: Product) {
        setRestoringId(product.prod_id);
        try {
            const res = await fetch(`${api}/products/${product.prod_id}/status`, {
                method: "PUT",
                headers: { ...authHeader(), "Content-Type": "application/json" },
                body: JSON.stringify({ prod_status: "draft" }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success(`กู้คืน "${product.prod_name}" แล้ว (สถานะเป็นแบบร่าง กดเผยแพร่ต่อได้ที่หน้าแก้ไข)`);
                reload();
            } else {
                toast.error(data.message ?? "กู้คืนไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setRestoringId(null);
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => router.push("/products")}
                        className="p-1.5 text-gray-400 hover:text-gray-600 -ml-1.5"
                        aria-label="กลับไปหน้าจัดการชุดข้อสอบ"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">คลังจัดเก็บ</h1>
                </div>
            </div>

            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาชุดข้อสอบที่เก็บเข้าคลัง..." className="w-full sm:w-72 mb-4" />

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">
                    {search ? "ไม่พบชุดข้อสอบที่ตรงกับเงื่อนไข" : "ยังไม่มีชุดข้อสอบที่เก็บเข้าคลัง"}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {products.map((p, i) => (
                            <div
                                key={p.prod_id}
                                className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col opacity-80"
                            >
                                <div className="relative w-full aspect-3/4 bg-gray-50 shrink-0">
                                    <Image
                                        src={p.prod_cover_url ? `${SERVER_BASE}${p.prod_cover_url}` : "/defult.png"}
                                        alt={p.prod_name}
                                        fill
                                        unoptimized={!!p.prod_cover_url}
                                        priority={i < 6}
                                        className="object-cover grayscale"
                                    />
                                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-600">
                                        เก็บเข้าคลัง
                                    </span>
                                </div>

                                <div className="p-2 flex flex-col gap-0.5">
                                    <h3 className="font-semibold text-gray-800 text-xs leading-snug line-clamp-2">{p.prod_name}</h3>
                                    <p className="text-xs font-medium text-gray-700">
                                        {p.prod_is_free ? <span className="text-green-600 font-semibold">ฟรี</span> : formatBaht(p.prod_price)}
                                    </p>

                                    <div className="pt-1.5 flex items-center justify-end gap-1 flex-wrap">
                                        <button
                                            onClick={() => router.push(`/products/preview?id=${p.prod_id}`)}
                                            title="พรีวิว"
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-colors duration-200 font-medium"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {hasBit(BITS.editProduct) && (
                                            <EditButton onClick={() => router.push(`/products/edit?id=${p.prod_id}`)} />
                                        )}
                                        {hasBit(BITS.deleteProduct) && (
                                            <button
                                                onClick={() => handleRestore(p)}
                                                disabled={restoringId === p.prod_id}
                                                title="กู้คืนชุดข้อสอบ"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs rounded transition-colors duration-200 font-medium"
                                            >
                                                <ArchiveRestore className="w-3.5 h-3.5" />
                                            </button>
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
        </div>
    );
}
