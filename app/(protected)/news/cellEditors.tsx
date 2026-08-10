"use client";

// ─── ชิ้นส่วนแก้ไข widget แต่ละประเภทที่ใช้ร่วมกันทั้ง 2 ที่: (1) แต่ละ widget ในฟีดหลัก (NewsComposer.tsx,
// เรียงเป็นแถวลาก-วางสลับลำดับได้) และ (2) แต่ละช่องในกริดของ widget "สร้างเอง" (TemplateDesigner.tsx, ลาก
// ย่อ/ขยายตำแหน่งอิสระบนกริด 12 คอลัมน์) — เนื้อหา/การแก้ไขข้างในเหมือนกันเป๊ะ ต่างแค่ metadata ห่อข้างนอก
// (ฟีดหลักมี status ต่อ widget, กริดมีตำแหน่ง x/y/w/h ต่อช่อง แทน) จึงแยก "เนื้อหา" (CellData) ออกจาก
// "ห่อข้างนอก" ให้ผู้เรียกแต่ละที่ประกอบเพิ่มเอง ไม่ต้องเขียนฟอร์มต่อ type ซ้ำสองที่
import { useState } from "react";
import {
    Trash2, Heading as HeadingIcon, AlignLeft, Image as ImageIcon, Link as LinkIcon, Plus,
    Newspaper, CreditCard, LayoutGrid, GalleryHorizontal, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    SlidersHorizontal, SquarePlay,
} from "lucide-react";
import { api } from "@/app/constans";
import DragDropImage from "@/components/ui/DragDropImage";

export const SERVER_BASE = new URL(api).origin;

export type BlockType = "text" | "image" | "heading" | "button" | "post" | "card" | "card_set" | "carousel" | "youtube";
export const REPEATING_TYPES: BlockType[] = ["card_set", "carousel"];

// แตก YouTube URL ทุกรูปแบบที่คนก็อปมาปกติ (watch?v=, youtu.be/, embed/, shorts/ รวมถึงมี query string ต่อท้าย
// เช่น &t=30s) ให้เหลือแค่ video ID ไว้สร้าง iframe embed src — คืน null ถ้า parse ไม่ได้ (ยังไม่กรอก/พิมพ์ผิด)
export function extractYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    return match ? match[1] : null;
}

// ข้อความแบบ "แก้ตรงจุดที่จะแสดงจริง" — ไม่มีกรอบตอนปกติ ให้ความรู้สึกเหมือนข้อความจริงบนหน้าลูกค้า
// โชว์กรอบจางๆ ตอน hover/focus แค่พอให้รู้ว่ากดแก้ไขตรงนี้ได้ (ไม่ใช่ฟอร์มกล่องแยกต่างหากเหมือนเดิม)
export const inlineFieldClass =
    "w-full bg-transparent border border-transparent rounded px-1.5 py-0.5 -mx-1.5 outline-none transition-colors resize-none " +
    "hover:border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400";
// เวอร์ชันใช้บนพื้นหลังมืด (แถบ caption ทับรูป Carousel) ตัวอักษร/placeholder ต้องอ่านออกบนพื้นมืด
export const inlineFieldOnDarkClass =
    "w-full bg-transparent border border-transparent rounded px-1.5 py-0.5 -mx-1.5 outline-none transition-colors resize-none " +
    "hover:border-white/30 focus:border-white/60 focus:ring-2 focus:ring-white/20 text-white placeholder:text-white/60";

// key = id ฝั่ง client เท่านั้น ใช้เป็น React key + ที่อยู่อ้างอิงตอนอัปโหลดรูป (คนละอันกับ item_id จริงจาก
// server — server สร้าง id ใหม่ให้ทุกครั้งที่บันทึก เพราะ save() ลบของเดิมทั้งหมดแล้วสร้างใหม่เสมอ)
export type ItemForm = {
    key: string;
    title: string;
    text: string;
    linkUrl: string;
    linkLabel: string;
    existingImageUrl: string | null;
    imageFile: File | null;
};

