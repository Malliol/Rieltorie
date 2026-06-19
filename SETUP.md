# Инструкция по настройке и деплою

## Архитектура

```
Telegram Mini App → Cloudflare Worker → GitHub commit → GitHub Actions → GitHub Pages
```

Пользователь заполняет форму в Mini App → Worker делает один коммит в репозиторий → Actions собирает сайт → Pages публикует его. Базы данных нет — Git является единственным хранилищем.

---

## 1. GitHub Pages

### 1.1 Включить GitHub Pages
1. Откройте репозиторий → **Settings → Pages**
2. Source: **GitHub Actions**
3. Сохранить

### 1.2 Переменная BASE в workflow
- Если сайт на **custom domain** (например `rieltorie.ru`) → `BASE: ""`
- Если сайт на **GitHub Pages** (`malliol.github.io/rieltorie`) → `BASE: "/rieltorie"`

Отредактируйте `.github/workflows/build.yml`:
```yaml
- name: Build static site
  run: npm run build
  env:
    BASE: "/rieltorie"   # ← ваш вариант
```

### 1.3 Custom domain (опционально)
1. В **Settings → Pages → Custom domain** введите ваш домен
2. У регистратора домена добавьте CNAME-запись:
   ```
   www  CNAME  malliol.github.io
   ```
3. Включите **Enforce HTTPS**

---

## 2. GitHub Personal Access Token (для Worker)

Worker должен иметь право делать коммиты в репозиторий.

1. Откройте **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. **Generate new token**
3. Настройки:
   - Repository access: **Only select repositories** → выберите `rieltorie`
   - Permissions → Repository permissions:
     - **Contents**: Read and write
     - **Metadata**: Read (добавится автоматически)
4. Скопируйте токен (показывается один раз!)

---

## 3. Telegram Bot

### 3.1 Создать бота
1. Напишите [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → задайте имя и username (например `rieltorie_bot`)
3. Скопируйте **токен бота** (вида `1234567890:AAFxxx...`)

### 3.2 Создать Mini App
1. В чате с BotFather: `/newapp`
2. Выберите вашего бота
3. Title: название приложения
4. URL: адрес задеплоенного miniapp (заполните позже, после деплоя на Cloudflare Pages)

### 3.3 Узнать свой Telegram User ID
1. Напишите [@userinfobot](https://t.me/userinfobot)
2. Он ответит вашим User ID (число вида `123456789`)
3. Вставьте его в `worker/src/tenants.ts`:
   ```ts
   allowedUserIds: [123456789],  // ← ваш ID
   ```

---

## 4. Cloudflare Worker

### 4.1 Установить Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 4.2 Задать секреты
```bash
cd worker

# GitHub токен из п. 2
wrangler secret put GITHUB_TOKEN
# Вставьте токен и нажмите Enter

# Токен Telegram бота из п. 3.1
wrangler secret put TELEGRAM_BOT_TOKEN
# Вставьте токен и нажмите Enter
```

### 4.3 Задеплоить Worker
```bash
wrangler deploy
```
После деплоя получите URL вида:
```
https://rieltorie-worker.YOUR_SUBDOMAIN.workers.dev
```

### 4.4 Прописать URL Worker в Mini App
Откройте `apps/miniapp/src/App.tsx`, найдите строку:
```ts
const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? "https://rieltorie-worker.YOUR_SUBDOMAIN.workers.dev";
```
Либо создайте `apps/miniapp/.env.production`:
```
VITE_WORKER_URL=https://rieltorie-worker.YOUR_SUBDOMAIN.workers.dev
```

---

## 5. Деплой Mini App

Mini App — статический React-сайт. Можно задеплоить на:

### Вариант A: Cloudflare Pages (рекомендуется)
```bash
cd apps/miniapp
npm run build
# Загрузите папку dist на pages.cloudflare.com
```
Или через Wrangler:
```bash
wrangler pages deploy dist --project-name rieltorie-miniapp
```

### Вариант B: GitHub Pages (отдельный репозиторий или подпапка)
Добавьте workflow или загрузите `dist/` вручную.

После деплоя укажите URL в BotFather (`/myapps → Edit Web App URL`).

---

## 6. Заполнить данные риелтора

Откройте `content/realtor.yaml` и заполните свои данные:
```yaml
name: Ваше Имя
tagline: Подбор, проверка, сделка под ключ
phone: "+79001234567"
telegram: your_username
photo: realtor.webp
facts:
  - label: лет опыта
    value: "7"
  - label: сделок
    value: "150+"
  - label: рейтинг
    value: "4.9"
```

Положите фото `realtor.webp` в `content/assets/`.

---

## 7. Выбрать тему оформления

Откройте `content/theme.json` и вставьте данные из любого пресета из `content/theme.presets.json`.

Доступные темы:
- **Классика** — тёмно-синий акцент, нейтральный фон
- **Пихта** — зелёный акцент, природные оттенки
- **Терракота** — тёплые коричнево-красные тона

---

## 8. Проверочный список перед запуском

- [ ] `content/realtor.yaml` заполнен
- [ ] `content/theme.json` выбрана тема
- [ ] GitHub Pages включён (Settings → Pages → GitHub Actions)
- [ ] `BASE` в workflow.yml установлен правильно
- [ ] GitHub PAT создан и добавлен через `wrangler secret put GITHUB_TOKEN`
- [ ] Telegram бот создан, токен добавлен через `wrangler secret put TELEGRAM_BOT_TOKEN`
- [ ] `allowedUserIds` в `worker/src/tenants.ts` содержит ваш Telegram ID
- [ ] `owner` и `repo` в `worker/src/tenants.ts` указывают на ваш репозиторий
- [ ] Worker задеплоен, URL прописан в Mini App
- [ ] Mini App задеплоен, URL передан в BotFather

---

## 9. Локальная разработка

```bash
npm install

# Сборка статического сайта
npm run build
# Результат в dist/

# Запуск Mini App в режиме разработки
npm run dev:miniapp
# Открыть http://localhost:5173

# Запуск Worker локально
npm run dev:worker
# Worker на http://localhost:8787
```

---

## Схема работы (кратко)

```
1. Риелтор открывает Mini App в Telegram
2. Заполняет форму, добавляет фото
3. Нажимает "Опубликовать"
4. Mini App сжимает фото в WebP, отправляет POST на Worker
5. Worker проверяет подпись Telegram (HMAC-SHA256)
6. Worker создаёт YAML файл объекта + фото, делает 1 коммит в GitHub
7. GitHub Actions запускается автоматически, собирает сайт (~60-90 сек)
8. Сайт обновляется на GitHub Pages
9. Mini App показывает ссылку на страницу объекта
```
