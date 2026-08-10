"use client";

import TemplateDesigner from "../TemplateDesigner";

export default function CreateTemplatePage() {
    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">สร้าง widget ใหม่</h1>
            <p className="text-sm text-gray-500 mb-6">ลากองค์ประกอบมาวางบนกริด ปรับตำแหน่ง/ขนาดได้อิสระ บันทึกแล้วนำไปใช้ในฟีดข่าวสารได้ทันที</p>
            <TemplateDesigner mode="create" />
        </div>
    );
}
