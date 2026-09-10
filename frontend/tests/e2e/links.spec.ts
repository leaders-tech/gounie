/*
This file checks the great url collection in real browsers: adding, searching, and voting with live author karma.
Edit this file when the links browser flow changes.
Copy a test pattern here when you add another e2e flow with search.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink, uniqueName } from "./helpers";

test("add a link, find it, and upvote it for the author's karma", async ({ browser, request }) => {
  const author = await createConfirmedUser(request, "aut");
  const voter = await createConfirmedUser(request, "vot");
  const authorPage = await (await browser.newContext()).newPage();
  const voterPage = await (await browser.newContext()).newPage();
  const title = `E2E link ${uniqueName("l")}`;

  await loginInBrowser(authorPage, author);
  await navLink(authorPage, "URLs").click();
  await authorPage.getByLabel("URL").fill("https://example.org/e2e");
  await authorPage.getByLabel("Title").fill(title);
  await authorPage.getByLabel("Description").fill("A link made by Playwright.");
  await authorPage.getByRole("button", { name: "Add link" }).click();
  await expect(authorPage.getByRole("link", { name: title })).toBeVisible();

  await loginInBrowser(voterPage, voter);
  await voterPage.goto("/urls");
  await voterPage.getByLabel("Search links").fill(title);
  const item = voterPage.getByTestId("link-item").filter({ hasText: title });
  await expect(voterPage.getByTestId("link-item")).toHaveCount(1);
  await item.getByRole("button", { name: `Upvote ${title}` }).click();
  await expect(item.getByTestId("link-score")).toHaveText("1");

  await expect(authorPage.getByTestId("header-karma")).toHaveText("1 karma");
});
