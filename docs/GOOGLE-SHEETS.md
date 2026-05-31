# Google Таблица — участники облака VoiceBudget

Когда пользователь **создаёт** семейный бюджет или **присоединяется по коду**, в таблицу добавляется строка: дата, имя, ник Telegram, id, действие.

Повторное «Создать» / «Присоединиться» с тем же аккаунтом (например, браузер после телефона) **не дублирует** строку.

---

## Заголовки листа «VoiceBudget»

```
дата | действие | имя | фамилия | telegram | telegram_user_id | режим | участников | код | id семьи | сайт
```

Лист создаётся скриптом автоматически.

---

## Apps Script

1. Создайте [Google Таблицу](https://sheets.google.com) или откройте существующую.
2. **Расширения → Apps Script** (скрипт привязан к этой таблице).
3. Вставьте код:

```javascript
function getOrCreateVoiceBudgetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("VoiceBudget");
  if (!sheet) {
    sheet = ss.insertSheet("VoiceBudget");
    sheet.appendRow([
      "дата",
      "действие",
      "имя",
      "фамилия",
      "telegram",
      "telegram_user_id",
      "режим",
      "участников",
      "код",
      "id семьи",
      "сайт",
    ]);
  }
  return sheet;
}

function appendVoiceBudgetMember(data) {
  const sheet = getOrCreateVoiceBudgetSheet();
  sheet.appendRow([
    data.createdAt || "",
    data.actionLabel || data.action || "",
    data.firstName || "",
    data.lastName || "",
    data.telegram || "",
    data.telegramUserId || "",
    data.mode || "",
    data.memberCount || "",
    data.inviteCode || "",
    data.householdId || "",
    data.siteUrl || "",
  ]);
  SpreadsheetApp.flush();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.type === "voicebudget_member") {
      appendVoiceBudgetMember(data);
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unknown type" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function testVoiceBudgetMember() {
  appendVoiceBudgetMember({
    createdAt: new Date().toISOString(),
    actionLabel: "Тест",
    firstName: "Иван",
    lastName: "Иванов",
    telegram: "@test_user",
    telegramUserId: 123456789,
    mode: "Вдвоём",
    memberCount: 2,
    inviteCode: "ABC123",
    householdId: "test-household-id",
    siteUrl: "https://voicebudget.vercel.app",
  });
}
```

4. **Сохранить** → **Развернуть** → **Веб-приложение** → доступ **Все** → скопировать URL, оканчивающийся на `/exec`.

5. В Apps Script выберите `testVoiceBudgetMember` → ▶ — на листе **VoiceBudget** должна появиться тестовая строка.

### Одна таблица с колесом / диагностикой

Если уже есть `doPost` с `type === "wheel"`, добавьте ветку:

```javascript
if (data.type === "voicebudget_member") {
  appendVoiceBudgetMember(data);
} else if (data.type === "wheel") {
  // ...
}
```

---

## Vercel

| Переменная | Значение |
|------------|----------|
| `GOOGLE_SHEETS_WEBHOOK_URL` | URL веб-приложения `/exec` |
| `NEXT_PUBLIC_SITE_URL` | `https://voicebudget.vercel.app` (опционально, для колонки «сайт») |

После добавления — **Redeploy**.

Локально: `voicebudget/.env.local`:

```env
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
```

---

## Проверка из терминала

```bash
curl -sS -L -X POST "https://script.google.com/macros/s/ВАШ_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{"type":"voicebudget_member","createdAt":"2026-05-28T12:00:00.000Z","actionLabel":"Тест curl","firstName":"Маша","lastName":"","telegram":"@masha","telegramUserId":987654321,"mode":"Вдвоём","memberCount":2,"inviteCode":"XYZ789","householdId":"id-test","siteUrl":"https://voicebudget.vercel.app"}'
```

---

## Когда пишется строка

| Событие | Колонка «действие» |
|---------|-------------------|
| Первое открытие Mini App (новый Telegram-аккаунт в базе) | Открыл приложение |
| Первое создание облачного бюджета | Создал семью |
| Второй человек ввёл код приглашения | Присоединился |

Подключение браузера к уже существующей семье **не** создаёт новую строку.
