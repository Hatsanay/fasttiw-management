"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Image as ImageIcon, User, ArrowLeft } from "lucide-react";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";

const SERVER_BASE = new URL(api).origin;
const LIST_POLL_MS = 3000;
const THREAD_POLL_MS = 2500;

type ConversationSummary = {
    conv_id: string;
    is_customer: boolean;
    customer_name: string | null;
    customer_avatar_url: string | null;
    guest_label: string | null;
    unread_count: number;
    last_message_at: string;
    last_message_preview: string;
    last_message_sender_type: "visitor" | "staff" | null;
};

type ChatMessage = {
    msg_id: string;
    msg_sender_type: "visitor" | "staff";
    msg_text: string | null;
    msg_image_urls: string[] | null;
    msg_created_at: string;
};

// ไม่มี library จัดการวันที่ในโปรเจกต์นี้ (เช็คแล้ว) เขียนเองสั้นๆ พอสำหรับกล่องแชท
function relativeTime(iso: string): string {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return "เมื่อสักครู่";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} นาทีที่แล้ว`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} วันที่แล้ว`;
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// ลูกค้าส่งลิงก์มาเป็นข้อความธรรมดา (ไม่มีคอลัมน์/ประเภทพิเศษแยก) — แปลง URL เปล่าในข้อความให้กดได้ตอนแสดงผล
function Linkified({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/\S+)/g);
    return (
        <>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part)
                    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">{part}</a>
                    : <span key={i}>{part}</span>
            )}
        </>
    );
}

function ConversationBadge({ isCustomer }: { isCustomer: boolean }) {
    return (
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isCustomer ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
            {isCustomer ? "ลูกค้า" : "ผู้เยี่ยมชม"}
        </span>
    );
}

