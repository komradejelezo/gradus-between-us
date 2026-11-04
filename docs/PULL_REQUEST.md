# Автоматическая публикация «ГРАДУС: Между нами» в GitHub Pages

Добавлена публикация production-сборки из `main` через GitHub Actions. Workflow устанавливает зависимости из lockfile, выполняет тесты, собирает Vite и передаёт только `dist/` в `actions/upload-pages-artifact` → `actions/deploy-pages`. Доступен ручной запуск для `main`; Pull Request и другие ветки не развёртываются. Задания публикации сериализованы, права `pages: write` и `id-token: write` получает только deploy job.

В `vite.config.ts` установлен `base: "/gradus-between-us/"`. Браузерные тесты и readiness URL preview переведены на тот же путь, чтобы проверять размещение в подкаталоге, а не только в корне сайта. README описывает однократный выбор GitHub Actions в Settings → Pages и повторный запуск workflow.

Проверено локально:

- `npm run build` — успешно; ссылки на JS/CSS в `dist/index.html` начинаются с `/gradus-between-us/assets/`.
- `npm test` — 31 тест пройден.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` — 2 браузерных сценария пройдены по `/gradus-between-us/`, включая полную партию и перезагрузку.
- `npm run format:check` и `git diff --check` — успешно.

Ожидаемый адрес после успешного deploy: https://komradejelezo.github.io/gradus-between-us/. Запуск GitHub-hosted workflow и реальная публикация будут проверены после слияния в `main` и включения источника Pages `GitHub Actions`, если он ещё не выбран. Репозиторий, настройки и публикация `gradus-online` не изменялись.
