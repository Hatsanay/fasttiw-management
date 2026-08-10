"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable,
    type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Boxes, Home } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import {
    type BlockType, type CellData, type ItemForm, type ExistingCellContent,
    type GridCellForm, type ExistingGridCell, REPEATING_TYPES,
    PREMADE_DEFS, BASIC_DEFS, ALL_DEFS, newCellData, cellDataFromExisting, cellDataToPayload, gridCellFromExisting,
    CellTypeContent,
} from "./cellEditors";

// widget 1 ชิ้นในฟีด — ทุก type ใช้ CellData ร่วมกัน ยกเว้น "custom" ที่เนื้อหาจริงอยู่ใน customStructure
// แทน (กริดของหลายช่อง ไม่ใช่ field เดียวเหมือน type อื่น) — เก็บไว้ในฟิลด์เดียวกันทุก type (ปล่อยว่างเปล่า
// สำหรับ type ที่ไม่ใช้) ตามแบบแผนเดิมของระบบ (เช่น itemsPerView ก็ใช้เฉพาะ card_set เท่านั้น) — blk_type
// ต้อง Omit แล้วประกาศใหม่เพราะ "custom" ไม่ได้อยู่ใน BlockType ของ cellEditors (กันซ้อนไม่รู้จบในช่องของ
// widget สร้างเอง) แต่ระดับบนสุดในฟีดต้องมีได้
type BlockForm = Omit<CellData, "blk_type"> & {
    blk_type: BlockType | "custom";
    status: "draft" | "published";
    showOnLanding: boolean; // ติ๊ก "เผยแพร่ใน landing page" — เป็นอิสระจาก status โดยตั้งใจ (ติ๊กไว้ตอนยัง
                            // draft ก็ขึ้นหน้าแรกได้เลย ไม่ต้องเผยแพร่ในฟีดข่าวสารเต็มก่อน)
    customStructure: GridCellForm[];
};

export type ExistingBlock = Omit<ExistingCellContent, "blk_type"> & {
    blk_id: string;
    blk_type: BlockType | "custom";
    blk_status: "draft" | "published";
    blk_show_on_landing: boolean;
    blk_custom_structure: ExistingGridCell[] | null;
};

type TemplateSummary = { tpl_id: string; tpl_name: string };
type TemplateDetail = { tpl_id: string; tpl_name: string; tpl_structure: ExistingGridCell[] };

function newBlock(type: BlockType): BlockForm {
    return { ...newCellData(type), status: "draft", showOnLanding: false, customStructure: [] };
}

function blockFromExisting(b: ExistingBlock): BlockForm {
    if (b.blk_type === "custom") {
        return {
            ...newCellData("card"), // เนื้อหาไม่ถูกใช้จริงสำหรับ custom (อยู่ใน customStructure แทน)
            blk_type: "custom",
            status: b.blk_status,
            showOnLanding: b.blk_show_on_landing,
            customStructure: (b.blk_custom_structure ?? []).map(gridCellFromExisting),
        };
    }
    return {
        ...cellDataFromExisting(b as ExistingCellContent),
        status: b.blk_status,
        showOnLanding: b.blk_show_on_landing,
        customStructure: [],
    };
}

// ลาก template (widget ที่สร้างเองผ่านกริด) เข้าฟีด = clone โครงสร้างมาเป็น block ใหม่ type "custom" —
// ต้องสุ่ม key ใหม่ทั้ง cell และ item ทุกอัน กันชนกับ template ต้นทาง/instance อื่นที่ clone ไปก่อนหน้า
// (แก้ template ทีหลังไม่กระทบ instance ที่ clone ไปแล้ว ตั้งใจให้เป็นอิสระต่อกันตั้งแต่ตอนลากเข้าฟีด)
function customBlockFromTemplate(tpl: TemplateDetail): BlockForm {
    return {
        ...newCellData("card"), // ค่าเนื้อหาพื้นฐานไม่ถูกใช้จริงสำหรับ custom (เนื้อหาอยู่ใน customStructure)
        key: crypto.randomUUID(),
        blk_type: "custom",
        status: "draft",
        showOnLanding: false,
        // gridCellFromExisting -> cellDataFromExisting สุ่ม key ใหม่ให้ทั้ง cell และ item ทุกอันอยู่แล้วในตัว
        // (เหมือนตอนโหลด block ปกติ) จึงไม่ชนกับ template ต้นทาง/instance อื่นที่เคย clone ไปก่อนหน้าโดยอัตโนมัติ
        customStructure: tpl.tpl_structure.map(gridCellFromExisting),
    };
}

