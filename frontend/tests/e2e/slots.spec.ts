/*
This file checks slots in a real browser: a spin takes the stake, shows a result, and updates karma.
Edit this file when the slots browser flow changes.
Copy a test pattern here when you add another e2e flow with a random result.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink } from "./helpers";

test("spinning slots shows a result and updates karma", async ({ page, request }) => {
  const user = await createConfirmedUser(request, "slo");
  await loginInBrowser(page, user);
  await navLink(page, "Slots").click();
  await expect(page.getByRole("heading", { name: "Pay table" })).toBeVisible();
  await expect(page.getByText(/payback|you will lose|always wins/i)).toHaveCount(0);

  await page.getByLabel("Stake (karma)").fill("3");
  await page.getByRole("button", { name: "SPIN" }).click();

  const lastSpin = page.getByTestId("spin-history").locator("li").first();
  await expect(lastSpin).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("spin-result")).toHaveText(/won|came back|No win/);

  const change = Number(await lastSpin.locator("span").last().textContent());
  await expect(page.getByTestId("header-karma")).toHaveText(`${change} karma`);
});
