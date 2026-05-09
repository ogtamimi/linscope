# VirusTotal Integration Guide

## 📋 نظرة عامة

تم دمج ميزة **VirusTotal Intelligence** في Linscope لتوفير فحص IOC (Indicators of Compromise) فوري ذكي مع احترام كامل لحدود API المجانية.

### الميزات الرئيسية:
- ✅ فحص IP addresses, domains, SHA-256 hashes تلقائياً
- ✅ تخزين مؤقت ذكي (24 ساعة) لتوفير الطلبات
- ✅ تحديد أولويات ذكي: يفحص فقط العناصر المهمة
- ✅ احترام كامل لحدود API:
  - 4 طلبات في الدقيقة
  - 500 طلب في اليوم
  - 15,500 طلب في الشهر
- ✅ واجهة مستخدم سلسة مع عرض فوري للنتائج

---

## 🚀 البدء السريع

### 1️⃣ الحصول على مفتاح API

1. اذهب إلى [VirusTotal.com](https://www.virustotal.com/)
2. أنشئ حساباً مجاناً أو سجل الدخول
3. اذهب إلى [My API Key](https://www.virustotal.com/gui/my-apikey)
4. انسخ مفتاح API الخاص بك

### 2️⃣ تكوين Backend

#### الطريقة 1: متغيرات البيئة

```bash
# في الجذر الرئيسي للمشروع
cp .env.example .env
```

أضف إلى ملف `.env`:
```bash
VIRUSTOTAL_API_KEY=your_api_key_here
```

#### الطريقة 2: تصدير المتغير

```bash
export VIRUSTOTAL_API_KEY="your_api_key_here"
python -m uvicorn backend.main:app --reload
```

### 3️⃣ تكوين Frontend

1. افتح صفحة **Settings** (⚙️) في واجهة Linscope
2. انتقل إلى تبويب **Intelligence API**
3. أدخل مفتاح VirusTotal API الخاص بك
4. فعّل **Auto-Scan IOC** و **Smart Filter**
5. انقر **Save**

---

## 🔍 كيفية الاستخدام

### في صفحة التنبيهات (Alerts)

عندما تظهر تنبيهات جديدة تحتوي على عناوين IP أو نطاقات أو hashes:

1. **عرض الأيقونة** 🛡️: بجانب كل تنبيه يحتوي على IOC
2. **النقر على الأيقونة**: لتشغيل فحص VirusTotal
3. **عرض النتائج**: في منبثق صغير يحتوي على:
   - عدد المحركات التي أبلغت عن تهديد
   - الحالة (آمن/خطير/مريب)
   - رابط التقرير الكامل على VirusTotal

### الحالات التلقائية

مع تفعيل **Auto-Scan IOC**:
- يتم فحص العناصر الجديدة تلقائياً عند ظهور التنبيهات
- تُحفظ النتائج محلياً لمدة 24 ساعة
- يتم تخزين النتائج أيضاً في Backend SQLite

---

## 🧠 خوارزمية الفلترة الذكية

النظام **لا يفحص تلقائياً**:

### 1. العناوين الخاصة (RFC1918)
```
10.0.0.0/8       (10.0.0.0 - 10.255.255.255)
172.16.0.0/12    (172.16.0.0 - 172.31.255.255)
192.168.0.0/16   (192.168.0.0 - 192.168.255.255)
127.0.0.0/8      (127.0.0.0 - 127.255.255.255) - Loopback
169.254.0.0/16   (169.254.0.0 - 169.254.255.255) - Link-local
```

### 2. النطاقات الداخلية
```
*.local
*.internal
localhost
127.0.0.1
::1
```

### 3. التخزين المؤقت (24 ساعة)
- إذا تم فحص نفس العنصر في آخر 24 ساعة، لا يتم الاستعلام مجدداً
- يتم إرجاع النتيجة المحفوظة مباشرة

### 4. معايير الأولوية
| المعيار | النقاط |
|--------|--------|
| **Severity** | |
| Critical | +40 |
| High | +30 |
| Medium | +20 |
| Low | +10 |
| **Alert Count** | |
| ظهور > 5 مرات | +30 |
| ظهور > 2 مرات | +20 |
| مرة واحدة | +10 |
| **Type** | |
| File Hash | +25 |
| IP Address | +15 |
| Domain | +10 |

**النقاط الأعلى = الفحص أولاً**

---

## 📊 مراقبة الحدود

### في Settings → Intelligence API

يمكنك رؤية:
- **Daily**: عدد الطلبات المتبقية اليوم (من 500)
- **Monthly**: عدد الطلبات المتبقية الشهر (من 15,500)

```
Daily:   450 / 500  [████████████░░░░░░]
Monthly: 14,200 / 15,500  [████████████████░░]
```

---

## 🔌 API Endpoints

### 1. فحص IOC واحد

**POST** `/api/check-ioc`

```json
Request:
{
  "type": "ip|domain|hash",
  "value": "8.8.8.8"
}

Response (Success):
{
  "cached": false,
  "skipped": false,
  "result": {
    "malicious": 0,
    "suspicious": 2,
    "untrusted": 1,
    "total": 89,
    "last_analysis": "2024-05-09T15:30:00",
    "link": "https://www.virustotal.com/gui/ip_address/8.8.8.8"
  }
}

Response (Cached):
{
  "cached": true,
  "result": { ... }
}

Response (Skipped - Private IP):
{
  "cached": false,
  "skipped": true,
  "reason": "Private IP address: 192.168.1.1",
  "result": { "malicious": 0, "status": "filtered" }
}

Response (Quota Exceeded):
{
  "cached": false,
  "skipped": true,
  "reason": "Daily quota exceeded (500)",
  "result": { "status": "quota_exceeded" }
}
```

### 2. فحص عدة IOCs مع الأولويات

**POST** `/api/batch-check-ioc`

```json
Request:
{
  "iocs": [
    { "type": "ip", "value": "8.8.8.8" },
    { "type": "domain", "value": "example.com" },
    { "type": "hash", "value": "abc123..." }
  ]
}

Response:
{
  "total": 3,
  "processed": 2,
  "skipped_or_cached": 1,
  "results": [
    {
      "type": "ip",
      "value": "8.8.8.8",
      "skipped": false,
      "result": { ... }
    },
    {
      "type": "domain",
      "value": "example.com",
      "skipped": true,
      "reason": "cached",
      "result": { ... }
    }
  ]
}
```

### 3. الحصول على الإحصائيات

**GET** `/api/virustotal/stats`

```json
Response:
{
  "daily_used": 45,
  "daily_limit": 500,
  "monthly_used": 1250,
  "monthly_limit": 15500,
  "remaining_daily": 455,
  "remaining_monthly": 14250
}
```

---

## 💾 تخزين البيانات

### Backend (SQLite)

الجدول: `virustotal_cache`

```sql
CREATE TABLE virustotal_cache (
  ioc_type TEXT NOT NULL,      -- 'ip', 'domain', 'hash'
  ioc_value TEXT NOT NULL,
  response_json TEXT NOT NULL, -- JSON response من VirusTotal
  created_at REAL NOT NULL,    -- Unix timestamp
  expires_at REAL NOT NULL,    -- Unix timestamp (created_at + 24h)
  PRIMARY KEY (ioc_type, ioc_value)
);
```

**الاحتفاظ**: 24 ساعة

### Frontend (LocalStorage)

مفتاح: `linscope_vt_cache`

```json
{
  "ip:8.8.8.8": {
    "timestamp": 1715250600000,
    "result": { "malicious": 0, ... }
  },
  "domain:example.com": {
    "timestamp": 1715250600000,
    "result": { ... }
  }
}
```

**الاحتفاظ**: 24 ساعة (يتم التحقق عند كل استعلام)

---

## ⚙️ التكوينات المتقدمة

### تفعيل/تعطيل الفحص التلقائي

في **Settings** → **Intelligence API**:

- **Auto-Scan IOC**: فعّل لفحص العناصر الجديدة تلقائياً
- **Smart Filter**: فعّل لتخطي العناوين الخاصة والنطاقات الداخلية

### تحديد عدد الطلبات اليدوي

للقيود الصارمة، عدّل في `backend/virustotal.py`:

```python
RATE_LIMIT_PER_MINUTE = 4      # الحد الأقصى: 4 طلبات
DAILY_LIMIT = 500              # الحد اليومي
MONTHLY_LIMIT = 15500          # الحد الشهري
CACHE_DURATION_HOURS = 24      # مدة التخزين المؤقت
```

---

## 🐛 استكشاف الأخطاء

### خطأ: "VirusTotal API key not configured"

**الحل**: 
1. تأكد من إدخال المفتاح في Settings
2. تحقق من المتغير `VIRUSTOTAL_API_KEY` في Backend
3. أعد تشغيل Backend

### خطأ: "Rate limit exceeded"

**الحل**:
- انتظر 60 ثانية قبل المحاولة مجدداً
- قلل عدد العناصر المفحوصة
- تحقق من الإحصائيات اليومية في Settings

### خطأ: "Daily quota exceeded"

**الحل**:
- الحد اليومي 500 طلب
- سيتم إعادة تعيينه في منتصف الليل UTC
- استخدم Smart Filter لتقليل الفحوصات غير الضرورية

### البيانات لا تظهر

**الحل**:
1. افتح Developer Console (F12)
2. تحقق من Network tab لـ `/api/check-ioc`
3. تأكد من عدم ظهور أخطاء 4xx/5xx
4. تحقق من أن Alert يحتوي على `iocs` field

---

## 📈 أمثلة الاستخدام

### مثال 1: فحص IP من تنبيه

```
Alert: "Suspicious outbound connection"
  → IOC: IP 45.61.190.12
  → النقر على 🛡️
  → النتيجة: 12 محركات أبلغت عن تهديد
  → الرابط: https://www.virustotal.com/gui/ip_address/45.61.190.12
```

### مثال 2: فحص تلقائي للـ Domain

```
Alert: "DNS query to malicious domain"
  → IOC: Domain suspicious.com
  → (Auto-scan مفعّل)
  → النتيجة تظهر تلقائياً بعد 1-2 ثانية
```

### مثال 3: تخطي الفحص (Private IP)

```
Alert: "Internal network activity"
  → IOC: IP 192.168.1.100
  → (Smart Filter مفعّل)
  → يتم التخطي: "Private IP address"
  → لا يتم استهلاك حصة API
```

---

## 📝 الملفات المعدّلة

| الملف | التعديلات |
|------|----------|
| `backend/virustotal.py` | ملف جديد - جميع الوظائف الأساسية |
| `backend/main.py` | إضافة import للـ VirusTotal router |
| `frontend/src/components/AlertsPanel.tsx` | عرض أيقونات + منبثقات VirusTotal |
| `frontend/src/components/SettingsPanel.tsx` | تبويب Intelligence API جديد |
| `frontend/src/hooks/useVirusTotal.ts` | React hook لإدارة الطلبات |
| `frontend/src/types.ts` | إضافة `iocs` field إلى Alert interface |

---

## 🔐 الأمان

- **المفاتيح**: تُحفظ محلياً في localStorage (بيئة محلية آمنة)
- **النقل**: HTTPS فقط (تلقائي عند استخدام `wss://`)
- **التخزين المؤقت**: محلي في المتصفح + Backend SQLite
- **الخصوصية**: لا يتم إرسال بيانات حساسة إلى VirusTotal

---

## 📞 الدعم

للمزيد من المعلومات:
- [VirusTotal API Docs](https://developers.virustotal.com/reference)
- [Linscope GitHub Issues](https://github.com/ogtamimi/linscope/issues)

---

**آخر تحديث**: 9 مايو 2026