type FormErrors = { blocks?: string };

function validate(blocks: BlockForm[]): FormErrors {
    const errors: FormErrors = {};
    for (const b of blocks) {
        if (b.blk_type === "custom") continue; // ไม่ตรวจฝั่ง client (จะซ้ำกับ logic ตรวจทีละ type ทุกช่อง) ปล่อยให้ backend ตรวจตอนบันทึกจริงแทน
        if ((b.blk_type === "text" || b.blk_type === "heading") && !b.text.trim()) {
            errors.blocks = "กรุณากรอกข้อความให้ครบทุก widget"; break;
        }
        if (b.blk_type === "button" && (!b.text.trim() || !b.linkUrl.trim())) {
            errors.blocks = "widget ปุ่มลิงก์ต้องกรอกข้อความบนปุ่มและลิงก์ปลายทางให้ครบ"; break;
        }
        if (b.blk_type === "youtube" && !b.linkUrl.trim()) {
            errors.blocks = "widget วิดีโอ YouTube ต้องกรอกลิงก์วิดีโอ"; break;
        }
        if (b.blk_type === "post" && !b.text.trim()) {
            errors.blocks = "widget โพสทั่วไปต้องกรอกเนื้อหา"; break;
        }
        if (b.blk_type === "card" && !b.title.trim()) {
            errors.blocks = "widget Card ต้องกรอกหัวข้อการ์ด"; break;
        }
        if (REPEATING_TYPES.includes(b.blk_type) && b.items.length === 0) {
            errors.blocks = "กรุณาเพิ่มอย่างน้อย 1 รายการในชุด Card/Carousel"; break;
        }
    }
    return errors;
}

// ─── ชิ้นส่วนในชั้นวาง (ซ้ายมือ) — ลาก handle ไปวางใน canvas ได้จริง หรือคลิกตรงๆ เพื่อเพิ่มต่อท้ายก็ได้
// (กันปัญหาการเข้าถึง/ผู้ใช้ที่ไม่ถนัดลาก ไม่ต้องพึ่งการลากอย่างเดียว) ───────────────────────────────
function PaletteItem({ type, label, Icon, onAdd }: { type: BlockType; label: string; Icon: typeof GripVertical; onAdd: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette-${type}`, data: { paletteType: type } });
    return (
        <button
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            type="button"
            onClick={onAdd}
            className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-700 transition-colors cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-40" : ""}`}
        >
            <Icon className="w-4 h-4 text-gray-400" />
            {label}
            <Plus className="w-3.5 h-3.5 ml-auto text-gray-300" />
        </button>
    );
}

// widget "สร้างเอง" ที่บันทึกไว้แล้ว — ลากเข้า canvas ได้เหมือน widget สำเร็จรูปทั่วไป มีลิงก์ "แก้ไข" เล็กๆ
// โผล่ตอน hover ให้กลับไปแก้ไข template ต้นทางได้ (ไม่กระทบ instance ที่ลากไปใช้ในฟีดแล้ว)
function TemplatePaletteItem({ tpl, onAdd }: { tpl: TemplateSummary; onAdd: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `template-${tpl.tpl_id}`, data: { templateId: tpl.tpl_id } });
    return (
        <div className="relative group">
            <button
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                type="button"
                onClick={onAdd}
                className={`flex items-center gap-2 w-full px-3 py-2.5 pr-12 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-700 transition-colors cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-40" : ""}`}
            >
                <Boxes className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{tpl.tpl_name}</span>
            </button>
            <Link
                href={`/news/templates/edit?id=${tpl.tpl_id}`}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-2 flex items-center opacity-0 group-hover:opacity-100 text-[11px] text-blue-500 hover:underline"
            >
                แก้ไข
            </Link>
        </div>
    );
}

// โซนวางตอน canvas ยังว่างเปล่า — ต้องเป็น droppable ของตัวเอง เพราะยังไม่มี block ให้ลากไปวางทับ
function EmptyCanvasDropzone() {
    const { setNodeRef, isOver } = useDroppable({ id: "canvas-empty" });
    return (
        <div
            ref={setNodeRef}
            className={`border-2 border-dashed rounded-lg py-14 text-center text-sm transition-colors ${
                isOver ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-200 text-gray-400"
            }`}
        >
            ลาก widget จากด้านซ้ายมาวางที่นี่ หรือคลิกเพื่อเพิ่ม
        </div>
    );
}

