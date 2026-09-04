# fasttiw brand kit

## สเปกที่ล็อกไว้
- สัญลักษณ์: วงฝนคำตอบเปิดช่องด้านหลัง 50° แกนในลอยอิสระ มีขีดความเร็วนำหน้า
- ตัวอักษร: Poppins SemiBold (600) ดัดเอง — เชื่อมคานขวาง tt, ขยายช่องในตัว a 14%, จุดบน i เป็นวงกลมสีส้ม
- สี: น้ำเงิน #2B5CE6 ทั้งสัญลักษณ์และตัวอักษร · ส้ม #FF9F1C เฉพาะแกนใน ขีดความเร็ว และจุดบน i
- ตัวอักษรทั้งหมดแปลงเป็นเส้นเวกเตอร์แล้ว ไม่ต้องติดตั้งฟอนต์

## ไฟล์
logo/
  fasttiw-logo.svg / .png     โลโก้หลัก ใช้บนพื้นสว่าง
  fasttiw-logo-dark.svg/.png  พื้นเข้ม / dark mode ตัวอักษรขาว
  fasttiw-logo-vertical.svg/.png       แนวตั้ง สัญลักษณ์อยู่บน ชื่ออยู่ล่าง
  fasttiw-logo-vertical-dark.svg/.png  แนวตั้ง สำหรับพื้นเข้ม
  fasttiw-logo-mono.svg       น้ำเงินล้วน สำหรับงานพิมพ์สีเดียว
  fasttiw-mark.svg / .png     เฉพาะสัญลักษณ์ ใช้เป็นรูปโปรไฟล์
favicon/
  favicon.svg                 พื้นใส ตัวหลักของเว็บ
  favicon.ico                 16/32/48 รวมไฟล์เดียว สำหรับเบราว์เซอร์เก่า
  favicon-16/32/48.png
  apple-touch-icon.png        180px พื้นขาว (iOS บังคับพื้นทึบ ถ้าส่งพื้นใสจะกลายเป็นดำ)
  icon-192.png / icon-512.png Android / PWA
  icon-512-maskable.png       เผื่อขอบให้ Android ครอปเป็นวงกลมได้

## ใส่ในเว็บ
วางไฟล์ในโฟลเดอร์ /public แล้วเพิ่มใน <head>:

<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

site.webmanifest:
{
  "name": "fasttiw",
  "short_name": "fasttiw",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "#2B5CE6",
  "background_color": "#FFFFFF",
  "display": "standalone"
}

## ข้อควรระวัง
- เว้นระยะรอบโลโก้อย่างน้อยเท่ากับความสูงของวงกลมในสัญลักษณ์
- อย่ายืดสัดส่วน อย่าเปลี่ยนสี อย่าใส่เงา
- ขนาดเล็กสุดของโลโก้แนวนอน: กว้าง 120px · แนวตั้ง: กว้าง 90px
- ใช้แนวนอนเป็นตัวหลัก (navbar, หัวเอกสาร, ลายเซ็นอีเมล) ใช้แนวตั้งเมื่อพื้นที่เป็นทรงจัตุรัสหรือแนวตั้ง เช่น รูปโปรไฟล์เพจ ป้าย โปสเตอร์ สติกเกอร์
- ตัวอักษรเป็นน้ำเงินแล้ว เวลาวางบนพื้นสีอ่อนที่ไม่ใช่ขาว ให้เช็กคอนทราสต์ก่อน ถ้าอ่านยากใช้ fasttiw-logo-dark แทน
- favicon เป็นพื้นใสสีน้ำเงินคงที่ บนแท็บโหมดมืดวงจะดูจมลงไปบ้าง ถ้าจะแก้ทีหลัง เพิ่ม CSS นี้ใน favicon.svg:
  <style>@media (prefers-color-scheme:dark){.ring{stroke:#7BA3FF}}</style>
