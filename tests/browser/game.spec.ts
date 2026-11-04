import { test, expect } from "@playwright/test";
test("mobile production game: secrets, dice, restore, finale and deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Сегодня всё только для вас двоих"),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/gradus-home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Начать игру" }).click();
  await page.getByLabel("Имя", { exact: true }).nth(0).fill("Аня");
  await page.getByLabel("Имя", { exact: true }).nth(1).fill("Саша");
  await page.getByRole("button", { name: "15 мин" }).click();
  await page.getByRole("checkbox", { name: "Нам обоим" }).check();
  await page.getByRole("button", { name: "Зажечь искру" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Искра", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/gradus-game-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Сменить карточку" }).click();
  await page.getByRole("button", { name: "Пропустить без объяснений" }).click();
  // The second event is the secret-answer category.
  await page.locator(".answer-grid button").first().click();
  await expect(
    page.getByRole("heading", { name: "Передай устройство партнёру" }),
  ).toBeVisible();
  await expect(page.locator(".answer-grid")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    localStorage.getItem("gradus-between-us:v1"),
  );
  expect(stored).not.toContain("answers");
  await page.reload();
  await page.getByRole("button", { name: "Продолжить игру" }).click();
  await expect(page.locator(".answer-grid button")).toHaveCount(4);
  await page.locator(".answer-grid button").first().click();
  await page.getByRole("button", { name: "Устройство у меня" }).click();
  await page.locator(".answer-grid button").first().click();
  await expect(
    page.getByRole("button", { name: "Раскрыть ответы" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Аня: я готов(а)" }).click();
  await page.getByRole("button", { name: "Саша: я готов(а)" }).click();
  await page.getByRole("button", { name: "Раскрыть ответы" }).click();
  await expect(
    page.getByText("Вы на одной волне!", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мы выполнили" }).click();
  // Complete every remaining regular event rather than just skipping the game.
  for (let i = 2; i < 8; i++) {
    if (await page.locator(".answer-grid button").count())
      await page.locator(".answer-grid button").first().click();
    if (
      await page
        .getByRole("button", { name: "Бросить кубик", exact: false })
        .count()
    )
      await page
        .getByRole("button", { name: "Бросить кубик", exact: false })
        .click();
    if (await page.getByRole("button", { name: "Устройство у меня" }).count()) {
      await page.getByRole("button", { name: "Устройство у меня" }).click();
      await page.locator(".answer-grid button").last().click();
      await page.getByRole("button", { name: "Аня: я готов(а)" }).click();
      await page.getByRole("button", { name: "Саша: я готов(а)" }).click();
      await page.getByRole("button", { name: "Раскрыть ответы" }).click();
      await expect(
        page.getByText("Два взгляда — больше открытий", { exact: false }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: /Мы выполнили|Мы оба согласны/ })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Между нами", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Завершить наш вечер", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Между вами — целый мир" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить памятный результат" })
    .click();
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ваши памятные вечера" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Удалить все данные игры" }).click();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) =>
        k.startsWith("gradus-between-us"),
      ),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("desktop rules and disabled touch survive reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Как провести этот вечер" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Начать игру" }).click();
  await page.getByLabel("Имя", { exact: true }).nth(0).fill("Первый");
  await page.getByLabel("Имя", { exact: true }).nth(1).fill("Второй");
  await page.getByRole("button", { name: "Нежная", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Задания с прикосновениями" })
    .uncheck();
  await page.getByRole("checkbox", { name: "Нам обоим" }).check();
  await page.getByRole("button", { name: "Зажечь искру" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Продолжить игру" }).click();
  await expect(page.getByText("Первый", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("gradus-between-us:v1")!).settings,
    ),
  ).toMatchObject({ level: 1, touch: false });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
