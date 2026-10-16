# airplay-web (prototype)

تشغيل محلي للاختبار:

1. انسخ بنية المجلد كما في المستند:
   - package.json
   - server/index.js
   - public/host.html
   - public/controller.html
   - public/emulator/index.html
   - public/js/host.js
   - public/js/controller.js
   - public/js/input-adapter.js

2. ثبّت الاعتماديات:
   ```bash
   npm install
   ```

3. عين PUBLIC_BASE_URL (مهم للـ QR):
   - إذا تختبر محلياً على نفس الجهاز (فتح الهاتف أيضاً عبر نفس الجهاز): 
     export PUBLIC_BASE_URL=http://localhost:3000
   - إذا تريد اختبار مع هاتف على الشبكة المحلية، استخدم عنوان الـ LAN لمضيفك، مثال:
     export PUBLIC_BASE_URL=http://192.168.1.5:3000
   - على Windows PowerShell:
     $env:PUBLIC_BASE_URL = "http://192.168.1.5:3000"

4. شغّل الخادم:
   ```bash
   npm run dev
   ```
   أو:
   ```bash
   npm start
   ```

5. افتح واجهة المضيف في المتصفح:
   http://localhost:3000/host.html
   - اضغط زر الإنشاء (تُنشأ الغرفة تلقائياً عند اتصال المضيف).
   - سترى رمز الغرفة ورمز QR (إذا ضبطت PUBLIC_BASE_URL صحيح).

6. افتح وحدة التحكم:
   - على نفس الجهاز: http://localhost:3000/controller.html?room=XXXX (استبدل XXXX برمز الغرفة)
   - أو امسح رمز QR بهاتفك (تأكد أن الهاتف يستطيع الوصول إلى PUBLIC_BASE_URL).

اختبار إعادة الاتصال:
- انضم كلاعب، ثم أغلق تبويب وحدة التحكم أو افصل الشبكة مؤقتاً.
- أعد فتح controller.html بنفس الـ room — سيحاول استرجاع التوكن من localStorage وإعادة الربط تلقائياً (ضمن فترة الـ TTL الافتراضية 2 دقيقة).
