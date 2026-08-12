"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { api, theme } from "@/app/constans";
import { authHeader } from "@/app/lib/auth";
import type { MenuItem } from "./bit";
import { useSidebar } from "./sidebar-context";
import {
    LayoutDashboard,
    Users,
    CalendarCheck,
    CreditCard,
    BarChart3,
    Settings,
    BookOpen,
    Tags,
    Ticket,
    Wallet,
    Banknote,
    Handshake,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    X,
    LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
    "/dashboard":   LayoutDashboard,
    "/customers":   Users,
    "/bookings":    CalendarCheck,
    "/payments":    CreditCard,
    "/reports":     BarChart3,
    "/settings":    Settings,
    "/products":    BookOpen,
    "/categories":  Tags,
    "/coupons":     Ticket,
    "/expenses":    Wallet,
    "/payroll":     Banknote,
    "/partners":    Handshake,
    "/chat":        MessageCircle,
};

const CHAT_UNREAD_POLL_MS = 5000;

function matchesChild(pathname: string, child: MenuItem, siblings: MenuItem[]): boolean {
    if (pathname === child.href) return true;
    if (!pathname.startsWith(child.href + "/")) return false;
    // Don't claim if a more-specific sibling already matches
    return !siblings.some((s) => s.href !== child.href && pathname.startsWith(s.href));
}

// เลือก top-level item ที่ href ตรง/ใกล้เคียง pathname มากที่สุด (longest-prefix-match) — จำเป็นเพราะ
// เมนู top-level บางกลุ่มมี href ซ้อนกันได้ (เช่น "/partners" กับ "/partners/distributions" เป็นคนละกลุ่ม
// สิทธิ์กัน) ถ้าเช็คแค่ pathname.startsWith(item.href) เฉยๆ ทั้งคู่จะ active พร้อมกันตอนอยู่หน้าใต้
// "/partners/distributions" เพราะมันขึ้นต้นด้วย "/partners/" ด้วยเหมือนกัน
function findActiveTopHref(pathname: string, items: MenuItem[]): string | null {
    let best: string | null = null;
    for (const item of items) {
        const matches = pathname === item.href || pathname.startsWith(item.href + "/");
        if (matches && (best === null || item.href.length > best.length)) {
            best = item.href;
        }
    }
    return best;
}

function getInitialOpen(items: MenuItem[], pathname: string): Set<string> {
    const open = new Set<string>();
    for (const item of items) {
        const children = item.children ?? [];
        if (children.some((c) => matchesChild(pathname, c, children))) {
            open.add(item.href);
        }
    }
    return open;
}

