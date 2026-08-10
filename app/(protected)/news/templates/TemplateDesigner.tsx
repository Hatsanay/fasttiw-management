"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, Trash2, Plus, Boxes } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import {
    type BlockType, type CellData, type ItemForm, type GridCellForm, type ExistingGridCell,
    PREMADE_DEFS, BASIC_DEFS, ALL_DEFS, newCellData, gridCellFromExisting, cellDataToPayload,
    CellTypeContent,
} from "../cellEditors";

const GRID_COLS = 12;
const ROW_HEIGHT = 30;
const PALETTE_DEFS = [...PREMADE_DEFS, ...BASIC_DEFS];

export type ExistingTemplate = { tpl_id: string; tpl_name: string; tpl_structure: ExistingGridCell[] };

function newGridCell(type: BlockType, x: number, y: number): GridCellForm {
    return { ...newCellData(type), x, y, w: 4, h: 6 };
}

// การ์ด 1 ช่องบนกริด — มีแถบ drag-handle เล็กๆ ด้านบน (ไอคอน+ชื่อ type+ปุ่มลบ) จำกัดการลากไว้แค่แถบนี้
// (dragConfig.handle=".cell-drag-handle") กันไม่ให้การคลิก/พิมพ์ในฟอร์มข้างในโดนตีความเป็นการลากช่องแทน
function GridCellWrapper({ cell, onChange, onRemove }: {
    cell: GridCellForm; onChange: (patch: Partial<CellData>) => void; onRemove: () => void;
}) {
    const def = ALL_DEFS.find((w) => w.type === cell.blk_type);
    const Icon = def?.icon ?? Boxes;
    return (
        <div className="h-full flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm">
            <div className="cell-drag-handle flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border-b border-gray-100 cursor-grab active:cursor-grabbing touch-none shrink-0">
                <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                <Icon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 truncate">{def?.label ?? cell.blk_type}</span>
                <button type="button" onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
                <CellTypeContent data={cell} onChange={onChange} />
            </div>
        </div>
    );
}

