"use client";

import MockExamForm, { EMPTY_MOCK_EXAM } from "../MockExamForm";

export default function CreateMockExamPage() {
    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">สร้างสนามสอบเสมือน</h1>
            <MockExamForm initial={EMPTY_MOCK_EXAM} />
        </div>
    );
}
