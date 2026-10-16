# localgame

نظام ألعاب جماعية عبر الويب، قائم على Node.js + Socket.IO، مع غرف للألعاب، QR code، انضمام هواتف، وتكامل قابل للتوسع مع محاكي WASM/Libretro.

## متطلبات التشغيل

- Node.js 18+
- npm

## تثبيت الاعتماديات

```bash
npm install
```

## متغيرات البيئة

أنشئ ملف `.env` أو اضبط المتغيرات في بيئة التشغيل:

```bash
PORT=3000
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:3000
PLAYER_GRACE_PERIOD_MS=120000
```

## التشغيل محلياً

```bash
npm run dev
```

أو:

```bash
npm start
```

## التشغيل على Render

يعمل المشروع كخدمة Node.js. استخدم إعدادات Render التالية:

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - `NODE_ENV=production`
  - `PUBLIC_BASE_URL=https://your-app.onrender.com`

يُرجى ملاحظة أن Render يتعيّن عليه تعيين `PUBLIC_BASE_URL` بشكل صحيح لأن الخادم يولد QR links ويستخدمها في واجهة الانضمام.

## ملاحظات مهمة

- لا ترفق ROMs أو نوى PS1/ NES/ SNES في المستودع العام إذا كانت محمية بحقوق النشر.
- هذا المشروع مصمم ليعمل بحيث تكون الألعاب مفعلة فقط عند توفر ملفات اللعبة والنواة الفعلية.
- إذا كانت اللعبة غير موجودة، تُعرض رسالة واضحة بدلًا من تعطل الصفحة أو تحميل محاكي غير موجود.
- جميع المكونات الأساسية في المشروع جاهزة للنشر، مع شاشة المضيف، شاشة الهاتف، ووضع الغرف.

## بنية المشروع

```text
airplay-web/
├── package.json
├── server/
│   └── index.js
├── public/
│   ├── host.html
│   ├── controller.html
│   ├── emu/ (اختياري إذا أردت مجلد منفصل)
│   ├── emulator/
│   │   └── index.html
│   ├── games/
│   │   └── manifest.json
│   └── js/
│       ├── host.js
│       ├── controller.js
│       └── input-adapter.js
└── README.md
```
