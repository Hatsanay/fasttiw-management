// Plesk (Phusion Passenger) รัน Node.js app ด้วยการ require ไฟล์ "Application Startup File" ตรงๆ
// ไม่ได้เรียก `npm start` (ซึ่งปกติจะสั่ง `next start`) จึงต้องมี custom server ให้ Passenger เรียกได้เอง
// ตามแนวทางที่ Next.js เอกสารแนะนำ (node_modules/next/dist/docs/01-app/02-guides/custom-server.md)
// Passenger inject พอร์ตที่ต้อง listen มาทาง process.env.PORT ให้อัตโนมัติ
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
        console.log(`fasttiw-management ready on port ${port} (${dev ? "development" : "production"})`);
    });
});