export default function SidebarClient({ items, initialCollapsed }: { items: MenuItem[]; initialCollapsed: boolean }) {
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const pathname = usePathname();
    const [openItems, setOpenItems] = useState<Set<string>>(() => getInitialOpen(items, pathname));
    const { mobileOpen, setMobileOpen } = useSidebar();

    // แจ้งเตือนจำนวนข้อความแชทที่ยังไม่ได้อ่านที่เมนู — poll เอง (ไม่มี WebSocket ในระบบนี้) เฉพาะตอนมีสิทธิ์
    // เห็นเมนูนี้จริงๆ เท่านั้น (items ผ่านการกรองสิทธิ์มาจาก getVisibleItems แล้วตั้งแต่ sidebar.tsx) กันยิง
    // request เปล่าประโยชน์ให้คนที่มองไม่เห็นเมนูอยู่ดี
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const hasChatAccess = items.some((i) => i.href === "/chat");

    const fetchChatUnread = useCallback(async () => {
        const res = await fetch(`${api}/chat/unread-count`, { headers: authHeader() });
        if (!res.ok) return;
        const data = await res.json();
        setChatUnreadCount(data.unread_count ?? 0);
    }, []);

    useEffect(() => {
        if (!hasChatAccess) return;
        // setTimeout(...,0) แทนการเรียกตรงๆ ใน effect — เลี่ยง react-hooks/set-state-in-effect
        const kickoff = setTimeout(fetchChatUnread, 0);
        const timer = setInterval(fetchChatUnread, CHAT_UNREAD_POLL_MS);
        return () => { clearTimeout(kickoff); clearInterval(timer); };
    }, [hasChatAccess, fetchChatUnread]);

    function toggle() {
        setCollapsed((prev: boolean) => {
            const next = !prev;
            document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000`;
            return next;
        });
    }

    function toggleSubmenu(href: string) {
        setOpenItems((prev) => {
            const next = new Set(prev);
            if (next.has(href)) next.delete(href);
            else next.add(href);
            return next;
        });
    }

    function handleNavClick() {
        if (mobileOpen) setMobileOpen(false);
    }

    const activeTopHref = findActiveTopHref(pathname, items);

    const navContent = (
        <nav className="flex flex-col gap-0.5 p-2 pt-3 flex-1 overflow-y-auto">
            {items.map((item) => {
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                const hasChildren = !!item.children?.length;
                const isOpen = openItems.has(item.href);
                const children = item.children ?? [];
                const isChildActive = children.some((c) => matchesChild(pathname, c, children));
                const isActive = !hasChildren && item.href === activeTopHref;
                const isParentHighlighted = hasChildren && isChildActive && collapsed;

                return (
                    <div key={item.href} className="relative group">
                        {hasChildren ? (
                            <button
                                onClick={() => !collapsed && toggleSubmenu(item.href)}
                                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                                    isParentHighlighted ? theme.sidebar.activeItem : theme.sidebar.inactiveItem
                                }`}
                            >
                                <Icon size={18} className="shrink-0" />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1 truncate font-medium text-left">{item.label}</span>
                                        <ChevronDown
                                            size={14}
                                            className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                        />
                                    </>
                                )}
                            </button>
                        ) : (
                            <Link
                                href={item.href}
                                onClick={handleNavClick}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                                    isActive ? theme.sidebar.activeItem : theme.sidebar.inactiveItem
                                }`}
                            >
                                <span className="relative shrink-0">
                                    <Icon size={18} />
                                    {item.href === "/chat" && chatUnreadCount > 0 && collapsed && (
                                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                                    )}
                                </span>
                                {!collapsed && (
                                    <span className="truncate font-medium">{item.label}</span>
                                )}
                                {item.href === "/chat" && chatUnreadCount > 0 && !collapsed && (
                                    <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1">
                                        {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                                    </span>
                                )}
                                {isActive && !collapsed && !(item.href === "/chat" && chatUnreadCount > 0) && (
                                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />
                                )}
                            </Link>
                        )}

                        {/* Tooltip when collapsed (desktop only) */}
                        {collapsed && (
                            <div className={`pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-md ${theme.sidebar.tooltip} px-2.5 py-1.5 text-xs font-medium opacity-0 shadow-lg transition-opacity group-hover:opacity-100 whitespace-nowrap`}>
                                {item.label}
                                <span className={`absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent ${theme.sidebar.tooltipArrow}`} />
                            </div>
                        )}

                        {/* Sub-menu */}
                        {hasChildren && !collapsed && isOpen && (
                            <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
                                {item.children!.map((child) => {
                                    const isChildItemActive = matchesChild(pathname, child, item.children!);
                                    return (
                                        <Link
                                            key={child.href}
                                            href={child.href}
                                            onClick={handleNavClick}
                                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                                                isChildItemActive ? theme.sidebar.activeItem : theme.sidebar.inactiveItem
                                            }`}
                                        >
                                            <span className="h-1 w-1 rounded-full bg-current shrink-0 opacity-60" />
                                            <span className="truncate font-medium">{child.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );

    return (
        <>
            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 flex w-56 xs:w-64 flex-col
                ${theme.sidebar.bg} ${theme.sidebar.border}
                transition-transform duration-300 ease-in-out
                ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
                md:hidden
            `}>
                <div className={`flex h-16 items-center justify-between ${theme.sidebar.headerBorder} px-4`}>
                    <Image src="/logo/fasttiw-logo.svg" alt="Fasttiw" width={69} height={28} className="shrink-0 object-contain" />
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                {navContent}
            </aside>

            {/* Desktop sidebar */}
            <aside className={`
                relative hidden md:flex flex-col
                ${theme.sidebar.bg} 
                ${theme.sidebar.border}
                transition-all duration-300 ease-in-out
                ${collapsed ? "w-16" : "w-60"}
            `}>
                <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "gap-3 px-4"} ${theme.sidebar.headerBorder}`}>
                    {collapsed ? (
                        <Image src="/logo/favicon.svg" alt="Fasttiw" width={32} height={32} className="shrink-0 object-contain" />
                    ) : (
                        <Image src="/logo/fasttiw-logo.svg" alt="Fasttiw" width={98} height={40} className="shrink-0 object-contain" />
                    )}
                </div>

                {/* Toggle button */}
                <button
                    onClick={toggle}
                    className={`absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-all ${theme.sidebar.toggleBtn}`}
                    aria-label={collapsed ? "ขยาย sidebar" : "ย่อ sidebar"}
                >
                    {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                </button>

                {navContent}
            </aside>
        </>
    );
}
