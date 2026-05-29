import type { Locale } from "@/types";

export type FaqSection = {
  id: string;
  title: Record<Locale, string>;
  /** Paragraphs; lines starting with "• " render as list items */
  body: Record<Locale, string[]>;
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "start",
    title: { ru: "С чего начать", en: "Getting started" },
    body: {
      ru: [
        "Откройте бота @VoiceBudgetBot → «Открыть Mini App».",
        "Запишите трату: микрофон в приложении или голосовое/текст боту.",
        "Вход только через Telegram — пароль не нужен.",
      ],
      en: [
        "Open @VoiceBudgetBot → «Open Mini App».",
        "Log an expense: mic in the app or a voice/text message to the bot.",
        "Sign-in is via Telegram only — no password.",
      ],
    },
  },
  {
    id: "commands",
    title: { ru: "Команды бота", en: "Bot commands" },
    body: {
      ru: [
        "/start и /help — краткая справка и кнопка приложения.",
        "Других команд нет. Любой текст без / — запись операции (как голосовое).",
        "Примеры: потратил 500 на обед · зарплата 80000 · отложил 5000 на отпуск",
      ],
      en: [
        "/start and /help — short guide and app button.",
        "No other commands. Any text without / logs a transaction (like voice).",
        "Examples: spent 500 on lunch · salary 80000 · saved 5000 for vacation",
      ],
    },
  },
  {
    id: "record",
    title: { ru: "Как записывать", en: "How to log" },
    body: {
      ru: [
        "В приложении: красная кнопка микрофона или текст + «Добавить».",
        "В боте: голосовое или текст — синхронизация с приложением при включённом облаке.",
        "Список операций: редактирование и удаление на главном экране.",
        "Если микрофон в Telegram капризничает — голосовое боту или откройте в Chrome (ссылка в подсказке под микрофоном).",
      ],
      en: [
        "In the app: red mic button or text + «Add».",
        "In the bot: voice or text — syncs with the app when cloud is on.",
        "Transaction list: edit or delete on the home screen.",
        "If the mic misbehaves in Telegram — voice to the bot or open in Chrome (link under the mic).",
      ],
    },
  },
  {
    id: "phrases",
    title: { ru: "Примеры фраз", en: "Phrase examples" },
    body: {
      ru: [
        "Расход: 500 кофе · потратил 1500 в пятёрочке",
        "Доход: зарплата 80000 · получил 5000 фриланс",
        "Копилка: отложил 5000 на отпуск · закинул 2000 в подушку",
        "Доход + копилка: зарплата 100000, 20000 на отпуск",
        "Партнёр: Маша 800 продукты (имя как в настройках)",
        "Поддерживаются «1,5 млн», «сто тысяч». В фразе нужна цифра.",
        "Категория — по словам (пятёрочка → Продукты). Свои слова — Настройки → Категории.",
      ],
      en: [
        "Expense: 500 coffee · spent 1500 at the store",
        "Income: salary 80000 · received 5000 freelance",
        "Jar: saved 5000 for vacation",
        "Income + jar: salary 100000, 20000 for vacation",
        "Partner: Alex 800 groceries (name as in settings)",
        "Supports «1.5m», «100k». A number is required.",
        "Category from keywords (store → Groceries). Custom words — Settings → Categories.",
      ],
    },
  },
  {
    id: "partner",
    title: { ru: "Партнёр и семья", en: "Partner & household" },
    body: {
      ru: [
        "Без облака: укажите имя партнёра в настройках — метки «Я» / партнёр.",
        "Облако «Веду один» — бэкап на сервере, один Telegram.",
        "«Вдвоём» — код из 6 символов, второй: Настройки → Присоединиться.",
        "Фильтры Общий / Я / Партнёр — на главном экране.",
      ],
      en: [
        "Without cloud: set partner name in settings — «Me» / partner labels.",
        "Cloud «Solo» — server backup, one Telegram account.",
        "«Shared» — 6-character code; partner: Settings → Join.",
        "All / Me / Partner filters — on the home screen.",
      ],
    },
  },
  {
    id: "cloud",
    title: { ru: "Облако и синхронизация", en: "Cloud & sync" },
    body: {
      ru: [
        "Без облака данные только на этом устройстве.",
        "С облаком новые операции уходят автоматически.",
        "Синхронизировать · Скачать с облака · Отправить на облако — в блоке «Облако и семья».",
        "Браузер: Войти через Telegram → Подключить этот браузер → Скачать с облака.",
        "Партнёр не видит траты — не присоединился по коду или открывает не из Telegram.",
      ],
      en: [
        "Without cloud, data stays on this device only.",
        "With cloud, new entries sync automatically.",
        "Sync · Download from cloud · Upload to cloud — in «Cloud & family».",
        "Browser: Log in via Telegram → Attach browser → Download from cloud.",
        "Partner missing expenses — not joined by code or not using Telegram.",
      ],
    },
  },
  {
    id: "subscription",
    title: { ru: "Подписка", en: "Subscription" },
    body: {
      ru: [
        "При включённой оплате: облако + голосовой бот требуют активную подписку.",
        "Локальные данные на телефоне не удаляются при паузе.",
        "Оплата в настройках (Облако) → «Я оплатил — обновить».",
        "Точная цена и срок — в приложении (обычно около 299 ₽ / 30 дн.).",
      ],
      en: [
        "When billing is on: cloud + voice bot need an active subscription.",
        "Local data on the phone is not deleted when paused.",
        "Pay in settings (Cloud) → «I paid — refresh».",
        "Exact price and period — shown in the app (often ~299 ₽ / 30 days).",
      ],
    },
  },
  {
    id: "planning",
    title: { ru: "Цели и планирование", en: "Goals & planning" },
    body: {
      ru: [
        "На главной: Копилки · Лимиты · Подушка · Регулярные платежи.",
        "День начала месяца (зарплата) — в блоке планирования.",
        "Голосом: отложил 5000 на отпуск · создать цель отпуск цель 150000",
      ],
      en: [
        "On home: Jars · Limits · Emergency fund · Recurring.",
        "Budget month start day (payday) — in the planning block.",
        "By voice: saved 5000 for vacation · create goal vacation target 150000",
      ],
    },
  },
  {
    id: "ai",
    title: { ru: "Советы и AI", en: "Tips & AI" },
    body: {
      ru: [
        "Мини-советы, разбор недели и месяца, чат по отчёту — блок «Советы и AI».",
        "AI — общие подсказки по бюджету, не налоги и не инвестиции.",
        "Если AI недоступен, операции всё равно записываются.",
      ],
      en: [
        "Mini tips, weekly/monthly analysis, report chat — «Tips & AI» block.",
        "AI gives general budgeting hints, not tax or investment advice.",
        "If AI is down, logging still works.",
      ],
    },
  },
  {
    id: "troubleshoot",
    title: { ru: "Не работает?", en: "Troubleshooting" },
    body: {
      ru: [
        "Голос: разрешите микрофон · HTTPS · голосовое боту · текст вручную.",
        "Не нашёл сумму — добавьте цифру: 500 обед.",
        "Пусто в браузере — войти через Telegram, скачать с облака.",
        "Зависло — «Сбросить кэш и перезагрузить» внизу настроек (если есть).",
        "Оплата не применилась — «Я оплатил — обновить», перезапустить Mini App.",
      ],
      en: [
        "Voice: allow mic · HTTPS · voice to bot · type manually.",
        "Amount not found — include a number: 500 lunch.",
        "Empty browser — log in via Telegram, download from cloud.",
        "Frozen — reset cache & reload in settings (if shown).",
        "Payment not applied — «I paid — refresh», restart Mini App.",
      ],
    },
  },
  {
    id: "privacy",
    title: { ru: "Данные и очистка", en: "Data & reset" },
    body: {
      ru: [
        "Локально — данные не на сервере. В облаке — привязка к Telegram ID.",
        "«Очистить данные» — только это устройство; в облаке остаётся.",
        "После очистки можно снова скачать с облака.",
      ],
      en: [
        "Local mode — no server. Cloud — tied to your Telegram ID.",
        "«Clear data» — this device only; cloud copy remains.",
        "You can download from cloud again after clearing.",
      ],
    },
  },
];

