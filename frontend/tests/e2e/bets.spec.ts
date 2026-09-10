/*
This file checks EPS-bet in real browsers: creating a bet, another user placing a wager, and the live discussion.
Edit this file when the bet browser flow changes.
Copy a test pattern here when you add another e2e flow with karma changes.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink, uniqueName } from "./helpers";

test("create a bet, another user bets and discusses it live", async ({ browser, request }) => {
  const creator = await createConfirmedUser(request, "cre");
  const bettor = await createConfirmedUser(request, "bet");
  const creatorPage = await (await browser.newContext()).newPage();
  const bettorPage = await (await browser.newContext()).newPage();
  const title = `Will e2e pass today ${uniqueName("q")}?`;

  await loginInBrowser(creatorPage, creator);
  await navLink(creatorPage, "EPS-bet").click();
  await creatorPage.getByRole("button", { name: "+ New bet" }).click();
  await creatorPage.getByLabel("Question").fill(title);
  await creatorPage.getByLabel("Details (optional)").fill("Only green tests count.");
  await creatorPage.getByRole("button", { name: "Create bet" }).click();
  await expect(creatorPage.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(creatorPage.getByText(/so you can't bet on it/)).toBeVisible();

  await loginInBrowser(bettorPage, bettor);
  await bettorPage.goto(new URL(creatorPage.url()).pathname);
  await bettorPage.getByRole("button", { name: "NO", exact: true }).click();
  await bettorPage.getByLabel("Stake (karma)").fill("7");
  await bettorPage.getByRole("button", { name: "Place bet" }).click();
  await expect(bettorPage.getByText(/Now wait for the outcome/)).toBeVisible();
  await expect(bettorPage.getByTestId("header-karma")).toHaveText("-7 karma");

  await bettorPage.getByLabel("Your message").fill("No way this passes.");
  await bettorPage.getByRole("button", { name: "Post message" }).click();
  await expect(bettorPage.getByText("No way this passes.")).toBeVisible();

  await expect(creatorPage.getByText("No way this passes.")).toBeVisible();
  await expect(creatorPage.getByText("NO · 7 karma")).toBeVisible();
});