// เนื้อหาของ widget/ช่องเดียว — ใช้ร่วมกันทั้ง "widget ในฟีด" (บวก status เพิ่ม) และ "ช่องในกริดของ widget
// สร้างเอง" (บวก x/y/w/h เพิ่ม) ผู้เรียกแต่ละที่ intersect type เพิ่มเอาเอง
export type CellData = {
    key: string;
    blk_type: BlockType;
    title: string;      // post, card
    text: string;        // text/heading: เนื้อหา, button: ข้อความบนปุ่ม, post/card: เนื้อหา/คำอธิบาย
    linkUrl: string;     // button, card
    linkLabel: string;   // card เท่านั้น
    existingImageUrl: string | null; // image, post, card
    imageFile: File | null;
    itemsPerView: number; // card_set เท่านั้น — จำนวนการ์ดที่เห็นพร้อมกันในแถวเลื่อน
    items: ItemForm[];   // card_set, carousel เท่านั้น
};

// รูปทรงข้อมูลที่ backend คืนมา (ทั้ง block ในฟีด และ cell ในโครงสร้าง JSON ของ widget สร้างเอง/template
// ใช้ชื่อคอลัมน์เดียวกันทุกที่ — ดู pickCellFields/pickBlockFields ฝั่ง backend)
export type ExistingCellContent = {
    blk_type: BlockType;
    blk_title: string | null;
    blk_text: string | null;
    blk_image_url: string | null;
    blk_link_url: string | null;
    blk_link_label: string | null;
    blk_items_per_view: number;
    items: {
        item_title: string | null;
        item_text: string | null;
        item_image_url: string | null;
        item_link_url: string | null;
        item_link_label: string | null;
    }[];
};

// ช่อง 1 ช่องในกริดของ widget "สร้างเอง" — เนื้อหาเหมือน CellData ทุกอย่าง บวกตำแหน่ง/ขนาดบนกริด 12 คอลัมน์
// ใช้ทั้งใน BlockCard ของฟีดหลัก (แสดง preview อย่างเดียว) และ TemplateDesigner (ลากย่อ/ขยายจริง)
export type GridCellForm = CellData & { x: number; y: number; w: number; h: number };
export type ExistingGridCell = ExistingCellContent & { key: string; x: number; y: number; w: number; h: number };

export function gridCellFromExisting(c: ExistingGridCell): GridCellForm {
    return { ...cellDataFromExisting(c), x: c.x, y: c.y, w: c.w, h: c.h };
}

// widget สำเร็จรูป — จัดหน้าไว้ให้แล้ว แอดมินแค่ลากมาวางแล้วกรอกข้อมูล/แนบรูปตามช่องที่กำหนดไว้
export const PREMADE_DEFS: { type: BlockType; label: string; icon: typeof Newspaper }[] = [
    { type: "post", label: "โพสทั่วไป", icon: Newspaper },
    { type: "card", label: "Card", icon: CreditCard },
    { type: "card_set", label: "ชุด Card", icon: LayoutGrid },
    { type: "carousel", label: "Carousel", icon: GalleryHorizontal },
];
// องค์ประกอบพื้นฐาน — ประกอบเองอิสระทีละชิ้น (ของเดิมก่อนมี widget สำเร็จรูป เก็บไว้เป็นตัวเลือกเสริม)
export const BASIC_DEFS: { type: BlockType; label: string; icon: typeof HeadingIcon }[] = [
    { type: "heading", label: "หัวข้อย่อย", icon: HeadingIcon },
    { type: "text", label: "ข้อความ", icon: AlignLeft },
    { type: "image", label: "รูปภาพ", icon: ImageIcon },
    { type: "button", label: "ปุ่มลิงก์", icon: LinkIcon },
    { type: "youtube", label: "วิดีโอ YouTube", icon: SquarePlay },
];
export const ALL_DEFS = [...PREMADE_DEFS, ...BASIC_DEFS];