/** Compact FAQ text for AI system prompt */
export function buildFaqKnowledgeText(locale: Locale): string {
  return FAQ_SECTIONS.map((s) => {
    const title = s.title[locale];
    const lines = s.body[locale].map((l) => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
    return `## ${title}\n${lines}`;
  }).join("\n\n");
}

export function faqCheatsheet(locale: Locale): string[] {
  return locale === "ru"
    ? [
        "/start, /help — кратко в боте",
        "Голос / текст — «потратил 500 на обед»",
        "Про приложение — Настройки → Помощь → спросите ИИ",
      ]
    : [
        "/start, /help — short bot guide",
        "Voice / text — «spent 500 on lunch»",
        "App help — Settings → Help → ask AI",
      ];
}

/** HTML for Telegram /help (keep under ~3500 chars) */
export function formatBotHelpHtml(locale: Locale, botUsername = "VoiceBudgetBot"): string {
  const bot = botUsername.replace(/^@/, "");
  if (locale === "en") {
    return (
      `<b>Budget — bot help</b>\n\n` +
      `<b>Commands</b>\n` +
      `/start · /help — this message\n` +
      `Other text (no /) = log a transaction\n\n` +
      `<b>Examples</b>\n` +
      `• spent 500 on lunch\n` +
      `• salary 80000\n` +
      `• saved 5000 for vacation\n\n` +
      `<b>Voice</b> — send a voice message; or type the same.\n` +
      `Syncs with the Mini App when cloud is on.\n\n` +
      `<b>App help</b> — Mini App → Settings → Help → ask AI (unlimited)\n\n` +
      `Bot: @${bot}`
    );
  }
  return (
    `<b>Бюджет — справка бота</b>\n\n` +
    `<b>Команды</b>\n` +
    `/start · /help — это сообщение\n` +
    `Любой текст без / = запись операции\n\n` +
    `<b>Примеры</b>\n` +
    `• потратил 500 на обед\n` +
    `• зарплата 80000\n` +
    `• отложил 5000 на отпуск\n\n` +
    `<b>Голос</b> — голосовое в чат; или тот же текст.\n` +
    `Синхронизация с Mini App при включённом облаке.\n\n` +
    `<b>Справка по приложению</b> — Mini App → Настройки → Помощь → спросите ИИ (без лимита)\n\n` +
    `Бот: @${bot}`
  );
}
