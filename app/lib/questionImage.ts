import { api } from "@/app/constans";
import { authHeader } from "./auth";

export async function uploadQuestionImage(productId: string, questionId: string, file: File): Promise<string> {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${api}/products/${productId}/questions/${questionId}/image`, {
        method: "PUT",
        headers: authHeader(),
        body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "อัปโหลดรูปภาพไม่สำเร็จ");
    return data.ques_image_url as string;
}

export async function deleteQuestionImage(productId: string, questionId: string) {
    const res = await fetch(`${api}/products/${productId}/questions/${questionId}/image`, {
        method: "DELETE",
        headers: authHeader(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "ลบรูปภาพไม่สำเร็จ");
    }
}

export async function uploadChoiceImage(productId: string, questionId: string, choiceId: string, file: File): Promise<string> {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${api}/products/${productId}/questions/${questionId}/choices/${choiceId}/image`, {
        method: "PUT",
        headers: authHeader(),
        body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "อัปโหลดรูปภาพไม่สำเร็จ");
    return data.cho_image_url as string;
}

export async function deleteChoiceImage(productId: string, questionId: string, choiceId: string) {
    const res = await fetch(`${api}/products/${productId}/questions/${questionId}/choices/${choiceId}/image`, {
        method: "DELETE",
        headers: authHeader(),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "ลบรูปภาพไม่สำเร็จ");
    }
}
