/*
This file checks "Is it Friday yet?" in a real browser with a controlled clock.
Edit this file when the Friday page behavior changes.
Copy a test pattern here when you add another e2e test that needs a fixed date.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink } from "./helpers";

test("Friday page says NO on Thursday and YES! with confetti on Friday", async ({ page, request }) => {
  const user = await createConfirmedUser(request, "fri");
  await page.clock.setFixedTime(new Date(2026, 8, 10, 12, 0, 0));
  await loginInBrowser(page, user);

  await navLink(page, "Friday?").click();
  await expect(page.getByTestId("friday-answer")).toHaveText("NO");
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.clock.setFixedTime(new Date(2026, 8, 11, 12, 0, 0));
  await page.reload();
  await expect(page.getByTestId("friday-answer")).toHaveText("YES!");
  await expect(page.locator("canvas")).toHaveCount(1);
});
