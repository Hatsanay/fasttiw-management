import ChatInbox from "./ChatInbox";

// ไม่มีการเช็คสิทธิ์ระดับหน้าเพิ่มเติม (ตามแบบแผนเดิมของระบบ) — sidebar ซ่อนเมนูนี้อยู่แล้วถ้าไม่มีบิต
// chatManagement และทุก endpoint ที่เรียกก็ requirePermission("chatManagement") อยู่แล้วฝั่ง backend
export default function ChatPage() {
    return <ChatInbox />;
}
