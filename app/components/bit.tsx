export type MenuItem = {
    key: string;
    label: string;
    href: string;
    hidden?: boolean;
    children?: MenuItem[];
};

// ─── Sidebar menu structure ───────────────────────────────────────────────────
// Leaf order here = bitmask positions. Must stay in sync with PERMISSION_GROUPS below.
export const MENU_DEFS: MenuItem[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    {
        key: "usersManagement", label: "จัดการข้อมูลผู้ใช้งาน", href: "/users",
        children: [
            { key: "usersManagement", label: "จัดการข้อมูลผู้ใช้งาน", href: "/users", hidden: true },
            { key: "createUsers",     label: "สร้างผู้ใช้งาน",       href: "/users/create", hidden: true },
            { key: "editUsers",       label: "แก้ไขผู้ใช้งาน",         href: "/users/edit",   hidden: true },
            { key: "deleteUsers",     label: "ลบผู้ใช้งาน",           href: "/users/delete", hidden: true },
        ],
    },
    // { key: "payments",  label: "การชำระเงิน",  href: "/payments" },
    // { key: "reports",   label: "รายงาน",       href: "/reports" },
    {
        key: "settings", label: "ตั้งค่าระบบ", href: "/settings",
        children: [
            { key: "roleManagement", label: "จัดการสิทธิ์", href: "/settings/roles" },
            { key: "createRole",     label: "สร้างสิทธิ์",   href: "/settings/roles/create", hidden: true },
            { key: "editRole",       label: "แก้ไขสิทธิ์",   href: "/settings/roles/edit",   hidden: true },
            { key: "deleteRole",     label: "ลบสิทธิ์",     href: "/settings/roles/delete", hidden: true },
            { key: "departmentManagement", label: "จัดการแผนก", href: "/settings/departments" },
            { key: "createDepartment",     label: "สร้างแผนก",   href: "/settings/departments/create", hidden: true },
            { key: "editDepartment",       label: "แก้ไขแผนก",   href: "/settings/departments/edit",   hidden: true },
            { key: "deleteDepartment",     label: "ลบแผนก",     href: "/settings/departments/delete", hidden: true },
            // loginLogs อยู่ล่างสุดเสมอ — ห้ามแทรกกลาง ตำแหน่ง bit ผูกกับ role_permission ที่เก็บไว้ใน DB แล้ว
            { key: "loginLogs",      label: "Log ข้อมูล",   href: "/settings/logs" },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่เก็บไว้ใน DB แล้ว
    {
        key: "products", label: "จัดการชุดข้อสอบ", href: "/products",
        children: [
            { key: "productsManagement", label: "จัดการชุดข้อสอบ", href: "/products", hidden: true },
            { key: "createProduct",      label: "สร้างชุดข้อสอบ",   href: "/products/create", hidden: true },
            { key: "editProduct",        label: "แก้ไขชุดข้อสอบ",   href: "/products/edit",   hidden: true },
            { key: "deleteProduct",      label: "ลบชุดข้อสอบ",     href: "/products/delete", hidden: true },
        ],
    },
    {
        key: "categories", label: "หมวดหมู่", href: "/categories",
        children: [
            { key: "categoriesManagement", label: "หมวดหมู่ชุดข้อสอบ", href: "/categories/products" },
            { key: "createCategory",       label: "สร้างหมวดหมู่ชุดข้อสอบ", href: "/categories/products/create", hidden: true },
            { key: "editCategory",         label: "แก้ไขหมวดหมู่ชุดข้อสอบ", href: "/categories/products/edit",   hidden: true },
            { key: "deleteCategory",       label: "ลบหมวดหมู่ชุดข้อสอบ",   href: "/categories/products/delete", hidden: true },
            { key: "topicsManagement",     label: "หมวดหมู่คำถาม",   href: "/categories/topics" },
            { key: "createTopic",          label: "สร้างหมวดหมู่คำถาม", href: "/categories/topics/create", hidden: true },
            { key: "editTopic",            label: "แก้ไขหมวดหมู่คำถาม", href: "/categories/topics/edit",   hidden: true },
            { key: "deleteTopic",          label: "ลบหมวดหมู่คำถาม",   href: "/categories/topics/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "customersManagement", label: "จัดการลูกค้า", href: "/customers",
        children: [
            { key: "customersManagement", label: "จัดการลูกค้า", href: "/customers", hidden: true },
            { key: "createCustomer",      label: "สร้างลูกค้า",   href: "/customers/create", hidden: true },
            { key: "editCustomer",        label: "แก้ไขลูกค้า",   href: "/customers/edit",   hidden: true },
            { key: "deleteCustomer",      label: "ลบลูกค้า",     href: "/customers/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "couponsManagement", label: "คูปองส่วนลด", href: "/coupons",
        children: [
            { key: "couponsManagement", label: "คูปองส่วนลด", href: "/coupons", hidden: true },
            { key: "createCoupon",      label: "สร้างคูปอง",   href: "/coupons/create", hidden: true },
            { key: "editCoupon",        label: "แก้ไขคูปอง",   href: "/coupons/edit",   hidden: true },
            { key: "deleteCoupon",      label: "ลบคูปอง",     href: "/coupons/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "expensesManagement", label: "ค่าใช้จ่าย", href: "/expenses",
        children: [
            { key: "expensesManagement", label: "รายการค่าใช้จ่าย", href: "/expenses" },
            { key: "createExpense",      label: "สร้างค่าใช้จ่าย",   href: "/expenses/create", hidden: true },
            { key: "editExpense",        label: "แก้ไขค่าใช้จ่าย",   href: "/expenses/edit",   hidden: true },
            { key: "deleteExpense",      label: "ลบค่าใช้จ่าย",     href: "/expenses/delete", hidden: true },
            { key: "expenseCategoriesManagement", label: "หมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories" },
            { key: "createExpenseCategory",       label: "สร้างหมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories/create", hidden: true },
            { key: "editExpenseCategory",         label: "แก้ไขหมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories/edit",   hidden: true },
            { key: "deleteExpenseCategory",       label: "ลบหมวดหมู่ค่าใช้จ่าย",   href: "/expenses/categories/delete", hidden: true },
        ],
    },
    { key: "reportsManagement", label: "รายงานการเงิน", href: "/reports" },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "payrollManagement", label: "เงินเดือนพนักงาน", href: "/payroll",
        children: [
            { key: "payrollManagement", label: "เงินเดือนพนักงาน", href: "/payroll", hidden: true },
            { key: "createPayroll",     label: "สร้างรายการเงินเดือน", href: "/payroll/create", hidden: true },
            { key: "editPayroll",       label: "แก้ไขรายการเงินเดือน", href: "/payroll/edit",   hidden: true },
            { key: "deletePayroll",     label: "ลบรายการเงินเดือน",   href: "/payroll/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "partnersManagement", label: "หุ้นส่วน", href: "/partners",
        children: [
            { key: "partnersManagement", label: "หุ้นส่วน",       href: "/partners",      hidden: true },
            { key: "editPartner",        label: "แก้ไขหุ้นส่วน", href: "/partners/edit", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "packagesManagement", label: "แพ็กเกจรวมชุด", href: "/packages",
        children: [
            { key: "packagesManagement", label: "แพ็กเกจรวมชุด", href: "/packages", hidden: true },
            { key: "createPackage",      label: "สร้างแพ็กเกจ",   href: "/packages/create", hidden: true },
            { key: "editPackage",        label: "แก้ไขแพ็กเกจ",   href: "/packages/edit",   hidden: true },
            { key: "deletePackage",      label: "ลบแพ็กเกจ",     href: "/packages/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    { key: "paymentSettings", label: "ค่าธรรมเนียมการชำระเงิน", href: "/settings/payment" },
    {
        key: "partnerDistributionsManagement", label: "จ่ายส่วนแบ่งกำไรหุ้นส่วน", href: "/partners/distributions",
        children: [
            { key: "partnerDistributionsManagement", label: "จ่ายส่วนแบ่งกำไรหุ้นส่วน", href: "/partners/distributions", hidden: true },
            { key: "createPartnerDistribution", label: "บันทึกจ่ายส่วนแบ่ง",   href: "/partners/distributions/create", hidden: true },
            { key: "editPartnerDistribution",   label: "แก้ไขรายการจ่ายส่วนแบ่ง", href: "/partners/distributions/edit",   hidden: true },
            { key: "deletePartnerDistribution", label: "ลบรายการจ่ายส่วนแบ่ง",   href: "/partners/distributions/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    // ไม่มีหน้าแยก ใช้แค่เป็น gate ปุ่ม "จ่ายเงินเดือนพนักงานแบบชุด" ในหน้า /payroll เดิม จึง hidden เสมอ
    { key: "runPayroll", label: "จ่ายเงินเดือนพนักงานแบบชุด", href: "/payroll", hidden: true },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    {
        key: "newsManagement", label: "ข่าวสาร", href: "/news",
        children: [
            { key: "newsManagement", label: "ข่าวสาร",     href: "/news",        hidden: true },
            { key: "createNews",     label: "สร้างข่าวสาร", href: "/news/create", hidden: true },
            { key: "editNews",       label: "แก้ไขข่าวสาร", href: "/news/edit",   hidden: true },
            { key: "deleteNews",     label: "ลบข่าวสาร",   href: "/news/delete", hidden: true },
        ],
    },
    // กลุ่มใหม่ต้องต่อท้ายเสมอ (ห้ามแทรกกลาง) เพราะตำแหน่ง bit ผูกกับ role_permission ที่บันทึกไว้ใน DB แล้ว
    { key: "chatManagement", label: "แชทกับลูกค้า", href: "/chat" },
];

// ─── Permission groups (used by create/edit role page) ────────────────────────
// Each group's bits must match the leaf order in MENU_DEFS exactly.
export type PermGroup = {
    groupLabel: string;
    bits: MenuItem[];
};

export const PERMISSION_GROUPS: PermGroup[] = [
    {
        groupLabel: "Dashboard",
        bits: [
            { key: "dashboard", label: "Dashboard", href: "/dashboard" },
        ],
    },
    {
        groupLabel: "จัดการข้อมูลผู้ใช้งาน",
        bits: [
            { key: "usersManagement", label: "จัดการข้อมูลผู้ใช้งาน", href: "/users" },
            { key: "createUsers",     label: "สร้างผู้ใช้งาน",       href: "/users/create", hidden: true },
            { key: "editUsers",       label: "แก้ไขผู้ใช้งาน",         href: "/users/edit",   hidden: true },
            { key: "deleteUsers",     label: "ลบผู้ใช้งาน",           href: "/users/delete", hidden: true },
        ],
    },
    {
        groupLabel: "ตั้งค่าระบบ",
        bits: [
            { key: "roleManagement", label: "จัดการสิทธิ์", href: "/settings/roles" },
            { key: "createRole",     label: "สร้างสิทธิ์",   href: "/settings/roles/create", hidden: true },
            { key: "editRole",       label: "แก้ไขสิทธิ์",   href: "/settings/roles/edit",   hidden: true },
            { key: "deleteRole",     label: "ลบสิทธิ์",     href: "/settings/roles/delete", hidden: true },
            { key: "departmentManagement", label: "จัดการแผนก", href: "/settings/departments" },
            { key: "createDepartment",     label: "สร้างแผนก",   href: "/settings/departments/create", hidden: true },
            { key: "editDepartment",       label: "แก้ไขแผนก",   href: "/settings/departments/edit",   hidden: true },
            { key: "deleteDepartment",     label: "ลบแผนก",     href: "/settings/departments/delete", hidden: true },
            { key: "loginLogs",      label: "Log ข้อมูล",   href: "/settings/logs" },
        ],
    },
    {
        groupLabel: "จัดการชุดข้อสอบ",
        bits: [
            { key: "productsManagement", label: "จัดการชุดข้อสอบ", href: "/products" },
            { key: "createProduct",      label: "สร้างชุดข้อสอบ",   href: "/products/create", hidden: true },
            { key: "editProduct",        label: "แก้ไขชุดข้อสอบ",   href: "/products/edit",   hidden: true },
            { key: "deleteProduct",      label: "ลบชุดข้อสอบ",     href: "/products/delete", hidden: true },
        ],
    },
    {
        groupLabel: "หมวดหมู่",
        bits: [
            { key: "categoriesManagement", label: "หมวดหมู่ชุดข้อสอบ", href: "/categories/products" },
            { key: "createCategory",       label: "สร้างหมวดหมู่ชุดข้อสอบ", href: "/categories/products/create", hidden: true },
            { key: "editCategory",         label: "แก้ไขหมวดหมู่ชุดข้อสอบ", href: "/categories/products/edit",   hidden: true },
            { key: "deleteCategory",       label: "ลบหมวดหมู่ชุดข้อสอบ",   href: "/categories/products/delete", hidden: true },
            { key: "topicsManagement",     label: "หมวดหมู่คำถาม",   href: "/categories/topics" },
            { key: "createTopic",          label: "สร้างหมวดหมู่คำถาม", href: "/categories/topics/create", hidden: true },
            { key: "editTopic",            label: "แก้ไขหมวดหมู่คำถาม", href: "/categories/topics/edit",   hidden: true },
            { key: "deleteTopic",          label: "ลบหมวดหมู่คำถาม",   href: "/categories/topics/delete", hidden: true },
        ],
    },
    {
        groupLabel: "จัดการลูกค้า",
        bits: [
            { key: "customersManagement", label: "จัดการลูกค้า", href: "/customers" },
            { key: "createCustomer",      label: "สร้างลูกค้า",   href: "/customers/create", hidden: true },
            { key: "editCustomer",        label: "แก้ไขลูกค้า",   href: "/customers/edit",   hidden: true },
            { key: "deleteCustomer",      label: "ลบลูกค้า",     href: "/customers/delete", hidden: true },
        ],
    },
    {
        groupLabel: "คูปองส่วนลด",
        bits: [
            { key: "couponsManagement", label: "คูปองส่วนลด", href: "/coupons" },
            { key: "createCoupon",      label: "สร้างคูปอง",   href: "/coupons/create", hidden: true },
            { key: "editCoupon",        label: "แก้ไขคูปอง",   href: "/coupons/edit",   hidden: true },
            { key: "deleteCoupon",      label: "ลบคูปอง",     href: "/coupons/delete", hidden: true },
        ],
    },
    {
        groupLabel: "ค่าใช้จ่าย",
        bits: [
            { key: "expensesManagement", label: "รายการค่าใช้จ่าย", href: "/expenses" },
            { key: "createExpense",      label: "สร้างค่าใช้จ่าย",   href: "/expenses/create", hidden: true },
            { key: "editExpense",        label: "แก้ไขค่าใช้จ่าย",   href: "/expenses/edit",   hidden: true },
            { key: "deleteExpense",      label: "ลบค่าใช้จ่าย",     href: "/expenses/delete", hidden: true },
            { key: "expenseCategoriesManagement", label: "หมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories" },
            { key: "createExpenseCategory",       label: "สร้างหมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories/create", hidden: true },
            { key: "editExpenseCategory",         label: "แก้ไขหมวดหมู่ค่าใช้จ่าย", href: "/expenses/categories/edit",   hidden: true },
            { key: "deleteExpenseCategory",       label: "ลบหมวดหมู่ค่าใช้จ่าย",   href: "/expenses/categories/delete", hidden: true },
        ],
    },
    {
        groupLabel: "รายงานการเงิน",
        bits: [
            { key: "reportsManagement", label: "รายงานการเงิน", href: "/reports" },
        ],
    },
    {
        groupLabel: "เงินเดือนพนักงาน",
        bits: [
            { key: "payrollManagement", label: "เงินเดือนพนักงาน", href: "/payroll" },
            { key: "createPayroll",     label: "สร้างรายการเงินเดือน", href: "/payroll/create", hidden: true },
            { key: "editPayroll",       label: "แก้ไขรายการเงินเดือน", href: "/payroll/edit",   hidden: true },
            { key: "deletePayroll",     label: "ลบรายการเงินเดือน",   href: "/payroll/delete", hidden: true },
        ],
    },
    {
        groupLabel: "หุ้นส่วน",
        bits: [
            { key: "partnersManagement", label: "หุ้นส่วน",       href: "/partners" },
            { key: "editPartner",        label: "แก้ไขหุ้นส่วน", href: "/partners/edit", hidden: true },
        ],
    },
    {
        groupLabel: "แพ็กเกจรวมชุด",
        bits: [
            { key: "packagesManagement", label: "แพ็กเกจรวมชุด", href: "/packages" },
            { key: "createPackage",      label: "สร้างแพ็กเกจ",   href: "/packages/create", hidden: true },
            { key: "editPackage",        label: "แก้ไขแพ็กเกจ",   href: "/packages/edit",   hidden: true },
            { key: "deletePackage",      label: "ลบแพ็กเกจ",     href: "/packages/delete", hidden: true },
        ],
    },
    {
        groupLabel: "ค่าธรรมเนียมการชำระเงิน",
        bits: [
            { key: "paymentSettings", label: "ค่าธรรมเนียมการชำระเงิน", href: "/settings/payment" },
        ],
    },
    {
        groupLabel: "จ่ายส่วนแบ่งกำไรหุ้นส่วน",
        bits: [
            { key: "partnerDistributionsManagement", label: "จ่ายส่วนแบ่งกำไรหุ้นส่วน", href: "/partners/distributions" },
            { key: "createPartnerDistribution",       label: "บันทึกจ่ายส่วนแบ่ง",   href: "/partners/distributions/create", hidden: true },
            { key: "editPartnerDistribution",         label: "แก้ไขรายการจ่ายส่วนแบ่ง", href: "/partners/distributions/edit",   hidden: true },
            { key: "deletePartnerDistribution",       label: "ลบรายการจ่ายส่วนแบ่ง",   href: "/partners/distributions/delete", hidden: true },
        ],
    },
    {
        groupLabel: "จ่ายเงินเดือนพนักงานแบบชุด",
        bits: [
            { key: "runPayroll", label: "จ่ายเงินเดือนพนักงานแบบชุด (สร้าง+จ่ายพร้อมกันหลายคน)", href: "/payroll" },
        ],
    },
    {
        groupLabel: "ข่าวสาร",
        bits: [
            { key: "newsManagement", label: "ข่าวสาร",     href: "/news" },
            { key: "createNews",     label: "สร้างข่าวสาร", href: "/news/create", hidden: true },
            { key: "editNews",       label: "แก้ไขข่าวสาร", href: "/news/edit",   hidden: true },
            { key: "deleteNews",     label: "ลบข่าวสาร",   href: "/news/delete", hidden: true },
        ],
    },
    {
        groupLabel: "แชทกับลูกค้า",
        bits: [
            { key: "chatManagement", label: "แชทกับลูกค้า", href: "/chat" },
        ],
    },
];

// Start index (in flat bitmask) for each group
export const GROUP_STARTS: number[] = (() => {
    const starts: number[] = [];
    let offset = 0;
    for (const g of PERMISSION_GROUPS) {
        starts.push(offset);
        offset += g.bits.length;
    }
    return starts;
})();

export const TOTAL_BITS = PERMISSION_GROUPS.reduce((sum, g) => sum + g.bits.length, 0);

// ─── Sidebar helpers ──────────────────────────────────────────────────────────
export function getLeaves(items: MenuItem[]): MenuItem[] {
    return items.flatMap((item) => (item.children?.length ? item.children : [item]));
}

// ลำดับที่ "แสดงผล" ในเมนูจริง — แยกจากลำดับใน MENU_DEFS โดยตั้งใจ เพราะลำดับใน MENU_DEFS
// ผูกกับตำแหน่งบิตของ role_permission ที่บันทึกไว้ใน DB แล้ว (ห้ามสลับ/แทรกกลาง มีแต่ต่อท้ายได้)
// แต่ลำดับที่โชว์บน sidebar ปรับได้อิสระโดยไม่กระทบสิทธิ์เดิมเลย เพราะแค่จัดเรียง key ที่แสดงผล
// ตั้งค่าระบบอยู่ล่างสุดเสมอตามที่ต้องการ — เพิ่มเมนูใหม่ในอนาคตให้ใส่ key ไว้ก่อน "settings" เสมอ
export const MENU_DISPLAY_ORDER = ["dashboard", "usersManagement", "customersManagement", "products", "packagesManagement", "categories", "couponsManagement", "newsManagement", "chatManagement", "expensesManagement", "payrollManagement", "partnersManagement", "partnerDistributionsManagement", "reportsManagement", "paymentSettings", "settings"];

export function getVisibleItems(items: MenuItem[], bitmask: string): MenuItem[] {
    const leaves = getLeaves(items);
    const visibleHrefs = new Set(
        leaves.filter((_, i) => bitmask[i] === "1").map((l) => l.href)
    );

    const itemsByKey = new Map(items.map((item) => [item.key, item]));
    const displayOrderedItems = MENU_DISPLAY_ORDER
        .map((key) => itemsByKey.get(key))
        .filter((item): item is MenuItem => !!item);

    return displayOrderedItems
        .filter((item) => !item.hidden)
        .flatMap((item) => {
            if (item.children?.length) {
                const visibleChildren = item.children.filter(
                    (c) => !c.hidden && visibleHrefs.has(c.href)
                );
                // children ทั้งหมด hidden → แสดง parent เป็น single link
                if (visibleChildren.length === 0) {
                    return visibleHrefs.has(item.href) ? [{ ...item, children: undefined }] : [];
                }
                return [{ ...item, children: visibleChildren }];
            }
            return visibleHrefs.has(item.href) ? [item] : [];
        });
}
