# Облачная синхронизация (план на будущее)

Сейчас данные в `localStorage` (Zustand persist). Для двух телефонов и пары «я + партнёр» нужен backend.

## Рекомендуемый стек

| Слой | Технология | Зачем |
|------|------------|--------|
| БД | **Supabase** (PostgreSQL) | Транзакции, категории, household |
| Auth | **Telegram initData** | Вход без пароля в Mini App |
| API | Next.js Route Handlers или Supabase RPC | Уже есть `/api/*` |
| Realtime | Supabase Realtime | Синк между двумя телефонами |

## Модель данных (черновик)

```sql
households (id, name, created_at)
household_members (household_id, user_id, role, display_name)
transactions (id, household_id, user_id, amount, type, category_id, currency, note, date, owner)
categories (id, household_id, type, labels, keywords, is_system)
```

- Один **household** = общий бюджет пары.
- `owner` = `me` | `partner` привязан к `household_members`.
- Пользователь авторизуется через `telegram_id` из `initData`.

## Поток авторизации (TMA)

1. Клиент отправляет `initData` на `POST /api/auth/telegram`.
2. Сервер проверяет подпись через `BOT_TOKEN` (HMAC).
3. Возвращает JWT / session cookie + `household_id`.
4. Все запросы транзакций с этим токеном.

## Синхронизация клиента

1. **Первый запуск:** `GET /api/sync` → скачать transactions + categories.
2. **Добавление:** `POST /api/transactions` → ответ → обновить Zustand.
3. **Офлайн (опционально):** очередь в IndexedDB, flush при сети.
4. **Realtime:** подписка на `transactions` по `household_id` → `useStore.setState`.

## Миграция с localStorage

1. При первом входе с Telegram: если localStorage не пуст — `POST /api/sync/import`.
2. После успеха — переключить persist на `cloud` или отключить local-only.
3. Комментарий в коде уже есть: `// TODO: migrate to Supabase/PostgreSQL` в `lib/storage.ts`.

## Оценка объёма

- MVP sync (auth + CRUD + один household): **3–5 дней**
- Realtime + офлайн-очередь: **+2–3 дня**
- Приглашение партнёра по ссылке: **+1–2 дня**

## Альтернативы

- **Firebase** — быстрее старт, слабее SQL-отчёты.
- **PocketBase** — self-hosted, дешевле.
- **Свой PostgreSQL + Prisma** — максимум контроля, дольше разработка.