export function newItem(): ItemForm {
    return { key: crypto.randomUUID(), title: "", text: "", linkUrl: "", linkLabel: "", existingImageUrl: null, imageFile: null };
}

export function newCellData(type: BlockType): CellData {
    return {
        key: crypto.randomUUID(), blk_type: type,
        title: "", text: "", linkUrl: "", linkLabel: "",
        existingImageUrl: null, imageFile: null, itemsPerView: 4,
        items: REPEATING_TYPES.includes(type) ? [newItem()] : [],
    };
}

export function cellDataFromExisting(b: ExistingCellContent): CellData {
    return {
        key: crypto.randomUUID(), blk_type: b.blk_type,
        title: b.blk_title ?? "", text: b.blk_text ?? "",
        linkUrl: b.blk_link_url ?? "", linkLabel: b.blk_link_label ?? "",
        existingImageUrl: b.blk_image_url, imageFile: null,
        itemsPerView: b.blk_items_per_view || 4,
        items: (b.items ?? []).map((it) => ({
            key: crypto.randomUUID(),
            title: it.item_title ?? "", text: it.item_text ?? "",
            linkUrl: it.item_link_url ?? "", linkLabel: it.item_link_label ?? "",
            existingImageUrl: it.item_image_url, imageFile: null,
        })),
    };
}

// แปลงกลับเป็นรูปแบบที่ backend รับ (blk_* + items[].item_*) — คง key ของทั้ง cell และ item ไว้เสมอแม้
// widget ระดับบนสุดในฟีดจะไม่ใช้ (อ้างอิงด้วย server id ที่คืนมาแทน) เพราะช่องในกริดของ widget สร้างเองต้อง
// ใช้ key นี้เป็นที่อยู่อ้างอิงตอนอัปโหลดรูป (ไม่มี server id แยกให้ต่อช่อง เนื้อหาทั้งหมดอยู่ใน JSON ก้อนเดียว)
export function cellDataToPayload(c: CellData) {
    return {
        key: c.key,
        blk_type: c.blk_type,
        blk_title: c.title || null,
        blk_text: c.text || null,
        blk_link_url: c.linkUrl || null,
        blk_link_label: c.linkLabel || null,
        blk_items_per_view: c.itemsPerView,
        blk_image_url: c.imageFile ? null : c.existingImageUrl,
        items: REPEATING_TYPES.includes(c.blk_type)
            ? c.items.map((it) => ({
                  key: it.key,
                  item_title: it.title || null,
                  item_text: it.text || null,
                  item_link_url: it.linkUrl || null,
                  item_link_label: it.linkLabel || null,
                  item_image_url: it.imageFile ? null : it.existingImageUrl,
              }))
            : [],
    };
}

export function swapItems(items: ItemForm[], i: number, j: number): ItemForm[] {
    if (j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}

export function imageUrlFor(existingUrl: string | null, file: File | null): string | undefined {
    return file ? undefined : (existingUrl ? `${SERVER_BASE}${existingUrl}` : undefined);
}

// ไอคอนลิงก์เล็กๆ กดเพื่อเปิดช่องกรอก URL ปลายทาง — URL ไม่มีที่ให้แสดงในภาพจริง (ลูกค้าเห็นแค่ข้อความปุ่ม)
// จึงซ่อนไว้หลังไอคอนแทนที่จะโชว์เป็นฟอร์มถาวร ไม่ให้รกหน้า preview
export function LinkUrlEditor({ url, onChange, dark }: { url: string; onChange: (url: string) => void; dark?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative inline-flex items-center">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="แก้ไขลิงก์ปลายทาง"
                className={`p-1 rounded transition-colors ${
                    dark
                        ? `${url ? "text-white" : "text-white/40"} hover:bg-white/10`
                        : `${url ? "text-blue-500" : "text-gray-300"} hover:bg-blue-50 hover:text-blue-600`
                }`}
            >
                <LinkIcon className="w-3.5 h-3.5" />
            </button>
            {open && (
                <input
                    autoFocus
                    value={url}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setOpen(false)}
                    placeholder="ลิงก์ปลายทาง https://..."
                    className="absolute left-full ml-1 z-20 w-56 text-xs px-2 py-1.5 border border-gray-200 rounded-lg shadow-sm bg-white text-gray-700 outline-none focus:border-blue-300"
                />
            )}
        </div>
    );
}

