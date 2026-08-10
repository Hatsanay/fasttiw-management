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
import CategoryTabs from "@/components/ui/CategoryTabs";
import { usePermission, BITS } from "@/app/components/permission-provider";
import { useLatestRequest } from "@/app/lib/useLatestRequest";
import { clampPage } from "@/app/lib/clampPage";
import { toast } from "sonner";
import { FileUp, Eye } from "lucide-react";

type Product = {
    prod_id: string;
    prod_name: string;
    prod_price: number;
    prod_is_free: boolean;
    prod_cover_url: string | null;
    prod_status: "draft" | "published" | "archived";
    prod_category_name: string | null;
    prod_created_at: string;
    prod_updated_at: string;
};

type Category = { cat_id: string; cat_name: string };

const SERVER_BASE = new URL(api).origin;
const PAGE_SIZE_OPTIONS = [24, 48, 96, 192];

const STATUS_LABEL: Record<Product["prod_status"], string> = {
    draft: "แบบร่าง",
    published: "เผยแพร่แล้ว",
    archived: "เก็บเข้าคลัง",
};

const STATUS_BADGE: Record<Product["prod_status"], string> = {
    draft: "bg-gray-100 text-gray-500",
    published: "bg-green-50 text-green-600",
    archived: "bg-amber-50 text-amber-600",
};

async function fetchProducts(params: { limit: number; offset: number; search: string; categoryId: string }) {
    const query = new URLSearchParams({
        limit: String(params.limit),
        offset: String(params.offset),
        search: params.search,
    });
    if (params.categoryId) query.set("category_id", params.categoryId);
    const res = await fetch(`${api}/products?${query}`, { headers: authHeader() });
    if (!res.ok) return { data: [] as Product[], total: 0 };
    return res.json() as Promise<{ data: Product[]; total: number }>;
}

async function fetchAllCategories(): Promise<Category[]> {
    const query = new URLSearchParams({ limit: "100", offset: "0", status: "active", search: "" });
    const res = await fetch(`${api}/categories?${query}`, { headers: authHeader() });
    if (!res.ok) return [];
    const { data } = await res.json() as { data: Category[] };
    return data;
}

export default function ProductsPage() {
    const router = useRouter();
    const hasBit = usePermission();

    const [isPending, startTransition] = useTransition();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(24);
    const [categoryId, setCategoryId] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { begin, isCurrent } = useLatestRequest();

    function reload() {
        const limit = pageSize === -1 ? 99999 : pageSize;
        const offset = pageSize === -1 ? 0 : (page - 1) * pageSize;
        const token = begin();
        startTransition(async () => {
            const result = await fetchProducts({ limit, offset, search, categoryId });
            if (!isCurrent(token)) return; // มี reload() ใหม่กว่าเริ่มไปแล้วระหว่างรอ ทิ้งผลลัพธ์นี้
            setProducts(result.data);
            setTotal(result.total);

            const correctPage = clampPage(result.total, pageSize, page);
            if (correctPage !== page) setPage(correctPage); // total ลดลงจนหน้าปัจจุบันเกินขอบเขต — เด้งกลับหน้าที่มีข้อมูลจริง
        });
    }

    useEffect(() => {
        fetchAllCategories().then(setCategories);
    }, []);

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, pageSize, categoryId]);

    function handleCategoryChange(id: string) {
        setCategoryId(id);
        setPage(1);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${api}/products/${deleteTarget.prod_id}`, {
                method: "DELETE",
                headers: authHeader(),
            });
            if (res.ok) {
                toast.success(`ลบ "${deleteTarget.prod_name}" สำเร็จ`);
                reload(); // โหลดใหม่แทนตัดออกจาก state เฉยๆ กัน total/หน้าปัจจุบันไม่ตรงกับข้อมูลจริง
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message ?? "ลบไม่สำเร็จ กรุณาลองใหม่");
            }
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
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

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">จัดการชุดข้อสอบ</h1>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => router.push("/question-reports")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        แจ้งปัญหารายข้อ
                    </button>
                    {hasBit(BITS.createProduct) && (
                        <Button onClick={() => router.push("/products/create")}>สร้างชุดข้อสอบ</Button>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <CategoryTabs categories={categories} value={categoryId} onChange={handleCategoryChange} />
            </div>

            <SearchInput value={search} onChange={handleSearch} placeholder="ค้นหาชุดข้อสอบ..." className="w-full sm:w-72 mb-4" />

            {isPending ? (
                <p className="text-gray-400 text-sm">กำลังโหลด...</p>
            ) : total === 0 ? (
                <p className="text-gray-400 text-sm">
                    {search || categoryId ? "ไม่พบชุดข้อสอบที่ตรงกับเงื่อนไข" : "ยังไม่มีชุดข้อสอบ — ลองสร้างชุดข้อสอบใหม่"}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {products.map((p, i) => (
                            <div
                                key={p.prod_id}
                                onClick={() => router.push(`/products/questions?id=${p.prod_id}`)}
                                className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="relative w-full aspect-3/4 bg-gray-50 shrink-0">
                                    <Image
                                        src={p.prod_cover_url ? `${SERVER_BASE}${p.prod_cover_url}` : "/defult.png"}
                                        alt={p.prod_name}
                                        fill
                                        unoptimized={!!p.prod_cover_url}
                                        priority={i < 6}
                                        className="object-cover"
                                    />
                                    <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${STATUS_BADGE[p.prod_status]}`}>
                                        {STATUS_LABEL[p.prod_status]}
                                    </span>
                                </div>

                                <div className="p-2 flex flex-col gap-0.5">
                                    <h3 className="font-semibold text-gray-800 text-xs leading-snug line-clamp-2">{p.prod_name}</h3>
                                    <p className="text-xs font-medium text-gray-700">
                                        {p.prod_is_free ? <span className="text-green-600 font-semibold">ฟรี</span> : formatBaht(p.prod_price)}
                                    </p>

                                    {/* stopPropagation กันไม่ให้ click ปุ่มพวกนี้ไปสั่ง navigate ของการ์ดซ้ำ */}
                                    <div className="pt-1.5 flex items-center justify-end gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => router.push(`/products/preview?id=${p.prod_id}`)}
                                            title="พรีวิวก่อน publish"
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition-colors duration-200 font-medium"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {hasBit(BITS.createProduct) && (
                                            <button
                                                onClick={() => router.push(`/products/import?id=${p.prod_id}`)}
                                                title="นำเข้าคำถาม"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded transition-colors duration-200 font-medium"
                                            >
                                                <FileUp className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {hasBit(BITS.editProduct) && (
                                            <EditButton onClick={() => router.push(`/products/edit?id=${p.prod_id}`)} />
                                        )}
                                        {hasBit(BITS.deleteProduct) && (
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
                title="ลบชุดข้อสอบนี้?"
                description={deleteTarget ? `"${deleteTarget.prod_name}" จะถูกลบและไม่สามารถกู้คืนได้ (รวมถึงคำถามทั้งหมดในชุดนี้ด้วย)` : undefined}
                confirmLabel="ลบ"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
