"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import Button from "@/components/ui/Button/Button";
import Input from "@/components/ui/Input/input";
import Form from "@/components/ui/form/Form";
import AvatarCrop from "@/components/ui/AvatarCrop";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";

type FormState = {
    cus_username: string;
    cus_fname: string;
    cus_lname: string;
    cus_email: string;
    cus_phone: string;
    cus_status: "active" | "inactive";
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// ชื่อ/นามสกุล/อีเมล ไม่บังคับ (ลูกค้าอาจยังไม่ได้กรอกเอง) — validate เฉพาะ Username (บังคับ) กับรูปแบบ
// ถ้ามีการกรอกอีเมล/เบอร์โทรมา
function validate(form: FormState): FormErrors {
    const errors: FormErrors = {};

    if (!form.cus_username.trim()) errors.cus_username = "กรุณากรอก Username";

    if (form.cus_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.cus_email))
        errors.cus_email = "รูปแบบอีเมลไม่ถูกต้อง";

    if (form.cus_phone && !/^[0-9]{9,10}$/.test(form.cus_phone.replace(/-/g, "")))
        errors.cus_phone = "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก";

    return errors;
}

async function fetchCustomer(id: string) {
    const res = await fetch(`${api}/customers/${id}`, { headers: authHeader() });
    if (!res.ok) return null;
    return res.json();
}