// แถบปุ่มเลื่อนลำดับ/ลบ ลอยมุมขวาบน โชว์ตอน hover เท่านั้น (ไม่ใช่แถวฟอร์มถาวรเหมือนเดิม) ใช้กับรายการย่อย
// ทั้งใน "ชุด Card" และ "Carousel" ไม่ให้บังพื้นที่ preview ตอนไม่ได้แก้ไข
export function ItemControls({ index, total, onRemove, onMoveUp, onMoveDown, dark }: {
    index: number; total: number; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; dark?: boolean;
}) {
    return (
        <div
            className={`absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm px-0.5 ${
                dark ? "bg-black/50" : "bg-white/90"
            }`}
        >
            <button
                type="button" disabled={index === 0} onClick={onMoveUp}
                className={`p-1 disabled:opacity-30 ${dark ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
            >
                <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
                type="button" disabled={index === total - 1} onClick={onMoveDown}
                className={`p-1 disabled:opacity-30 ${dark ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
            >
                <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onRemove} className={`p-1 ${dark ? "text-white/80 hover:text-red-300" : "text-gray-400 hover:text-red-500"}`}>
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// การ์ด 1 ใบในกริดของ "ชุด Card" — หน้าตาเหมือนการ์ดจริงที่ลูกค้าเห็นเป๊ะ (รูปบน + หัวข้อตัวหนา + คำอธิบาย
// + ลิงก์ "ดูเพิ่มเติม →") ต่างจากฟอร์มเดิมที่เป็นแค่ช่องกรอกเรียงกันไม่มีหน้าตา
export function CardGridItemEditor({ item, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
    item: ItemForm; index: number; total: number;
    onChange: (patch: Partial<ItemForm>) => void; onRemove: () => void;
    onMoveUp: () => void; onMoveDown: () => void;
}) {
    return (
        <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-white flex flex-col">
            <ItemControls index={index} total={total} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
            {/* file={item.imageFile} จำเป็น เพราะการ์ดนี้ถูก paginate (CardSetEditor โชว์ทีละหน้า) เปลี่ยนหน้า
                แล้วกลับมา = unmount/remount การ์ดนี้ใหม่ทั้งอัน ถ้าไม่ส่ง file ให้ DragDropImage สร้าง object
                URL ใหม่จากไฟล์เองได้ตรงๆ รูปที่เพิ่งเลือกไว้ (ยังไม่อัปโหลด) จะหายไปเงียบๆ เหมือนบั๊กที่เจอใน
                Carousel */}
            <DragDropImage compact value={imageUrlFor(item.existingImageUrl, item.imageFile)} file={item.imageFile} onChange={(file) => onChange({ imageFile: file, existingImageUrl: null })} />
            <div className="p-3 flex flex-col gap-1">
                <input value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="หัวข้อ" className={`${inlineFieldClass} text-sm font-semibold text-gray-900`} />
                <textarea value={item.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="ข้อความ (ไม่บังคับ)" className={`${inlineFieldClass} text-xs text-gray-600 leading-relaxed`} />
                <div className="flex items-center gap-0.5 mt-0.5">
                    <input value={item.linkLabel} onChange={(e) => onChange({ linkLabel: e.target.value })} placeholder="ดูเพิ่มเติม" className={`${inlineFieldClass} text-xs font-medium text-blue-600 w-auto flex-1`} />
                    <LinkUrlEditor url={item.linkUrl} onChange={(url) => onChange({ linkUrl: url })} />
                </div>
            </div>
        </div>
    );
}

// กระเบื้องเพิ่มการ์ดใหม่ในกริด — ทำหน้าตาเป็นช่องกริดเหมือนกันเพื่อให้ตำแหน่งดูเป็นธรรมชาติ (คล้ายปุ่ม
// "เพิ่มรูป" ในแอปแกลเลอรีทั่วไป)
export function AddGridTile({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors min-h-45"
        >
            <Plus className="w-5 h-5" />
            <span className="text-xs">{label}</span>
        </button>
    );
}

// ไอคอนตั้งค่าจำนวน Card ที่โชว์พร้อมกันในแถวเลื่อนของ "ชุด Card" (ตัวอย่างที่ตกลงกัน: แถวละ 4 ชิ้น
// ปรับได้ยืดหยุ่นต่อ widget) — ใช้ pattern เดียวกับ LinkUrlEditor (ไอคอนกดเปิดช่องกรอกเล็กๆ)
export function ItemsPerViewEditor({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative inline-flex items-center">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="ตั้งจำนวน Card ที่แสดงพร้อมกัน"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                แสดง {value} ชิ้น/แถว
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-52 p-2.5 border border-gray-200 rounded-lg shadow-sm bg-white flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500">จำนวน Card ที่เห็นพร้อมกัน (1-8)</label>
                    <input
                        type="number"
                        min={1}
                        max={8}
                        value={value}
                        onChange={(e) => onChange(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                        className="px-2 py-1 border border-gray-200 rounded text-sm outline-none focus:border-blue-300"
                    />
                    <p className="text-[11px] text-gray-400">มีมากกว่านี้จะมีลูกศรเลื่อนดูหน้าถัดไป</p>
                </div>
            )}
        </div>
    );
}

// "ชุด Card" แสดงเป็นแถวเลื่อนแนวนอนเหมือนที่ลูกค้าเห็นจริง เห็นทีละ itemsPerView ชิ้น มีลูกศรเลื่อนหน้าถ้ามี
// มากกว่านั้น ปุ่ม "+ เพิ่ม Card" ฝังอยู่ในหน้าสุดท้ายเสมอ (ไม่ใช่แยกอยู่ท้ายลิสต์เหมือนตอนเป็น grid)
export function CardSetEditor({ items, itemsPerView, onChangeItems }: {
    items: ItemForm[]; itemsPerView: number; onChangeItems: (items: ItemForm[]) => void;
}) {
    const perView = Math.max(1, Math.min(8, itemsPerView || 4));
    const [page, setPage] = useState(0);

    function updateAt(idx: number, patch: Partial<ItemForm>) {
        onChangeItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    }
    function removeAt(idx: number) {
        onChangeItems(items.filter((_, i) => i !== idx));
    }
    function moveItem(idx: number, dir: -1 | 1) {
        const target = idx + dir;
        if (target < 0 || target >= items.length) return;
        onChangeItems(swapItems(items, idx, target));
    }

    // หน้าสุดท้ายเต็มพอดี (หรือยังไม่มี Card เลย) ต้องเผื่อหน้าเพิ่มอีก 1 หน้าไว้ให้ปุ่ม "+ เพิ่ม Card" เสมอ
    const lastPageFull = items.length === 0 || items.length % perView === 0;
    const totalPages = Math.ceil(items.length / perView) + (lastPageFull ? 1 : 0);
    const clampedPage = Math.min(page, totalPages - 1);
    const startIdx = clampedPage * perView;
    const visibleItems = items.slice(startIdx, startIdx + perView);
    const showAddTile = startIdx + visibleItems.length === items.length;

    return (
        <div className="flex flex-col gap-2">
            <div className="relative">
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))` }}>
                    {visibleItems.map((item, i) => {
                        const idx = startIdx + i;
                        return (
                            <CardGridItemEditor
                                key={item.key}
                                item={item}
                                index={idx}
                                total={items.length}
                                onChange={(patch) => updateAt(idx, patch)}
                                onRemove={() => removeAt(idx)}
                                onMoveUp={() => moveItem(idx, -1)}
                                onMoveDown={() => moveItem(idx, 1)}
                            />
                        );
                    })}
                    {showAddTile && <AddGridTile label="เพิ่ม Card" onClick={() => onChangeItems([...items, newItem()])} />}
                </div>

                {totalPages > 1 && (
                    <>
                        <button
                            type="button"
                            disabled={clampedPage === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 p-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            disabled={clampedPage === totalPages - 1}
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 p-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setPage(i)}
                            aria-label={`หน้า ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${i === clampedPage ? "w-4 bg-blue-500" : "w-1.5 bg-gray-300 hover:bg-gray-400"}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// แก้ไข Carousel แบบเลื่อนทีละสไลด์จริง (เหมือนที่ลูกค้าเห็น) ลูกศรขวาเมื่ออยู่สไลด์สุดท้ายจะกลายเป็นปุ่ม
// "+" ให้กดเพิ่มสไลด์ใหม่ต่อได้เลย ไม่ต้องเลื่อนไปกดปุ่มเพิ่มแยกที่อื่น
export function CarouselEditor({ items, onChangeItems }: { items: ItemForm[]; onChangeItems: (items: ItemForm[]) => void }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const index = Math.min(activeIndex, Math.max(0, items.length - 1));

    if (items.length === 0) {
        return <AddGridTile label="เพิ่มสไลด์แรก" onClick={() => { onChangeItems([newItem()]); setActiveIndex(0); }} />;
    }

    const item = items[index];
    const isLast = index === items.length - 1;

    function updateCurrent(patch: Partial<ItemForm>) {
        onChangeItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    }
    function removeCurrent() {
        const next = items.filter((_, i) => i !== index);
        onChangeItems(next);
        setActiveIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
    }
    function moveCurrent(dir: -1 | 1) {
        const target = index + dir;
        if (target < 0 || target >= items.length) return;
        onChangeItems(swapItems(items, index, target));
        setActiveIndex(target);
    }
    function goPrev() {
        if (index > 0) setActiveIndex(index - 1);
    }
    function goNext() {
        if (!isLast) { setActiveIndex(index + 1); return; }
        onChangeItems([...items, newItem()]);
        setActiveIndex(items.length);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>สไลด์ {index + 1}/{items.length}</span>
                <div className="ml-auto flex items-center gap-0.5">
                    <button type="button" disabled={index === 0} onClick={() => moveCurrent(-1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="เลื่อนลำดับขึ้น">
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={isLast} onClick={() => moveCurrent(1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="เลื่อนลำดับลง">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={removeCurrent} className="p-1 text-gray-400 hover:text-red-500" title="ลบสไลด์นี้">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <DragDropImage
                    // key={item.key} บังคับ remount ทุกครั้งที่สลับสไลด์ — ถ้าไม่มี key นี้ React จะใช้
                    // DragDropImage instance เดิมซ้ำ (ตำแหน่งใน tree เดิม) ทำให้ preview ค้างเป็นรูปของสไลด์
                    // ก่อนหน้า แล้วพอ preview นั้นไม่ใช่ null overlay (caption+ลูกศร) จะถูกวาดทับเต็มพื้นที่แล้ว
                    // stopPropagation click ทุกจุด กลายเป็นคลิกเพื่อเลือกรูปใหม่ไม่ได้เลยตั้งแต่สไลด์ที่ 2 เป็นต้นไป
                    // — ต้องส่ง file={item.imageFile} คู่กันเสมอ ไม่งั้นสไลด์ที่เพิ่งเลือกรูปไว้ (ยังไม่อัปโหลด)
                    // จะรูปหายทันทีที่สลับสไลด์ไปแล้วย้อนกลับมา (remount ใหม่ preview จะว่างเพราะ value เป็น
                    // undefined เสมอตอนมี imageFile ค้างอยู่ — ดู imageUrlFor) ต้องให้ DragDropImage สร้าง
                    // object URL ใหม่จากตัวไฟล์เองได้ตรงๆ แทนที่จะพึ่ง preview เดิมที่ถูก revoke ไปแล้วตอน unmount
                    key={item.key}
                    value={imageUrlFor(item.existingImageUrl, item.imageFile)}
                    file={item.imageFile}
                    onChange={(file) => updateCurrent({ imageFile: file, existingImageUrl: null })}
                    overlay={
                        <>
                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-3 pt-6 pb-2.5 flex flex-col gap-0.5">
                                <input value={item.title} onChange={(e) => updateCurrent({ title: e.target.value })} placeholder="หัวข้อสไลด์" className={`${inlineFieldOnDarkClass} font-semibold`} />
                                <textarea value={item.text} onChange={(e) => updateCurrent({ text: e.target.value })} rows={1} placeholder="ข้อความ (ไม่บังคับ)" className={`${inlineFieldOnDarkClass} text-xs`} />
                                <div className="flex items-center gap-0.5">
                                    <input value={item.linkLabel} onChange={(e) => updateCurrent({ linkLabel: e.target.value })} placeholder="ดูเพิ่มเติม" className={`${inlineFieldOnDarkClass} text-xs font-medium w-auto flex-1`} />
                                    <LinkUrlEditor url={item.linkUrl} onChange={(url) => updateCurrent({ linkUrl: url })} dark />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={goPrev}
                                disabled={index === 0}
                                aria-label="สไลด์ก่อนหน้า"
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-sm disabled:opacity-30 disabled:pointer-events-none"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={goNext}
                                aria-label={isLast ? "เพิ่มสไลด์ใหม่" : "สไลด์ถัดไป"}
                                title={isLast ? "เพิ่มสไลด์ใหม่" : "สไลด์ถัดไป"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-sm"
                            >
                                {isLast ? <Plus className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </>
                    }
                />
            </div>

            {items.length > 1 && (
                <div className="flex justify-center gap-1.5">
                    {items.map((it, i) => (
                        <button
                            key={it.key}
                            type="button"
                            onClick={() => setActiveIndex(i)}
                            aria-label={`สไลด์ที่ ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-blue-500" : "w-1.5 bg-gray-300 hover:bg-gray-400"}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// เนื้อหาจริงของ 1 widget/ช่อง ตาม type — render ให้เหมือนของจริงที่ลูกค้าเห็นเป๊ะ (ไม่ใช่ฟอร์มกรอกข้อมูล
// เรียงเป็นแถว) ตรงไหนเป็นรูปคลิกเพื่ออัปโหลดได้เลย ตรงไหนเป็นข้อความก็พิมพ์ทับตรงนั้นได้เลย — ผู้เรียก
// (BlockCard ในฟีดหลัก / GridCellWrapper ในกริดของ widget สร้างเอง) ห่อ header/drag-handle ของตัวเองเพิ่ม
export function CellTypeContent({ data, onChange }: { data: CellData; onChange: (patch: Partial<CellData>) => void }) {
    switch (data.blk_type) {
        case "heading":
            return <input value={data.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="ข้อความหัวข้อย่อย" className={`${inlineFieldClass} text-lg font-semibold text-gray-900`} />;
        case "text":
            return <textarea value={data.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} placeholder="เนื้อหาข้อความ" className={`${inlineFieldClass} text-gray-600 leading-relaxed`} />;
        case "image":
            return <DragDropImage value={imageUrlFor(data.existingImageUrl, data.imageFile)} onChange={(file) => onChange({ imageFile: file, existingImageUrl: null })} />;
        case "youtube": {
            // ใช้ linkUrl field เดิม (เหมือน button) เก็บลิงก์วิดีโอดิบไว้ตรงๆ — แตกเป็น video ID แค่ตอน preview/
            // แสดงผลเท่านั้น ไม่ต้องแปลงก่อนเก็บ เผื่อแอดมินแก้ลิงก์ทีหลังจะได้ไม่เสียของเดิมที่พิมพ์ไว้
            const videoId = extractYoutubeId(data.linkUrl);
            return (
                <div className="flex flex-col gap-2">
                    <input
                        value={data.linkUrl}
                        onChange={(e) => onChange({ linkUrl: e.target.value })}
                        placeholder="วางลิงก์วิดีโอ YouTube เช่น https://www.youtube.com/watch?v=..."
                        className={`${inlineFieldClass} text-sm text-gray-700`}
                    />
                    <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 border border-gray-200" style={{ aspectRatio: "16 / 9" }}>
                        {videoId ? (
                            <iframe
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title="ตัวอย่างวิดีโอ YouTube"
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                                <SquarePlay className="w-8 h-8" />
                                <p className="text-xs">วางลิงก์ YouTube ด้านบนเพื่อดูตัวอย่าง</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        case "button":
            return (
                <div className="flex items-center gap-2">
                    <input
                        value={data.text}
                        onChange={(e) => onChange({ text: e.target.value })}
                        placeholder="ข้อความบนปุ่ม"
                        className="rounded-full bg-blue-600 text-white font-medium px-6 py-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-blue-100 w-full sm:w-64"
                    />
                    <LinkUrlEditor url={data.linkUrl} onChange={(url) => onChange({ linkUrl: url })} />
                </div>
            );
        case "post":
            return (
                <div className="flex flex-col gap-2">
                    <DragDropImage value={imageUrlFor(data.existingImageUrl, data.imageFile)} onChange={(file) => onChange({ imageFile: file, existingImageUrl: null })} />
                    <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="หัวข้อ (ไม่บังคับ)" className={`${inlineFieldClass} text-lg font-semibold text-gray-900`} />
                    <textarea value={data.text} onChange={(e) => onChange({ text: e.target.value })} rows={4} placeholder="เนื้อหาโพสต์" className={`${inlineFieldClass} text-gray-600 leading-relaxed`} />
                </div>
            );
        case "card":
            return (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <DragDropImage value={imageUrlFor(data.existingImageUrl, data.imageFile)} onChange={(file) => onChange({ imageFile: file, existingImageUrl: null })} />
                    <div className="p-4 flex flex-col gap-1.5">
                        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="หัวข้อการ์ด" className={`${inlineFieldClass} font-semibold text-gray-900`} />
                        <textarea value={data.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="คำอธิบาย (ไม่บังคับ)" className={`${inlineFieldClass} text-sm text-gray-600 leading-relaxed`} />
                        <div className="flex items-center gap-0.5 mt-0.5">
                            <input value={data.linkLabel} onChange={(e) => onChange({ linkLabel: e.target.value })} placeholder="ดูเพิ่มเติม" className={`${inlineFieldClass} text-sm font-medium text-blue-600 w-auto flex-1`} />
                            <LinkUrlEditor url={data.linkUrl} onChange={(url) => onChange({ linkUrl: url })} />
                        </div>
                    </div>
                </div>
            );
        case "card_set":
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-end -mt-1">
                        <ItemsPerViewEditor value={data.itemsPerView} onChange={(v) => onChange({ itemsPerView: v })} />
                    </div>
                    <CardSetEditor items={data.items} itemsPerView={data.itemsPerView} onChangeItems={(items) => onChange({ items })} />
                </div>
            );
        case "carousel":
            return <CarouselEditor items={data.items} onChangeItems={(items) => onChange({ items })} />;
        default:
            return null;
    }
}
