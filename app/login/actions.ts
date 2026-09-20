"use server";

import { cookies } from "next/headers";
import { api, apiOrigin } from "../constans";
import { forwardedClientHeaders } from "../lib/clientIp";

// require2fa = รหัสผ่านถูกแล้วแต่บัญชีนี้เปิดยืนยันสองชั้นไว้ ต้องกรอกรหัสจากอีเมลต่อ (2026-09-20)
type State = { error: string } | { token: string } | { require2fa: true; challengeToken: string; message: string } | null;

export async function handleLogin(_prevState: State, formData: FormData): Promise<State> {
    try {
        const user_email = formData.get("user_email");
        const user_password = formData.get("user_password");

        const res = await fetch(`${api}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await forwardedClientHeaders()) },
            body: JSON.stringify({ user_email, user_password }),
        });

        if (!res.ok) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

        const data = await res.json();
        if (data.require_2fa) {
            return { require2fa: true, challengeToken: data.challenge_token, message: data.message ?? "ส่งรหัสยืนยันไปทางอีเมลแล้ว" };
        }
        return await completeLogin(data.token);
    } catch (err) {
        // เดิม catch เฉยๆ ไม่ log อะไรเลย — เกิด error ประเภทไหนก็ตาม (เช่น backend ยังสตาร์ทไม่เสร็จตอน
        // dev server เพิ่งรีสตาร์ท, เน็ตหลุด, backend ล่ม) ผู้ใช้เห็นข้อความเดียวกันหมด ไล่ debug ย้อนหลังจาก
        // log ไม่ได้เลยว่าจริงๆ แล้วคืออะไร — log ไว้ฝั่ง server เสมอ (ไม่ส่งรายละเอียดออกไปให้ผู้ใช้เห็น
        // เพราะอาจมีข้อมูล internal เช่น URL/stack ปนอยู่)
        console.error("handleLogin failed:", err);
        return { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
    }
}

// ขั้นที่สองของการเข้าสู่ระบบ (เฉพาะบัญชีที่เปิดยืนยันสองชั้น) — ส่งรหัสจากอีเมลไปแลก token จริง
export async function handleLogin2fa(challengeToken: string, otp: string): Promise<State> {
    try {
        const res = await fetch(`${api}/auth/login/2fa`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await forwardedClientHeaders()) },
            body: JSON.stringify({ challenge_token: challengeToken, otp }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data.message ?? "รหัสยืนยันไม่ถูกต้อง" };
        return await completeLogin(data.token);
    } catch (err) {
        console.error("handleLogin2fa failed:", err);
        return { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
    }
}

// ตั้ง cookie ทั้งชุดหลังได้ token จริง — ใช้ร่วมกันทั้งล็อกอินชั้นเดียวและแบบสองชั้น
async function completeLogin(token: string): Promise<State> {
    try {
        const { user_role_id, user_id } = decodeToken(token);

        const permRes = await fetch(
            `${api}/auth/verifyPermission?user_role_id=${user_role_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!permRes.ok) return { error: "ไม่สามารถตรวจสอบสิทธิ์ได้" };

        const { role_permission } = await permRes.json();

        const cookieStore = await cookies();
        cookieStore.set("token", token, { httpOnly: true, path: "/", sameSite: "lax" });
        cookieStore.set("permission", role_permission, { httpOnly: true, path: "/", sameSite: "lax" });
        // userId อ่านได้จาก JS โดยตั้งใจ — เป็นแค่ "รหัสผู้ใช้" ไม่ใช่ของที่ใช้ยืนยันตัวตน (เหมือน fullname)
        // หน้าเว็บบางหน้าต้องรู้ว่าตัวเองเป็นใครเพื่อดึงโปรไฟล์ เดิมแกะเอาจาก JWT ใน localStorage ซึ่งเป็น
        // เหตุผลเดียวที่ทำให้ต้องเก็บ token ไว้ให้ JS อ่านได้ · **ของจริงที่ใช้ยืนยันตัวตนคือ token ใน cookie
        // httpOnly เท่านั้น** ปลอม userId มาก็ไม่มีผล เพราะ backend ตัดสินสิทธิ์จาก token ไม่ใช่จากค่านี้
        cookieStore.set("userId", String(user_id), { httpOnly: false, path: "/", sameSite: "lax" });

        const fullname = await getFullName();
        cookieStore.set("fullname", String(fullname), { httpOnly: false, path: "/", sameSite: "lax" });

        return { token };
    } catch (err) {
        console.error("completeLogin failed:", err);
        return { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
    }
}

function decodeToken(token: string): { user_role_id: number; user_id: number } {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString());
}


export async function getFullName(): Promise<string> {
    return (await getUserProfile()).fullname;
}

// อัปเดต token ใน cookie หลังได้ token ใบใหม่จาก backend (เช่น หลังเปลี่ยนรหัสผ่าน ซึ่ง backend
// เตะ session เดิมทิ้งทั้งหมด) — แอดมินเก็บ token ไว้ 2 ที่: localStorage (client fetch) กับ cookie
// (Server Component/Server Action) ถ้าอัปเดตแค่ที่เดียว อีกฝั่งจะถือ token ที่ถูกเพิกถอนไปแล้ว
// แล้วหน้าเว็บจะกลายเป็น "ล็อกอินอยู่ครึ่งเดียว" — เมนู/โปรไฟล์หาย ทั้งที่ยังกดใช้งานหน้าอื่นได้
export async function refreshSessionCookie(token: string) {
    if (!token) return;
    const cookieStore = await cookies();
    cookieStore.set("token", token, { httpOnly: true, path: "/", sameSite: "lax" });
}

export async function getUserProfile(): Promise<{
    fullname: string; avatarUrl: string | null; mustChangePassword: boolean; roleName: string;
}> {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = cookieStore.get("userId")?.value;
    if (!token || !userId) return { fullname: "", avatarUrl: null, mustChangePassword: false, roleName: "" };

    const res = await fetch(`${api}/users/me?user_id=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!res.ok) return { fullname: "", avatarUrl: null, mustChangePassword: false, roleName: "" };

    const data = await res.json();
    const serverBase = apiOrigin;
    return {
        fullname:  data.user_fullname ?? data.fullname ?? "",
        avatarUrl: data.user_avatar_url ? `${serverBase}${data.user_avatar_url}` : null,
        mustChangePassword: !!data.user_must_change_password,
        roleName: data.role_name ?? "",
    };
}


