# TleClinic POS

ระบบขายหน้าร้านและจัดการคลินิกสัตวแพทย์ พัฒนาด้วย Next.js และ Oracle Database เป็นโครงงานระดับปริญญาตรี โดยมุ่งช่วยจัดการงานขาย สินค้าคงคลัง ลูกค้า และสัตว์เลี้ยงไว้ในระบบเดียว

## วัตถุประสงค์

- จัดการการขายสินค้าและบริการของคลินิกสัตวแพทย์
- ติดตามสินค้าคงคลังแยกตามล็อต วันหมดอายุ และหน่วยนับ
- เชื่อมโยงข้อมูลลูกค้า สัตว์เลี้ยง และรายการขาย
- จัดการการสั่งซื้อและตรวจรับสินค้า
- สรุปยอดขายและแจ้งเตือนรายการที่ควรติดตาม

## ความสามารถหลัก

- หน้าขายหน้าร้าน รองรับการค้นหาสินค้าและบาร์โค้ด
- จัดการลูกค้า สัตว์เลี้ยง สินค้า ผู้จัดจำหน่าย และพนักงาน
- จัดการสต็อกแยกตามล็อต วันหมดอายุ และประวัติการเคลื่อนไหว
- กำหนดหน่วยนับและอัตราแปลงของสินค้า
- สร้างใบสั่งซื้อและบันทึกการตรวจรับสินค้า
- ดู dashboard และรายงานยอดขาย
- จัดเก็บรูปโปรไฟล์ลูกค้า สัตว์เลี้ยง และพนักงานใน Oracle Database
- แจ้งเตือนสต็อกต่ำ ล็อตใกล้หมดอายุ/หมดอายุ และใบสั่งซื้อที่ค้างรับ
- เข้าสู่ระบบด้วยบัญชีพนักงาน และตั้งค่าบัญชีผู้ดูแลระบบครั้งแรก

## เทคโนโลยี

- Next.js 16 App Router
- React
- Oracle Database 19c หรือใหม่กว่า
- `node-oracledb` Thin mode
- Sharp สำหรับประมวลผลรูปภาพ
- JavaScript และ CSS

## ความต้องการก่อนติดตั้ง

- Node.js เวอร์ชัน 20.9 ขึ้นไป
- npm
- Oracle Database 19c ขึ้นไป พร้อม schema/user สำหรับแอป

## การติดตั้งและเริ่มใช้งาน

1. ติดตั้ง dependencies:

   ```bash
   npm install
   ```

2. สร้างไฟล์ environment จากตัวอย่าง

   macOS/Linux:
   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell:
   ```powershell
   Copy-Item .env.example .env.local
   ```

3. แก้ `.env.local` ให้ตรงกับ Oracle Database ของตนเอง:

   ```dotenv
   DB_HOST=localhost
   DB_PORT=1521
   DB_SERVICE_NAME=FREEPDB1
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_CONNECT_STRING=localhost:1521/FREEPDB1
   DB_POOL_MIN=1
   DB_POOL_MAX=5
   ```

   สามารถใช้ `ORACLE_USER`, `ORACLE_PASSWORD` และ `ORACLE_CONNECT_STRING` แทนตัวแปร `DB_*` ได้ ห้าม commit `.env.local` หรือส่ง secret ขึ้น Git

4. เตรียม schema และ migration:

   ```bash
   npm run db:setup
   ```

   คำสั่งนี้สร้าง schema หากยังไม่มี ใช้ migration ที่ยังไม่ได้ apply และเตรียม role กับค่าเริ่มต้นของระบบ ฐานข้อมูล Oracle ต้องพร้อมใช้งานก่อนรัน

5. เริ่มเซิร์ฟเวอร์สำหรับพัฒนา:

   ```bash
   npm run dev
   ```

6. เปิด `http://localhost:3000/login` ตั้งค่าบัญชีผู้ดูแลระบบเมื่อเข้าใช้ครั้งแรก จากนั้นเข้าสู่ระบบด้วยบัญชีที่สร้างไว้ เก็บ recovery code ไว้ในที่ปลอดภัย

## ข้อมูลสาธิต

เพิ่มข้อมูลสาธิตลงใน Oracle schema ที่กำหนดไว้ด้วยคำสั่ง:

```bash
npm run db:seed:demo
```

สคริปต์ seed ออกแบบให้รันซ้ำได้และสร้างข้อมูลตัวอย่าง เช่น ลูกค้า สัตว์เลี้ยง สินค้า ล็อตสินค้า ใบสั่งซื้อ และรายการขาย ควรใช้กับฐานข้อมูลสำหรับพัฒนา/สาธิตเท่านั้น ไม่ควรรันกับฐานข้อมูล production

## คำสั่งที่ใช้บ่อย

| คำสั่ง | รายละเอียด |
| --- | --- |
| `npm run dev` | เริ่ม development server |
| `npm run build` | สร้าง production build |
| `npm start` | เริ่ม production server หลัง build |
| `npm run db:setup` | สร้าง schema และ apply migration ที่ค้างอยู่ |
| `npm run db:seed:demo` | เพิ่มข้อมูลสาธิตลง Oracle |

## โครงสร้างโปรเจกต์

```text
app/                  หน้าเว็บและ API routes ของ Next.js
src/                  UI, styles และ Oracle repositories
src/server/           การเชื่อมต่อฐานข้อมูลและ business logic
database/schema.sql   โครงสร้างตารางเริ่มต้น
database/migrations/  การเปลี่ยนแปลง schema ตามลำดับ
database/seed.sql     role และค่าเริ่มต้นของระบบ
database/seed-demo.js ข้อมูลสาธิต
```

## การตั้งค่าฐานข้อมูล

รายละเอียดการเตรียม Oracle และ data model ดูเพิ่มเติมได้ที่ [database/README.md](database/README.md)

## ข้อจำกัดและความปลอดภัย

โครงการนี้จัดทำเพื่อการเรียนและการสาธิต การตรวจ session ช่วยป้องกันหน้าที่ต้องเข้าสู่ระบบใน production แต่การกำหนดสิทธิ์ตาม role สำหรับ API ยังไม่ครอบคลุมทุก endpoint จึงควรตรวจสอบและเพิ่ม authorization ให้ครบก่อนนำไปเปิดใช้งานบนเครือข่ายสาธารณะ

ห้ามใช้ข้อมูลลูกค้าหรือข้อมูลสุขภาพสัตว์จริงในการสาธิต และห้ามเผยแพร่ไฟล์ `.env.local`, รหัสผ่าน, PIN หรือ recovery code