// หน้าออกแบบ widget "สร้างเอง" — ลากช่อง (พื้นฐาน + widget สำเร็จรูปอื่นๆ) มาวางบนกริด 12 คอลัมน์ ลากย่อ/
// ขยายตำแหน่ง-ขนาดได้อิสระด้วย react-grid-layout จริง (ไม่ใช่แค่ preview) บันทึกแล้วไปโผล่เป็นตัวเลือกใหม่
// ในชั้นวางของฟีดหลัก ลากไปใช้ซ้ำได้หลายจุด (แก้ template ทีหลังไม่กระทบจุดที่ใช้ไปแล้ว เพราะลากเข้าฟีด =
// clone โครงสร้างเป็นอิสระตั้งแต่ตอนนั้น)
export default function TemplateDesigner({ mode, initialTemplate }: { mode: "create" | "edit"; initialTemplate?: ExistingTemplate }) {
    const router = useRouter();
    const [name, setName] = useState(initialTemplate?.tpl_name ?? "");
    const [cells, setCells] = useState<GridCellForm[]>(initialTemplate?.tpl_structure.map(gridCellFromExisting) ?? []);
    const [isSaving, setIsSaving] = useState(false);
    const { width, containerRef, mounted } = useContainerWidth();

    const layout: Layout = cells.map((c) => ({ i: c.key, x: c.x, y: c.y, w: c.w, h: c.h }));

    function updateCell(key: string, patch: Partial<CellData>) {
        setCells((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    }
    // เขียนผลอัปโหลดรูปกลับเข้า item ที่ซ้อนอยู่ในช่อง (ชุด Card/Carousel) — ถ้าไม่เขียนกลับ imageFile จะยัง
    // ค้างอยู่ใน state แล้วกดบันทึกซ้ำจะส่งค่าว่างไปทับของที่เพิ่งอัปโหลดสำเร็จไปแล้วโดยไม่ตั้งใจ
    function updateCellItem(cellKey: string, itemKey: string, patch: Partial<ItemForm>) {
        setCells((prev) => prev.map((c) => (
            c.key === cellKey ? { ...c, items: c.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) } : c
        )));
    }
    function removeCell(key: string) {
        setCells((prev) => prev.filter((c) => c.key !== key));
    }
    function addCell(type: BlockType) {
        // วางที่แถวถัดจากช่องล่างสุดเสมอ (ไม่มีทางชนกับช่องที่มีอยู่แล้ว) แอดมินค่อยลากไปตำแหน่งที่ต้องการเอง
        const maxY = cells.reduce((m, c) => Math.max(m, c.y + c.h), 0);
        setCells((prev) => [...prev, newGridCell(type, 0, maxY)]);
    }
    function handleLayoutChange(newLayout: Layout) {
        setCells((prev) => prev.map((c) => {
            const li = newLayout.find((l) => l.i === c.key);
            return li ? { ...c, x: li.x, y: li.y, w: li.w, h: li.h } : c;
        }));
    }

    async function handleSave() {
        if (!name.trim()) { toast.error("กรุณากรอกชื่อ widget"); return; }
        if (cells.length === 0) { toast.error("กรุณาเพิ่มอย่างน้อย 1 องค์ประกอบ"); return; }

        setIsSaving(true);
        try {
            const structure = cells.map((c) => ({ ...cellDataToPayload(c), x: c.x, y: c.y, w: c.w, h: c.h }));
            const url = mode === "create" ? `${api}/news/templates` : `${api}/news/templates/${initialTemplate!.tpl_id}`;
            const method = mode === "create" ? "POST" : "PUT";
            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ tpl_name: name.trim(), structure }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
                setIsSaving(false);
                return;
            }

            const tpl_id: string = mode === "create" ? data.tpl_id : initialTemplate!.tpl_id;

            // อัปโหลดรูปแยกทีหลัง (endpoint หลักรับ JSON ส่วนรูปต้องเป็น multipart) เหมือน widget อื่นทุกแบบ —
            // อ้างอิงด้วย key ของ cell/item เอง (server เก็บ key เดียวกับที่ client ส่งไปตรงๆ ไม่ได้สร้างใหม่)
            const uploadFailures: string[] = [];
            const tasks: Promise<unknown>[] = [];
            cells.forEach((c) => {
                if (c.imageFile) {
                    const fd = new FormData();
                    fd.append("image", c.imageFile);
                    tasks.push(
                        fetch(`${api}/news/templates/${tpl_id}/cells/${c.key}/image`, { method: "PUT", headers: authHeader(), body: fd })
                            .then(async (r) => {
                                if (!r.ok) throw new Error();
                                const json = await r.json();
                                updateCell(c.key, { imageFile: null, existingImageUrl: json.image_url });
                            })
                            .catch(() => uploadFailures.push(`รูปภาพช่อง "${ALL_DEFS.find((w) => w.type === c.blk_type)?.label ?? c.blk_type}"`))
                    );
                }
                c.items.forEach((it, ii) => {
                    if (!it.imageFile) return;
                    const fd = new FormData();
                    fd.append("image", it.imageFile);
                    tasks.push(
                        fetch(`${api}/news/templates/${tpl_id}/cells/${c.key}/items/${it.key}/image`, { method: "PUT", headers: authHeader(), body: fd })
                            .then(async (r) => {
                                if (!r.ok) throw new Error();
                                const json = await r.json();
                                updateCellItem(c.key, it.key, { imageFile: null, existingImageUrl: json.image_url });
                            })
                            .catch(() => uploadFailures.push(`รูปภาพรายการที่ ${ii + 1}`))
                    );
                });
            });
            await Promise.all(tasks);

            if (uploadFailures.length > 0) {
                toast.error(`บันทึก widget สำเร็จ แต่แนบรูปไม่สำเร็จ: ${uploadFailures.join(", ")}`);
            } else {
                toast.success(mode === "create" ? "สร้าง widget สำเร็จ" : "แก้ไข widget สำเร็จ");
            }
            router.push("/news");
        } catch {
            toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
            setIsSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อ widget เช่น แบนเนอร์โปรโมชั่นหน้าแรก"
                    className="flex-1"
                />
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "กำลังบันทึก..." : "บันทึก widget"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
                <aside className="flex flex-col gap-2 lg:sticky lg:top-6 h-fit">
                    <p className="text-xs font-medium text-gray-500 mb-1">คลิกเพื่อวางบนกริด แล้วลากย่อ/ขยาย-ย้ายตำแหน่งได้อิสระ</p>
                    {PALETTE_DEFS.map((w) => (
                        <button
                            key={w.type}
                            type="button"
                            onClick={() => addCell(w.type)}
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                        >
                            <w.icon className="w-4 h-4 text-gray-400" />
                            {w.label}
                            <Plus className="w-3.5 h-3.5 ml-auto text-gray-300" />
                        </button>
                    ))}
                </aside>

                <div ref={containerRef} className="relative border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 min-h-[28rem]">
                    {cells.length === 0 && (
                        <p className="absolute inset-0 flex items-center justify-center text-center text-gray-400 text-sm px-6">
                            คลิก widget ด้านซ้ายเพื่อเริ่มวางบนกริด
                        </p>
                    )}
                    {mounted && cells.length > 0 && (
                        <ReactGridLayout
                            layout={layout}
                            width={width}
                            gridConfig={{ cols: GRID_COLS, rowHeight: ROW_HEIGHT, margin: [10, 10], containerPadding: [10, 10] }}
                            dragConfig={{ handle: ".cell-drag-handle" }}
                            onLayoutChange={handleLayoutChange}
                        >
                            {cells.map((c) => (
                                <div key={c.key}>
                                    <GridCellWrapper
                                        cell={c}
                                        onChange={(patch) => updateCell(c.key, patch)}
                                        onRemove={() => removeCell(c.key)}
                                    />
                                </div>
                            ))}
                        </ReactGridLayout>
                    )}
                </div>
            </div>
        </div>
    );
}
