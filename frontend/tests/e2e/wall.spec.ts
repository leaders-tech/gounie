/*
This file checks The Wall in real browsers: posting a styled note with a picture, turning it later (the only real edit), live updates, and the whoops delete.
Edit this file when the wall browser flow changes.
Copy a test pattern here when you add another e2e flow with two users.
*/

import { expect, test } from "@playwright/test";
import { createConfirmedUser, loginInBrowser, navLink } from "./helpers";

const ONE_PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

test("users stick styled notes on walls, turn them around, see it live, and deleting always says whoops", async ({ browser, request }) => {
  const owner = await createConfirmedUser(request, "own");
  const visitor = await createConfirmedUser(request, "vis");
  const ownerPage = await (await browser.newContext()).newPage();
  const visitorPage = await (await browser.newContext()).newPage();

  await loginInBrowser(ownerPage, owner);
  await ownerPage.goto(`/u/${owner.username}`);
  await expect(ownerPage.getByText("This wall is empty.")).toBeVisible();

  await loginInBrowser(visitorPage, visitor);
  await navLink(visitorPage, "The Wall").click();
  await visitorPage.getByLabel("Search people").fill(owner.username);
  await visitorPage.getByRole("link", { name: new RegExp(owner.username) }).click();
  await expect(visitorPage.getByRole("heading", { name: owner.username, exact: true })).toBeVisible();
  await expect(visitorPage.getByText(/everything you put on the wall can be edited and deleted later/)).toBeVisible();

  await visitorPage.getByLabel("Note", { exact: true }).fill("Hello from e2e!");
  await visitorPage.getByLabel("Note color hex").fill("#ff99cc");
  await visitorPage.getByLabel("Text color hex").fill("#0000ff");
  await visitorPage.getByRole("button", { name: "Bold" }).click();
  await visitorPage.getByRole("button", { name: "Underline" }).click();
  await visitorPage.getByRole("slider", { name: /Rotation/ }).fill("170");
  await visitorPage.getByTestId("note-picture-input").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
  await expect(visitorPage.getByRole("img", { name: `Picture from ${visitor.username}` })).toBeVisible();
  await visitorPage.getByRole("button", { name: "Stick it on the wall" }).click();

  const visitorNote = visitorPage.getByTestId("wall-board").getByRole("article", { name: `Note from ${visitor.username}` });
  await expect(visitorNote).toContainText("Hello from e2e!");
  await expect(visitorNote).toHaveCSS("background-color", "rgb(255, 153, 204)");
  await expect.poll(() => visitorNote.evaluate((element) => element.style.transform)).toBe("rotate(170deg)");
  const visitorText = visitorNote.getByText("Hello from e2e!");
  await expect(visitorText).toHaveCSS("font-weight", "800");
  await expect(visitorText).toHaveCSS("text-decoration-line", "underline");
  await expect(visitorText).toHaveCSS("color", "rgb(0, 0, 255)");
  await expect.poll(() => visitorNote.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const ownerNote = ownerPage.getByTestId("wall-board").getByRole("article", { name: `Note from ${visitor.username}` });
  await expect(ownerNote).toContainText("Hello from e2e!");

  await visitorNote.click({ button: "right" });
  await visitorPage.getByRole("menuitem", { name: /Edit$/ }).click();
  const dialog = visitorPage.getByRole("dialog", { name: "Edit your note" });
  await expect(dialog.getByRole("button", { name: "Bold" })).toHaveCount(0);
  await expect(dialog.getByLabel("Note color hex")).toHaveCount(0);
  await dialog.getByRole("slider", { name: /Rotation/ }).fill("-135");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => visitorNote.evaluate((element) => element.style.transform)).toBe("rotate(-135deg)");
  await expect.poll(() => ownerNote.evaluate((element) => element.style.transform)).toBe("rotate(-135deg)");
  await expect(visitorText).toHaveCSS("font-weight", "800");

  await ownerNote.click({ button: "right" });
  await expect(ownerPage.getByRole("menuitem", { name: /Edit$/ })).toHaveCount(0);
  await ownerPage.getByRole("menuitem", { name: /Delete$/ }).click();
  await expect(ownerPage.getByRole("alert")).toHaveText("whoops.. something went wrong");

  await visitorNote.click({ button: "right" });
  await visitorPage.getByRole("menuitem", { name: /Delete$/ }).click();
  await expect(visitorPage.getByRole("alert")).toHaveText("whoops.. something went wrong");

  await ownerPage.reload();
  const reloadedNote = ownerPage.getByTestId("wall-board").getByRole("article", { name: `Note from ${visitor.username}` });
  await expect(reloadedNote).toContainText("Hello from e2e!");
  await expect(reloadedNote).toHaveCSS("background-color", "rgb(255, 153, 204)");
  await expect.poll(() => reloadedNote.evaluate((element) => element.style.transform)).toBe("rotate(-135deg)");
});
