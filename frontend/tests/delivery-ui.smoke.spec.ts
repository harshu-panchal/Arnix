import { test, expect } from "@playwright/test";

test("Delivery UI smoke: login, pending orders, order detail (tracking)", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Ignore noisy browser errors that don't indicate a React crash.
    if (/Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  const deliveryMobile = process.env.PW_DELIVERY_MOBILE || "8260521733";
  const otp = process.env.PW_DELIVERY_OTP || "1234";

  // Login
  await page.goto("/delivery/login");
  await expect(page.getByText("Delivery Login")).toBeVisible();

  await page.getByPlaceholder("Enter mobile number").fill(deliveryMobile);

  const sendOtpResponsePromise = page.waitForResponse((r) => {
    return r.url().includes("/auth/delivery/send-sms-otp") && r.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Continue" }).click();
  const sendOtpResponse = await sendOtpResponsePromise;
  const sendOtpJson: any = await sendOtpResponse.json().catch(() => null);
  if (!sendOtpResponse.ok() || !sendOtpJson?.success) {
    throw new Error(
      `delivery send-sms-otp failed: http=${sendOtpResponse.status()} body=${JSON.stringify(sendOtpJson)}`
    );
  }

  const otpInputs = page.locator('input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await page.waitForURL(/\/delivery\/?$/);

  // Pending orders
  await page.goto("/delivery/orders/pending");
  await expect(page.getByText("Today's Pending Orders")).toBeVisible();

  // If there is at least one pending order, open it and ensure tracking UI renders.
  const firstOrderId = page.getByText(/^ORD/).first();
  if (await firstOrderId.count()) {
    await firstOrderId.click();
    await page.waitForURL(/\/delivery\/orders\/.+/);

    // Page should show some stable labels/icons; map may fall back if API key isn't configured.
    await expect(page.getByText("Customer Details")).toBeVisible({ timeout: 30_000 });

    const mapFallback = page.getByText("Google Maps API key not configured");
    if (await mapFallback.count()) {
      await expect(mapFallback.first()).toBeVisible();
    }
  }

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