// สลับสถานะ draft/published ต่อ widget เอง — ไม่มี "โพสต์" ให้ผูกสถานะรวมแล้ว แต่ละ widget จึงเผยแพร่
// เป็นอิสระจากกัน (แอดมินซ่อน/โชว์ทีละชิ้นได้ระหว่างจัดฟีด)
function StatusToggle({ status, onChange }: { status: "draft" | "published"; onChange: (status: "draft" | "published") => void }) {
    return (
        <div className="flex rounded-full border border-gray-200 overflow-hidden text-[11px] shrink-0">
            <button
                type="button"
                onClick={() => onChange("draft")}
                className={`px-2 py-0.5 ${status === "draft" ? "bg-gray-600 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
            >
                ร่าง
            </button>
            <button
                type="button"
                onClick={() => onChange("published")}
                className={`px-2 py-0.5 ${status === "published" ? "bg-green-600 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
            >
                เผยแพร่
            </button>
        </div>
    );
}

// ติ๊กแยกว่าอยากให้ widget นี้ไปโชว์เป็น teaser ที่หน้าแรก (landing page) ของเว็บลูกค้าด้วยไหม — เป็นอิสระจาก
// สถานะเผยแพร่โดยตั้งใจ (ติ๊กไว้ตอนยัง "ร่าง" ก็ขึ้นหน้าแรกได้เลย ไม่ต้องเผยแพร่ในฟีดข่าวสารเต็มก่อน) แยกจาก
// StatusToggle เพราะเป็นคนละคำถาม (พร้อมให้เห็นในฟีดเต็ม vs อยากขึ้นหน้าแรก)
function LandingToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            title="เผยแพร่ใน landing page (หน้าแรกของเว็บลูกค้า)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] transition-colors shrink-0 ${
                checked ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-400 hover:text-gray-600"
            }`}
        >
            <Home className="w-3 h-3" />
            Landing page
        </button>
    );
}

// widget "สร้างเอง" ที่ลากมาใช้แล้ว — เป็น "widget สำเร็จรูปเปล่าๆ" ที่ต้องกรอกเนื้อหาจริงตอนใช้งานแต่ละจุด
// (ตำแหน่ง/ขนาดคงที่ตามที่ออกแบบไว้ในหน้า template ไม่ให้แก้ตรงนี้ — แก้ได้แค่เนื้อหา/รูปของแต่ละช่อง) จึง
// วางกริดตามตำแหน่ง x/y/w/h เดิมเป๊ะ (ไม่ใช้ react-grid-layout ซ้อนอีกชั้น เพราะไม่ต้องลาก/ย่อ-ขยายซ้ำแล้ว)
// แล้วเรนเดอร์แต่ละช่องด้วย CellTypeContent ตัวเดียวกับ widget อื่นทุกแบบ ให้แก้ไขได้จริงตรงนี้เลย
function CustomWidgetEditor({ structure, onChangeCell }: {
    structure: GridCellForm[]; onChangeCell: (cellKey: string, patch: Partial<CellData>) => void;
}) {
    return (
        <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: "30px" }}>
            {structure.map((c) => {
                const def = ALL_DEFS.find((w) => w.type === c.blk_type);
                const Icon = def?.icon ?? Boxes;
                return (
                    <div
                        key={c.key}
                        style={{ gridColumn: `${c.x + 1} / span ${c.w}`, gridRow: `${c.y + 1} / span ${c.h}` }}
                        className="border border-gray-100 rounded-lg bg-gray-50/40 p-2 overflow-auto flex flex-col gap-1.5"
                    >
                        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 shrink-0">
                            <Icon className="w-3 h-3" />
                            {def?.label ?? c.blk_type}
                        </div>
                        <CellTypeContent data={c} onChange={(patch) => onChangeCell(c.key, patch)} />
                    </div>
                );
            })}
        </div>
    );
}

// ─── การ์ด widget 1 ชิ้นใน canvas — เนื้อหาด้านในถูก render ให้เหมือนของจริงที่ลูกค้าเห็นเป๊ะ (ไม่ใช่ฟอร์ม
// กรอกข้อมูลเรียงเป็นแถวเหมือนเดิม) ตรงไหนเป็นรูปคลิกเพื่ออัปโหลดได้เลย ตรงไหนเป็นข้อความก็พิมพ์ทับตรงนั้นได้
// เลย ส่วนแถบด้านบน (ลาก/สถานะ/ลบ) เป็น "เครื่องมือแก้ไข" แยกจากภาพจริง ───────────────────────────────
function BlockCard({ block, onChange, onRemove }: { block: BlockForm; onChange: (patch: Partial<BlockForm>) => void; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.key });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    const def = ALL_DEFS.find((w) => w.type === block.blk_type);
    const Icon = def?.icon ?? Boxes;

    return (
        <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg bg-white p-3">
            <div className="flex items-center gap-2 mb-2">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
                    title="ลากเพื่อสลับตำแหน่ง"
                >
                    <GripVertical className="w-4 h-4" />
                </button>
                <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs font-medium text-gray-500">{def?.label ?? "widget สร้างเอง"}</span>
                <div className="ml-auto flex items-center gap-2">
                    <LandingToggle checked={block.showOnLanding} onChange={(showOnLanding) => onChange({ showOnLanding })} />
                    <StatusToggle status={block.status} onChange={(status) => onChange({ status })} />
                    <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {block.blk_type === "custom"
                ? (
                    <CustomWidgetEditor
                        structure={block.customStructure}
                        onChangeCell={(cellKey, patch) => onChange({
                            customStructure: block.customStructure.map((c) => (c.key === cellKey ? { ...c, ...patch } : c)),
                        })}
                    />
                )
                : <CellTypeContent data={block as CellData} onChange={onChange} />}
        </div>
    );
}

export default function NewsComposer({ initialBlocks }: { initialBlocks: ExistingBlock[] }) {
    const [blocks, setBlocks] = useState<BlockForm[]>(initialBlocks.map(blockFromExisting));
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSaving, setIsSaving] = useState(false);
    const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);

    useEffect(() => {
        fetch(`${api}/news/templates`, { headers: authHeader() })
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((d) => setTemplates(d.data ?? []))
            .catch(() => {});
    }, []);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    function updateBlock(key: string, patch: Partial<BlockForm>) {
        setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
        if (errors.blocks) setErrors((prev) => ({ ...prev, blocks: undefined }));
    }
    function updateItem(blockKey: string, itemKey: string, patch: Partial<ItemForm>) {
        setBlocks((prev) => prev.map((b) => (
            b.key === blockKey ? { ...b, items: b.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) } : b
        )));
    }
    // เขียนผลอัปโหลดรูปกลับเข้า customStructure ของ widget "สร้างเอง" โดยเฉพาะ (โครงสร้างซ้อนลึกกว่า block/
    // item ปกติ) — ถ้าไม่เขียนกลับ imageFile จะยังค้างอยู่ใน state แล้วกดบันทึกซ้ำจะส่ง blk_image_url เป็น
    // null อีกรอบ (เข้าใจผิดว่ายังไม่เคยอัปโหลด) ทำให้ทับของเดิมทิ้งเสียเปล่าไปเรื่อยๆ ทุกครั้งที่บันทึกซ้ำ
    function updateCustomCell(blockKey: string, cellKey: string, patch: Partial<CellData>) {
        setBlocks((prev) => prev.map((b) => (
            b.key === blockKey
                ? { ...b, customStructure: b.customStructure.map((c) => (c.key === cellKey ? { ...c, ...patch } : c)) }
                : b
        )));
    }
    function updateCustomItem(blockKey: string, cellKey: string, itemKey: string, patch: Partial<ItemForm>) {
        setBlocks((prev) => prev.map((b) => (
            b.key === blockKey
                ? {
                      ...b,
                      customStructure: b.customStructure.map((c) => (
                          c.key === cellKey ? { ...c, items: c.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) } : c
                      )),
                  }
                : b
        )));
    }
    function removeBlock(key: string) {
        setBlocks((prev) => prev.filter((b) => b.key !== key));
    }
    function insertBlock(block: BlockForm, atIndex?: number) {
        setBlocks((prev) => {
            const next = [...prev];
            if (atIndex === undefined || atIndex >= next.length) next.push(block);
            else next.splice(atIndex, 0, block);
            return next;
        });
        if (errors.blocks) setErrors((prev) => ({ ...prev, blocks: undefined }));
    }
    function addBlock(type: BlockType, atIndex?: number) {
        insertBlock(newBlock(type), atIndex);
    }
    async function addTemplateBlock(tpl_id: string, atIndex?: number) {
        const res = await fetch(`${api}/news/templates/${tpl_id}`, { headers: authHeader() });
        if (!res.ok) { toast.error("โหลด widget นี้ไม่สำเร็จ"); return; }
        const tpl: TemplateDetail = await res.json();
        insertBlock(customBlockFromTemplate(tpl), atIndex);
    }

    function handleDragStart(e: DragStartEvent) {
        const data = e.active.data.current as { paletteType?: BlockType; templateId?: string } | undefined;
        if (data?.paletteType) setActiveDragLabel(ALL_DEFS.find((w) => w.type === data.paletteType)?.label ?? null);
        else if (data?.templateId) setActiveDragLabel(templates.find((t) => t.tpl_id === data.templateId)?.tpl_name ?? "widget สร้างเอง");
    }

    function handleDragEnd(e: DragEndEvent) {
        setActiveDragLabel(null);
        const { active, over } = e;
        if (!over) return;

        const activeData = active.data.current as { paletteType?: BlockType; templateId?: string } | undefined;
        if (activeData?.paletteType || activeData?.templateId) {
            // ลากจากชั้นวางมาวางใน canvas — แทรกก่อนตำแหน่งของ block ที่ลากไปวางทับ (ท้ายสุดถ้าวางบน
            // dropzone ตอนว่าง หรือวางไม่ทับ block ไหนเลย)
            const overIndex = blocks.findIndex((b) => b.key === over.id);
            const insertAt = overIndex === -1 ? undefined : overIndex;
            if (activeData.paletteType) addBlock(activeData.paletteType, insertAt);
            else if (activeData.templateId) void addTemplateBlock(activeData.templateId, insertAt);
            return;
        }

        if (active.id !== over.id) {
            setBlocks((prev) => {
                const oldIndex = prev.findIndex((b) => b.key === active.id);
                const newIndex = prev.findIndex((b) => b.key === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const fieldErrors = validate(blocks);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        setIsSaving(true);
        try {
            const payload = {
                blocks: blocks.map((b) => (
                    b.blk_type === "custom"
                        ? {
                              blk_type: "custom", blk_status: b.status, blk_show_on_landing: b.showOnLanding,
                              blk_custom_structure: b.customStructure.map((c) => ({ ...cellDataToPayload(c), x: c.x, y: c.y, w: c.w, h: c.h })),
                          }
                        : { ...cellDataToPayload(b as CellData), blk_status: b.status, blk_show_on_landing: b.showOnLanding }
                )),
            };

            const res = await fetch(`${api}/news`, {
                method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                setIsSaving(false);
                return;
            }

            const blockIds: string[] = data.block_ids ?? [];
            const itemIdsByBlock: string[][] = data.item_ids ?? [];

            // อัปโหลดรูปแยกทีหลัง (endpoint หลักรับ JSON ส่วนรูปต้องเป็น multipart) — อยู่หน้าเดียวกันตลอด
            // (ไม่ redirect หนีไปไหน) จึงต้องเขียนผลอัปโหลดกลับเข้า state ทันทีด้วย (ผูกด้วย key ฝั่ง client
            // ที่คงที่) กัน blk_image_url/item_image_url เดิมหายไปถ้ากดบันทึกซ้ำโดยยังไม่รีเฟรชหน้า — custom
            // block อัปโหลดผ่านคนละ endpoint (custom-cells) เพราะรูปอยู่ใน JSON ไม่ใช่คอลัมน์ตรงๆ
            const uploadFailures: string[] = [];
            const tasks: Promise<unknown>[] = [];
            blocks.forEach((b, i) => {
                const blockId = blockIds[i];
                if (!blockId) return;

                if (b.blk_type === "custom") {
                    b.customStructure.forEach((cell, ci) => {
                        if (cell.imageFile) {
                            const fd = new FormData();
                            fd.append("image", cell.imageFile);
                            tasks.push(
                                fetch(`${api}/news/blocks/${blockId}/custom-cells/${cell.key}/image`, { method: "PUT", headers: authHeader(), body: fd })
                                    .then(async (r) => {
                                        if (!r.ok) throw new Error();
                                        const json = await r.json();
                                        updateCustomCell(b.key, cell.key, { imageFile: null, existingImageUrl: json.image_url });
                                    })
                                    .catch(() => uploadFailures.push(`รูปภาพช่องที่ ${ci + 1} ใน widget ที่ ${i + 1}`))
                            );
                        }
                        cell.items.forEach((item, ii) => {
                            if (!item.imageFile) return;
                            const fd = new FormData();
                            fd.append("image", item.imageFile);
                            tasks.push(
                                fetch(`${api}/news/blocks/${blockId}/custom-cells/${cell.key}/items/${item.key}/image`, { method: "PUT", headers: authHeader(), body: fd })
                                    .then(async (r) => {
                                        if (!r.ok) throw new Error();
                                        const json = await r.json();
                                        updateCustomItem(b.key, cell.key, item.key, { imageFile: null, existingImageUrl: json.image_url });
                                    })
                                    .catch(() => uploadFailures.push(`รูปภาพรายการที่ ${ii + 1} ในช่องที่ ${ci + 1} ของ widget ที่ ${i + 1}`))
                            );
                        });
                    });
                    return;
                }

                if (b.imageFile) {
                    const fd = new FormData();
                    fd.append("image", b.imageFile);
                    tasks.push(
                        fetch(`${api}/news/blocks/${blockId}/image`, { method: "PUT", headers: authHeader(), body: fd })
                            .then(async (r) => {
                                if (!r.ok) throw new Error();
                                const json = await r.json();
                                updateBlock(b.key, { imageFile: null, existingImageUrl: json.blk_image_url });
                            })
                            .catch(() => uploadFailures.push(`รูปภาพ widget ที่ ${i + 1}`))
                    );
                }
                if (REPEATING_TYPES.includes(b.blk_type)) {
                    b.items.forEach((item, j) => {
                        const itemId = itemIdsByBlock[i]?.[j];
                        if (!item.imageFile || !itemId) return;
                        const fd = new FormData();
                        fd.append("image", item.imageFile);
                        tasks.push(
                            fetch(`${api}/news/blocks/${blockId}/items/${itemId}/image`, { method: "PUT", headers: authHeader(), body: fd })
                                .then(async (r) => {
                                    if (!r.ok) throw new Error();
                                    const json = await r.json();
                                    updateItem(b.key, item.key, { imageFile: null, existingImageUrl: json.item_image_url });
                                })
                                .catch(() => uploadFailures.push(`รูปภาพรายการที่ ${j + 1} ใน widget ที่ ${i + 1}`))
                        );
                    });
                }
            });
            await Promise.all(tasks);

            if (uploadFailures.length > 0) {
                toast.error(`บันทึกข่าวสารสำเร็จ แต่แนบรูปไม่สำเร็จ: ${uploadFailures.join(", ")}`);
            } else {
                toast.success("บันทึกข่าวสารสำเร็จ");
            }
        } catch {
            toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                <aside className="flex flex-col gap-4 lg:sticky lg:top-6 h-fit">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-gray-500">widget สำเร็จรูป</p>
                        {PREMADE_DEFS.map((w) => (
                            <PaletteItem key={w.type} type={w.type} label={w.label} Icon={w.icon} onAdd={() => addBlock(w.type)} />
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-gray-500">องค์ประกอบพื้นฐาน</p>
                        {BASIC_DEFS.map((w) => (
                            <PaletteItem key={w.type} type={w.type} label={w.label} Icon={w.icon} onAdd={() => addBlock(w.type)} />
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-gray-500">widget ที่สร้างเอง</p>
                        {templates.map((t) => (
                            <TemplatePaletteItem key={t.tpl_id} tpl={t} onAdd={() => void addTemplateBlock(t.tpl_id)} />
                        ))}
                        <Link
                            href="/news/templates/create"
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            สร้าง widget ใหม่
                        </Link>
                    </div>
                </aside>

                <div className="flex flex-col gap-4">
                    {errors.blocks && (
                        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-2.5">{errors.blocks}</div>
                    )}

                    {blocks.length === 0 ? (
                        <EmptyCanvasDropzone />
                    ) : (
                        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col gap-3">
                                {blocks.map((b) => (
                                    <BlockCard key={b.key} block={b} onChange={(patch) => updateBlock(b.key, patch)} onRemove={() => removeBlock(b.key)} />
                                ))}
                            </div>
                        </SortableContext>
                    )}

                    <div className="flex justify-end sticky bottom-4">
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                        </Button>
                    </div>
                </div>
            </form>

            <DragOverlay>
                {activeDragLabel ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-sm text-blue-700 shadow-lg">
                        {activeDragLabel}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