async function submitUpdateCustomer(id: string, body: FormState) {
    const res = await fetch(`${api}/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

async function resetPassword(id: string): Promise<{ temp_password: string }> {
    const res = await fetch(`${api}/customers/${id}/reset-password`, {
        method: "PUT",
        headers: authHeader(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "เกิดข้อผิดพลาด");
    return data;
}

async function uploadAvatar(id: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    await fetch(`${api}/customers/${id}/image`, {
        method: "PUT",
        headers: authHeader(),
        body: fd,
    });
}

const SERVER_BASE = new URL(api).origin;

const EMPTY_FORM: FormState = {
    cus_username: "", cus_fname: "", cus_lname: "", cus_email: "", cus_phone: "", cus_status: "active",
};

export default function EditCustomerPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const id = searchParams.get("id") ?? "";

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(undefined);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const [confirmResetOpen, setConfirmResetOpen] = useState(false);
    const [resetPending, setResetPending] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        startTransition(async () => {
            const data = await fetchCustomer(id);
            if (!data) { setNotFound(true); return; }
            setForm({
                cus_username: data.cus_username ?? "",
                cus_fname: data.cus_fname ?? "",
                cus_lname: data.cus_lname ?? "",
                cus_email: data.cus_email ?? "",
                cus_phone: data.cus_phone ?? "",
                cus_status: data.cus_status === "inactive" ? "inactive" : "active",
            });
            if (data.cus_avatar_url) setCurrentAvatar(`${SERVER_BASE}${data.cus_avatar_url}`);
        });
    }, [id]);

    function setField(name: keyof FormState, value: string) {
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setField(e.target.name as keyof FormState, e.target.value);
    }

    function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
        setForm((prev) => ({ ...prev, cus_status: e.target.value === "inactive" ? "inactive" : "active" }));
    }

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);
        const fieldErrors = validate(form);
        if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }

        startTransition(async () => {
            try {
                await submitUpdateCustomer(id, form);
                if (avatarFile) await uploadAvatar(id, avatarFile);
                toast.success("แก้ไขข้อมูลลูกค้าสำเร็จ");
                router.push("/customers");
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
            }
        });
    }

    async function handleResetPassword() {
        setResetPending(true);
        try {
            const { temp_password } = await resetPassword(id);
            setConfirmResetOpen(false);
            setTempPassword(temp_password);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        } finally {
            setResetPending(false);
        }
    }

    async function copyTempPassword() {
        if (tempPassword) {
            const text = `Username: ${form.cus_username}\nรหัสผ่านชั่วคราว: ${tempPassword}`;
            await navigator.clipboard.writeText(text).catch(() => {});
        }
        toast.success("คัดลอก Username และรหัสผ่านชั่วคราวแล้ว");
        setTempPassword(null);
    }

    if (!id || notFound) return <p className="p-6 text-gray-500">ไม่พบลูกค้า</p>;

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">แก้ไขข้อมูลลูกค้า</h1>
                <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    className="px-4 py-2 text-sm text-amber-600 border border-amber-200 rounded hover:bg-amber-50"
                >
                    รีเซ็ตรหัสผ่าน
                </button>
            </div>

            <Form cols={2} onSubmit={handleSubmit} className="bg-white shadow-sm border-gray-100 rounded-xl">
                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">รูปโปรไฟล์</label>
                    {/* key เปลี่ยนตาม currentAvatar เพื่อ remount ใหม่เมื่อ fetch เสร็จ — AvatarCrop เก็บ preview เป็น internal state ที่ตั้งค่าแค่ตอน mount */}
                    <AvatarCrop key={currentAvatar ?? "loading"} value={currentAvatar} onChange={setAvatarFile} disabled={isPending} />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <Input name="cus_username" value={form.cus_username} onChange={handleChange}
                        placeholder="Username" error={!!errors.cus_username} />
                    {errors.cus_username && <p className="text-xs text-red-500">{errors.cus_username}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">ชื่อ</label>
                    <Input name="cus_fname" value={form.cus_fname} onChange={handleChange}
                        placeholder="ชื่อ (ไม่บังคับ)" error={!!errors.cus_fname} />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">นามสกุล</label>
                    <Input name="cus_lname" value={form.cus_lname} onChange={handleChange}
                        placeholder="นามสกุล (ไม่บังคับ)" error={!!errors.cus_lname} />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">อีเมล</label>
                    <Input type="email" name="cus_email" value={form.cus_email} onChange={handleChange}
                        placeholder="อีเมล (ไม่บังคับ)" error={!!errors.cus_email} />
                    {errors.cus_email && <p className="text-xs text-red-500">{errors.cus_email}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                    <Input name="cus_phone" value={form.cus_phone} onChange={handleChange}
                        placeholder="0812345678" error={!!errors.cus_phone} />
                    {errors.cus_phone && <p className="text-xs text-red-500">{errors.cus_phone}</p>}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">สถานะการใช้งาน</label>
                    <select
                        value={form.cus_status}
                        onChange={handleStatusChange}
                        className="px-4 py-2 border rounded focus:outline-none focus:ring-2 border-gray-300 focus:border-blue-400 focus:ring-blue-500/20"
                    >
                        <option value="active">ใช้งาน</option>
                        <option value="inactive">ยกเลิกใช้งาน</option>
                    </select>
                </div>

                {submitError && <p className="col-span-2 text-sm text-red-600">{submitError}</p>}

                <div className="col-span-2 flex justify-end gap-3">
                    <button type="button" onClick={() => router.push("/customers")}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        ยกเลิก
                    </button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                </div>
            </Form>

            <ConfirmDialog
                open={confirmResetOpen}
                variant="warning"
                title="รีเซ็ตรหัสผ่านลูกค้านี้?"
                description="ระบบจะ gen รหัสผ่านชั่วคราวใหม่ให้ และบังคับให้ลูกค้าตั้งรหัสผ่านใหม่ตอน login ครั้งถัดไป รหัสผ่านเดิมจะใช้ไม่ได้ทันที"
                confirmLabel="รีเซ็ตรหัสผ่าน"
                loading={resetPending}
                onConfirm={handleResetPassword}
                onCancel={() => setConfirmResetOpen(false)}
            />

            <ConfirmDialog
                open={!!tempPassword}
                variant="info"
                title="รีเซ็ตรหัสผ่านสำเร็จ"
                description={`Username: ${form.cus_username}\nรหัสผ่านชั่วคราว: ${tempPassword}\n\nกรุณาคัดลอกไปให้ลูกค้าก่อนปิดหน้าต่างนี้`}
                confirmLabel="คัดลอก Username + รหัสผ่าน"
                cancelLabel="ปิด"
                onConfirm={copyTempPassword}
                onCancel={() => setTempPassword(null)}
            />
        </div>
    );
}