function MessageImages({ urls }: { urls: string[] }) {
    // รูปเดียวโชว์เต็มขนาดปกติ หลายรูปจัดเป็นกริด 2 คอลัมน์ (เหมือน Messenger/LINE) กันรูปเดียวถูกบีบเล็ก
    // เกินไปตอนมีแค่รูปเดียว
    if (urls.length === 1) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${SERVER_BASE}${urls[0]}`} alt="" className="rounded-lg mb-1.5 max-w-full max-h-64 object-contain" />
        );
    }
    return (
        <div className="grid grid-cols-2 gap-1 mb-1.5">
            {urls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`${SERVER_BASE}${url}`} alt="" className="rounded-lg w-full h-24 object-cover" />
            ))}
        </div>
    );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
    const isStaff = msg.msg_sender_type === "staff";
    return (
        <div className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${isStaff ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                {!!msg.msg_image_urls?.length && <MessageImages urls={msg.msg_image_urls} />}
                {msg.msg_text && <p className="whitespace-pre-line break-words"><Linkified text={msg.msg_text} /></p>}
                <p className={`text-[10px] mt-1 ${isStaff ? "text-blue-100" : "text-gray-400"}`}>
                    {new Date(msg.msg_created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </p>
            </div>
        </div>
    );
}

// กล่องข้อความรวม (ทุกคนที่มีสิทธิ์เห็น/ตอบได้ทุกแชท ไม่มีระบบ assign) — อัปเดตด้วย polling (2-3 วิ) ไม่ใช่
// WebSocket เพราะโปรเจกต์นี้ยังไม่มี realtime layer เลย ระยะหน่วงสั้นๆ ยอมรับได้สำหรับแชทสนับสนุนลูกค้า
export default function ChatInbox() {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastMsgIdRef = useRef<string | null>(null);

    const fetchConversations = useCallback(async () => {
        const res = await fetch(`${api}/chat/conversations`, { headers: authHeader() });
        if (!res.ok) return;
        const data = await res.json();
        setConversations(data.conversations ?? []);
    }, []);

    useEffect(() => {
        // setTimeout(...,0) แทนการเรียกตรงๆ — เลี่ยง react-hooks/set-state-in-effect (ห้าม setState
        // แบบ synchronous ในตัว effect เอง) ตัวดึงข้อมูลจริงยังทำงานทันทีอยู่ดี แค่เลื่อนไปรันข้าม tick เดียว
        const kickoff = setTimeout(fetchConversations, 0);
        const timer = setInterval(fetchConversations, LIST_POLL_MS);
        return () => { clearTimeout(kickoff); clearInterval(timer); };
    }, [fetchConversations]);

    const fetchMessages = useCallback(async (convId: string, isPoll: boolean) => {
        const url = isPoll && lastMsgIdRef.current
            ? `${api}/chat/conversations/${convId}/messages?after=${lastMsgIdRef.current}`
            : `${api}/chat/conversations/${convId}/messages`;
        const res = await fetch(url, { headers: authHeader() });
        if (!res.ok) return;
        const data = await res.json();
        const incoming: ChatMessage[] = data.messages ?? [];
        if (incoming.length === 0) return;
        lastMsgIdRef.current = incoming[incoming.length - 1].msg_id;
        setMessages((prev) => (isPoll ? [...prev, ...incoming] : incoming));
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        lastMsgIdRef.current = null;
        const kickoff = setTimeout(() => {
            setMessages([]);
            fetchMessages(selectedId, false);
        }, 0);
        const timer = setInterval(() => fetchMessages(selectedId, true), THREAD_POLL_MS);
        return () => { clearTimeout(kickoff); clearInterval(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    async function sendPayload(convId: string, formData: FormData) {
        setIsSending(true);
        try {
            const res = await fetch(`${api}/chat/conversations/${convId}/messages`, {
                method: "POST", headers: authHeader(), body: formData,
            });
            if (res.ok) {
                await fetchMessages(convId, true);
                fetchConversations();
            }
        } finally {
            setIsSending(false);
        }
    }

    async function handleSendText(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedId || !text.trim()) return;
        const fd = new FormData();
        fd.append("text", text.trim());
        setText("");
        await sendPayload(selectedId, fd);
    }

    async function handlePickImages(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length === 0 || !selectedId) return;
        const fd = new FormData();
        files.forEach((f) => fd.append("images", f));
        await sendPayload(selectedId, fd);
    }

    const selected = conversations.find((c) => c.conv_id === selectedId);

    return (
        <div className="flex h-[calc(100vh-140px)] min-h-[500px] rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {/* รายชื่อแชท — บนมือถือกินเต็มจอแล้วซ่อนไปทางซ้ายทันทีที่เลือกแชท (กันบังพื้นที่คุย เพราะ w-80
                คงที่แทบเต็มจอมือถืออยู่แล้ว) จอ md ขึ้นไปโชว์คู่กับแชทเสมอเหมือนเดิม ไม่เปลี่ยนพฤติกรรม */}
            <div className={`w-full md:w-80 shrink-0 border-r border-gray-100 flex-col md:flex ${selectedId ? "hidden" : "flex"}`}>
                <div className="px-4 py-3 border-b border-gray-100">
                    <h1 className="text-sm font-semibold text-gray-700">แชทกับลูกค้า</h1>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-10">ยังไม่มีแชท</p>
                    ) : conversations.map((c) => (
                        <button
                            key={c.conv_id}
                            type="button"
                            onClick={() => setSelectedId(c.conv_id)}
                            className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-50 transition-colors ${
                                selectedId === c.conv_id ? "bg-blue-50" : "hover:bg-gray-50"
                            }`}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 overflow-hidden">
                                {c.customer_avatar_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={`${SERVER_BASE}${c.customer_avatar_url}`} alt="" className="h-full w-full object-cover" />
                                    : <User className="w-4 h-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-gray-800 truncate">{c.customer_name || c.guest_label}</span>
                                    <ConversationBadge isCustomer={c.is_customer} />
                                </div>
                                <p className="text-xs text-gray-400 truncate mt-0.5">
                                    {c.last_message_sender_type === "staff" ? "คุณ: " : ""}{c.last_message_preview}
                                </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                                <span className="text-[10px] text-gray-400">{relativeTime(c.last_message_at)}</span>
                                {c.unread_count > 0 && (
                                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1">
                                        {c.unread_count}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className={`flex-1 flex-col min-w-0 md:flex ${selectedId ? "flex" : "hidden"}`}>
                {!selected ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2">
                        <MessageCircle className="w-10 h-10" />
                        <p className="text-sm">เลือกแชทด้านซ้ายเพื่อเริ่มดูข้อความ</p>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedId(null)}
                                className="md:hidden -ml-1.5 p-1.5 text-gray-400 hover:text-gray-600 shrink-0"
                                aria-label="กลับไปหน้ารายชื่อแชท"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium text-gray-800">{selected.customer_name || selected.guest_label}</span>
                            <ConversationBadge isCustomer={selected.is_customer} />
                        </div>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
                            {messages.map((m) => <MessageBubble key={m.msg_id} msg={m} />)}
                        </div>
                        <form onSubmit={handleSendText} className="border-t border-gray-100 p-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSending}
                                className="p-2 text-gray-400 hover:text-blue-500 shrink-0 disabled:opacity-40"
                                title="แนบรูปภาพ"
                            >
                                <ImageIcon className="w-5 h-5" />
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePickImages} />
                            <input
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="พิมพ์ข้อความ..."
                                disabled={isSending}
                                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-300"
                            />
                            <button
                                type="submit"
                                disabled={isSending || !text.trim()}
                                className="p-2 rounded-full bg-blue-600 text-white shrink-0 disabled:opacity-40 hover:bg-blue-700 transition-colors"
                                title="ส่ง"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
