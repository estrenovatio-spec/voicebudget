import { getTelegramBotMention, getTelegramBotName } from "@/lib/telegram/bot-name";
import type { Locale } from "@/types";

const BOT = getTelegramBotMention();

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
        `Откройте бота ${BOT} → «Открыть Mini App».`,
        "Запишите трату: текст + «Добавить» в приложении; голосом — боту в Telegram.",
        "Вход только через Telegram — пароль не нужен.",
      ],
      en: [
        `Open ${BOT} → «Open Mini App».`,
        "Log an expense: text + «Add» in the app; voice — message the bot in Telegram.",
        "Sign-in is via Telegram only — no password.",
      ],
    },
  },
  {
    id: "commands",
    title: { ru: "Команды бота", en: "Bot commands" },
    body: {
      ru: [
        "/start — приветствие и зачем приложение.",
        "/help — шпаргалка: как записывать, копилки, облако вдвоём.",
        'Других команд нет. Любой текст без "/" — запись операции (как голосовое).',
      ],
      en: [
        "/start — welcome and what the app does for you.",
        "/help — quick guide: logging, jars, shared cloud.",
        "No other commands. Any text without / logs a transaction (like voice).",
      ],
    },
  },
  {
    id: "record",
    title: { ru: "Как записывать", en: "How to log" },
    body: {
      ru: [
        "В приложении: поле внизу + «Добавить» (только текст).",
        `Голосом — боту ${BOT}: голосовое или текст в чат (не в Mini App).`,
        "Список операций на главной — нажмите строку, чтобы изменить или удалить.",
      ],
      en: [
        "In the app: text field at the bottom + «Add» (text only).",
        "Voice — message the bot in Telegram (not in the Mini App).",
        "Transaction list on home — tap a row to edit or delete.",
      ],
    },
  },
  {
    id: "phrases",
    title: { ru: "Примеры фраз", en: "Phrase examples" },
    body: {
      ru: [
        "Расход: потратил 500 на обед · 1500 в пятёрочке",
        "Доход: зарплата 80000 · получил 5000 · своя категория — по ключевым словам (питер 20 тысяч)",
        "Партнёр: переключатель «Кто» или фраза — любимая потратила 500 · имя из настроек",
        "Копилка: отложил 5000 на отпуск · закинул 2000 в подушку · 5000 на отпуск (если копилка уже есть)",
        "Создать копилку: создать цель отпуск цель 150000",
        "Доход + копилка: зарплата 100000, 20000 на отпуск",
        "Несколько операций: 500 на обед и 200 на такси",
        "Суммы: 1,5 млн · сто тысяч. В фразе нужна цифра.",
        "Категория — по словам (пятёрочка → Продукты). Свои слова — Настройки → Категории.",
      ],
      en: [
        "Expense: spent 500 on lunch · 1500 at the store",
        "Income: salary 80000 · received 5000 · custom category — match your keywords",
        "Partner: «Who» toggle or phrase — partner spent 500 · name from settings",
        "Jar: saved 5000 for vacation · 5000 for vacation (if jar already exists)",
        "Create jar: create goal vacation target 150000",
        "Income + jar: salary 100000, 20000 for vacation",
        "Multiple: 500 lunch and 200 taxi",
        "Amounts: 1.5m · 100k. Include a number.",
        "Category from keywords. Custom — Settings → Categories.",
      ],
    },
  },
  {
    id: "balance",
    title: { ru: "Баланс и «в кармане»", en: "Balance & cash on hand" },
    body: {
      ru: [
        "В шапке главной — блок баланса. Нажмите на подпись или строку — суммы скроются (••••), ещё раз — покажутся.",
        "Нажмите на цифру (Общий / Я / партнёр) — окно «Реально в кармане»: укажите, сколько денег сейчас.",
        "Удобно, если по операциям одна сумма, а в кошельке другая — можно подогнать общий баланс или отдельно «я» и партнёра.",
      ],
      en: [
        "On the home header — balance block. Tap the label or row to hide amounts (••••), tap again to show.",
        "Tap a figure (All / Me / Partner) — «Cash on hand»: enter what you actually have now.",
        "Useful when transactions and real cash differ — adjust All, Me, or Partner separately.",
      ],
    },
  },
  {
    id: "partner",
    title: { ru: "Партнёр и семья", en: "Partner & household" },
    body: {
      ru: [
        "Без облака: имя партнёра в шапке (⚙) — метки «Я» / партнёр только на этом телефоне.",
        "В фразе: любимая потратила · милая моя 500 · имя из настроек.",
        "Облако «Веду один» — бэкап, один Telegram.",
        "«Вдвоём» — код 6 символов; второй: Настройки → Присоединиться.",
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
        "Точная цена и срок — в приложении (500 ₽ / 30 дн.).",
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
        "Главная → «Цели и планирование»: Копилки · Лимиты · Подушка · Регулярные.",
        "В копилку — нужна сумма и слово «на/в/для» + название цели, либо глагол:",
        "отложил · закинул · положил · в копилку · накопил · кинул в копилку.",
        "Примеры: отложил 5000 на отпуск · 5000 на отпуск (копилка «Отпуск» уже есть).",
        "Доход сразу в копилку: зарплата 100000, 20000 на отпуск.",
        "Новая цель: создать цель машина цель 500000.",
      ],
      en: [
        "Home → «Goals & planning»: Jars · Limits · Emergency · Recurring.",
        "To a jar — amount + for/to + goal name, or a verb: saved · deposited · put aside.",
        "Examples: saved 5000 for vacation · 5000 for vacation (jar exists).",
        "Income split: salary 100000, 20000 for vacation.",
        "New goal: create goal car target 500000.",
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
        "Не нашёл сумму — добавьте цифру: 500 обед.",
        "Пусто в браузере — войти через Telegram, скачать с облака.",
        "Зависло — «Сбросить кэш и перезагрузить» в настройках (если есть).",
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

const FAQ_KEYWORDS: Record<string, RegExp> = {
  start: /начать|перв|запуск|старт|start|begin/i,
  commands: /команд|бот|\/start|\/help|slash/i,
  record: /запис|добав|внест|ввод|трат|расход|log|add|enter/i,
  phrases: /фраз|пример|сказать|написать|phrase|example/i,
  partner: /партн|жен|муж|вдво|семь|код|приглас|wife|husband|partner|invite/i,
  cloud: /облак|синхрон|бэкап|браузер|скачать|отправить|cloud|sync|backup/i,
  subscription: /подписк|оплат|500|плат|subscription|pay/i,
  planning: /копилк|цел|лимит|подушк|регуляр|planning|goal|jar|limit/i,
  ai: /совет|разбор|ai|анализ|чат.*отчет/i,
  troubleshoot: /не работ|ошиб|не вид|завис|пусто|не нашел|broken|error|missing/i,
  privacy: /удал|очист|данн|сброс|clear|delete|wipe/i,
};

/** Только релевантные разделы FAQ — меньше шума для модели */
export function buildRelevantFaqText(question: string, locale: Locale): string {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const scored = FAQ_SECTIONS.map((section) => {
    const re = FAQ_KEYWORDS[section.id];
    const hits = re ? (re.test(q) ? 2 : 0) : 0;
    return { section, score: hits };
  });
  scored.sort((a, b) => b.score - a.score);

  const withHits = scored.filter((s) => s.score > 0).map((s) => s.section);
  const base = FAQ_SECTIONS.filter((s) => ["start", "record", "cloud", "partner"].includes(s.id));
  const picked = withHits.length >= 2 ? withHits : [...base, ...withHits];
  const unique = Array.from(new Map(picked.map((s) => [s.id, s])).values()).slice(0, 6);

  return unique
    .map((s) => {
      const title = s.title[locale];
      const lines = s.body[locale].map((l) => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
      return `## ${title}\n${lines}`;
    })
    .join("\n\n");
}

/** Все разделы FAQ (legacy) */
export function buildFaqKnowledgeText(locale: Locale): string {
  return FAQ_SECTIONS.map((s) => {
    const title = s.title[locale];
    const lines = s.body[locale].map((l) => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
    return `## ${title}\n${lines}`;
  }).join("\n\n");
}

export type FaqCheatsheetSection = {
  title: Record<Locale, string>;
  steps: Record<Locale, string[]>;
  example?: Record<Locale, string>;
};

export const FAQ_CHEATSHEET_SECTIONS: FaqCheatsheetSection[] = [
  {
    title: { ru: "Запись операций", en: "Logging transactions" },
    steps: {
      ru: [
        "На главной внизу — поле ввода. Напишите фразу и нажмите «Добавить».",
        `Голосом — только боту ${BOT} (голосовое в чат). В Mini App микрофона нет.`,
        "При включённом облаке записи из бота попадают в общий бюджет.",
      ],
      en: [
        "On the home screen — text field at the bottom. Type a phrase and tap «Add».",
        "Voice — bot only (voice message in chat). No mic in the Mini App.",
        "With cloud on, bot entries sync to the household.",
      ],
    },
    example: {
      ru: "потратил 500 на обед · зарплата 80 000",
      en: "spent 500 on lunch · salary 80000",
    },
  },
  {
    title: { ru: "Категории", en: "Categories" },
    steps: {
      ru: [
        "Категория подбирается по словам во фразе (пятёрочка → Продукты, такси → Транспорт).",
        "Свои категории и ключевые слова: ⚙ → Категории.",
        "Свой доход — добавьте ключевое слово в доходную категорию; дальше достаточно назвать его во фразе.",
      ],
      en: [
        "Category is picked from words in your phrase (store → Groceries, taxi → Transport).",
        "Custom categories and keywords: ⚙ → Categories.",
        "Custom income — add a keyword to an income category, then use it in a phrase.",
      ],
    },
    example: { ru: "питер 20 тысяч", en: "client name 5000" },
  },
  {
    title: { ru: "Партнёр", en: "Partner" },
    steps: {
      ru: [
        "⚙ в шапке — имя партнёра. Появятся метки «Я» / партнёр (только на этом телефоне).",
        "В фразе можно не переключать «Кто» — скажите «любимая потратила», «милая моя 500» или имя из настроек.",
        "Вдвоём с общим бюджетом — см. блок «Облако» ниже.",
      ],
      en: [
        "⚙ in the header — partner name. «Me» / partner labels appear (this device only).",
        "In a phrase: «partner spent 500» or the name from settings — no need to toggle «Who».",
        "Shared household budget — see «Cloud» below.",
      ],
    },
    example: { ru: "любимая потратила 800 на продукты", en: "Alex spent 800 on groceries" },
  },
  {
    title: { ru: "Копилки (цели)", en: "Savings jars" },
    steps: {
      ru: [
        "Создать: главная → «Цели и планирование» → Копилки, или фразой «создать цель отпуск цель 150 000».",
        "Пополнить — сумма + «на/в/для» + название: «отложил 5000 на отпуск», «закинул в подушку 2000».",
        "Если копилка уже есть — достаточно коротко: «5000 на отпуск».",
        "Часть зарплаты сразу в цель: две суммы через запятую.",
      ],
      en: [
        "Create: home → Goals & planning → Jars, or «create goal vacation target 150000».",
        "Deposit — amount + for/to + name: «saved 5000 for vacation».",
        "If the jar exists — short form works: «5000 for vacation».",
        "Split salary to a jar: two amounts separated by a comma.",
      ],
    },
    example: {
      ru: "зарплата 100 000, 20 000 на отпуск",
      en: "salary 100000, 20000 for vacation",
    },
  },
  {
    title: { ru: "Несколько операций", en: "Multiple at once" },
    steps: {
      ru: ["В одной фразе через «и» — каждая часть со своей суммой."],
      en: ["One phrase with «and» — each part with its own amount."],
    },
    example: { ru: "500 на обед и 200 на такси", en: "500 lunch and 200 taxi" },
  },
  {
    title: { ru: "Баланс в шапке", en: "Balance (header)" },
    steps: {
      ru: [
        "Нажмите на блок баланса — суммы скроются (••••), нажмите снова — покажутся.",
        "Нажмите на сумму (Общий, «Я» или партнёр) — «Реально в кармане»: введите, сколько денег сейчас.",
        "Если в кошельке не совпадает с суммой по операциям — подгоните общий или отдельно «я» / партнёр.",
      ],
      en: [
        "Tap the balance block — amounts hide (••••), tap again to show.",
        "Tap an amount (All, Me, or Partner) — «Cash on hand»: enter what you actually have.",
        "If cash differs from transaction totals — adjust All, Me, or Partner separately.",
      ],
    },
  },
  {
    title: { ru: "Облако вдвоём", en: "Shared cloud" },
    steps: {
      ru: [
        "⚙ → Облако и семья → «Вдвоём» → «Создать облачный бюджет» → скопируйте код.",
        "Второй человек: ⚙ → Присоединиться → ввести код.",
        "Операции синхронизируются; фильтры Общий / Я / Партнёр — на главной.",
      ],
      en: [
        "⚙ → Cloud & family → Shared → create cloud budget → copy invite code.",
        "Second person: ⚙ → Join → enter code.",
        "Transactions sync; filters All / Me / Partner — on home screen.",
      ],
    },
  },
];

export function faqCheatsheetSections(locale: Locale): {
  title: string;
  steps: string[];
  example?: string;
}[] {
  return FAQ_CHEATSHEET_SECTIONS.map((s) => ({
    title: s.title[locale],
    steps: s.steps[locale],
    example: s.example?.[locale],
  }));
}

/** Ежемесячные взносы, сложный процент ~15% годовых, 10 лет (упрощённо). */
const SAVINGS_10Y_LOW = 1_376_000;
const SAVINGS_10Y_HIGH = 2_752_000;

function formatRubles(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(n);
}

/** HTML для Telegram /start — приветствие и ценность приложения */
export function formatBotStartHtml(locale: Locale, botUsername = getTelegramBotName()): string {
  const bot = botUsername.replace(/^@/, "");
  const low = formatRubles(SAVINGS_10Y_LOW, locale);
  const high = formatRubles(SAVINGS_10Y_HIGH, locale);

  if (locale === "en") {
    return (
      `<b>Welcome to Budget 👋</b>\n\n` +
      `Glad you're here. We wish you calm finances, fewer money worries, and more room for what truly matters.\n\n` +
      `<b>What you'll get right away</b>\n` +
      `• <b>Log in one phrase</b> — text or voice: «spent 500 on lunch»\n` +
      `• <b>See where money goes</b> — categories fill in automatically\n` +
      `• <b>Shared budget</b> — you and your partner, one cloud\n` +
      `• <b>Savings jars</b> — vacation, emergency fund, big goals\n` +
      `• <b>AI tips</b> — what's worth cutting this week\n\n` +
      `<b>The hidden win</b>\n` +
      `Most people find <b>₽5–10k/month</b> they didn't notice — subscriptions, impulse buys, duplicates.\n` +
      `If you redirect that to savings at ~15% a year for 10 years, it can grow to roughly <b>${low}–${high} ₽</b> (monthly deposits, simplified math).\n\n` +
      `Tap the button below — first expense takes 10 seconds.\n` +
      `Cheatsheet anytime: /help\n\n` +
      `@${bot}`
    );
  }

  return (
    `<b>Добро пожаловать в Бюджет 👋</b>\n\n` +
    `Рады, что вы здесь. Желаем спокойных финансов, меньше тревоги из‑за денег и больше сил на то, что правда важно.\n\n` +
    `<b>Что получите сразу</b>\n` +
    `• <b>Запись одной фразой</b> — текст или голос: «потратил 500 на обед»\n` +
    `• <b>Видно, куда уходят деньги</b> — категории подставляются сами\n` +
    `• <b>Бюджет вдвоём</b> — вы и партнёр, одно облако\n` +
    `• <b>Копилки на цели</b> — отпуск, подушка, крупные покупки\n` +
    `• <b>Советы ИИ</b> — что можно подрезать уже на этой неделе\n\n` +
    `<b>Незаметный, но сильный эффект</b>\n` +
    `У многих находится <b>5–10 тыс. ₽ в месяц</b>, которые «утекают» — подписки, импульсные покупки, дубли.\n` +
    `Если перенаправить их в накопления под ~15% годовых на 10 лет, это может вырасти примерно до <b>${low}–${high} ₽</b> (ежемесячные взносы, упрощённый расчёт).\n\n` +
    `Жмите кнопку ниже — первая трата займёт 10 секунд.\n` +
    `Шпаргалка в любой момент: /help\n\n` +
    `@${bot}`
  );
}

function formatCheatsheetBlock(locale: Locale): string {
  const exampleLabel = locale === "ru" ? "Пример" : "Example";
  return faqCheatsheetSections(locale)
    .map((section) => {
      const steps = section.steps.map((s) => `• ${s}`).join("\n");
      const ex = section.example
        ? `\n<i>${exampleLabel}:</i> «${section.example}»`
        : "";
      return `<b>${section.title}</b>\n${steps}${ex}`;
    })
    .join("\n\n");
}

/** HTML для Telegram /help — шпаргалка из приложения (до ~3500 символов) */
export function formatBotHelpHtml(locale: Locale, botUsername = getTelegramBotName()): string {
  const bot = botUsername.replace(/^@/, "");
  const sheet = formatCheatsheetBlock(locale);

  if (locale === "en") {
    return (
      `<b>Quick guide</b>\n\n` +
      `${sheet}\n\n` +
      `<b>Bot</b>\n` +
      `Any text without / = log a transaction · voice works too.\n` +
      `/start — welcome\n` +
      `More: Mini App → Settings → Help → ask AI\n\n` +
      `@${bot}`
    );
  }

  return (
    `<b>Шпаргалка</b>\n\n` +
    `${sheet}\n\n` +
    `<b>Бот</b>\n` +
    `Любой текст без / = запись операции · можно голосом.\n` +
    `/start — приветствие\n` +
    `Подробнее: Mini App → Настройки → Помощь → спросите ИИ\n\n` +
    `@${bot}`
  );
}
