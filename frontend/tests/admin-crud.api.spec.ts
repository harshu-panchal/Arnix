import { test, expect, request as playwrightRequest } from "@playwright/test";

const isLocalApiBaseUrl = (url: string) => {
  try {
    const u = new URL(url);
    return (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      (u.port === "" || u.port === "5000")
    );
  } catch {
    return false;
  }
};

const getApiBaseUrl = () => {
  const raw =
    process.env.PW_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api/v1";
  return raw.replace(/\/+$/, "");
};

async function adminLogin(apiBaseUrl: string) {
  const adminMobile = process.env.PW_ADMIN_MOBILE || "9876543210";
  const otp = process.env.PW_ADMIN_OTP || "1234";

  // Note: when using Playwright's `baseURL`, request paths must be relative
  // (no leading "/") if `baseURL` itself includes a path like "/api/v1".
  const baseURL = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const ctx = await playwrightRequest.newContext({ baseURL });

  const sendOtpRes = await ctx.post("auth/admin/send-otp", {
    data: { mobile: adminMobile },
  });
  const sendOtpJson: any = await sendOtpRes.json().catch(() => null);
  expect(
    sendOtpRes.ok() && sendOtpJson?.success,
    `admin send-otp failed: http=${sendOtpRes.status()} body=${JSON.stringify(sendOtpJson)}`
  ).toBeTruthy();

  const verifyRes = await ctx.post("auth/admin/verify-otp", {
    data: { mobile: adminMobile, otp },
  });
  const verifyJson: any = await verifyRes.json().catch(() => null);
  expect(
    verifyRes.ok() && verifyJson?.success && verifyJson?.data?.token,
    `admin verify-otp failed: http=${verifyRes.status()} body=${JSON.stringify(verifyJson)}`
  ).toBeTruthy();

  const token = verifyJson.data.token as string;
  return { ctx, token };
}

test("Admin API CRUD smoke: categories, order status, customer status, system users", async () => {
  const apiBaseUrl = getApiBaseUrl();

  test.skip(
    !isLocalApiBaseUrl(apiBaseUrl),
    `Refusing to run CRUD smoke against non-local API base URL: ${apiBaseUrl}`
  );

  const { ctx, token } = await adminLogin(apiBaseUrl);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const uniqueSuffix = `${Date.now()}`;

  // ---------- Categories: create -> update -> toggle -> delete ----------
  const headerCatsRes = await ctx.get("header-categories");
  expect(headerCatsRes.ok(), `GET /header-categories http=${headerCatsRes.status()}`).toBeTruthy();
  const headerCats: any[] = (await headerCatsRes.json().catch(() => [])) as any[];
  const publishedHeader = headerCats.find((c) => c?.status === "Published") || headerCats[0];
  expect(publishedHeader?._id, "Need at least one header category to create a root category").toBeTruthy();

  const catName1 = `ZZZ Admin Smoke ${uniqueSuffix}`;
  const catName2 = `ZZZ Admin Smoke Updated ${uniqueSuffix}`;

  const createCatRes = await ctx.post("admin/categories", {
    headers: authHeaders,
    data: {
      name: catName1,
      headerCategoryId: publishedHeader._id,
      status: "Active",
    },
  });
  const createCatJson: any = await createCatRes.json().catch(() => null);
  expect(
    createCatRes.status() === 201 && createCatJson?.success && createCatJson?.data?._id,
    `create category failed: http=${createCatRes.status()} body=${JSON.stringify(createCatJson)}`
  ).toBeTruthy();
  const createdCategoryId = createCatJson.data._id as string;

  try {
    const updateCatRes = await ctx.put(`admin/categories/${createdCategoryId}`, {
      headers: authHeaders,
      data: { name: catName2 },
    });
    const updateCatJson: any = await updateCatRes.json().catch(() => null);
    expect(
      updateCatRes.ok() && updateCatJson?.success && updateCatJson?.data?.name === catName2,
      `update category failed: http=${updateCatRes.status()} body=${JSON.stringify(updateCatJson)}`
    ).toBeTruthy();

    const toggleOffRes = await ctx.patch(`admin/categories/${createdCategoryId}/status`, {
      headers: authHeaders,
      data: { status: "Inactive", cascadeToChildren: false },
    });
    const toggleOffJson: any = await toggleOffRes.json().catch(() => null);
    expect(
      toggleOffRes.ok() && toggleOffJson?.success && toggleOffJson?.data?.status === "Inactive",
      `toggle category inactive failed: http=${toggleOffRes.status()} body=${JSON.stringify(toggleOffJson)}`
    ).toBeTruthy();

    const toggleOnRes = await ctx.patch(`admin/categories/${createdCategoryId}/status`, {
      headers: authHeaders,
      data: { status: "Active", cascadeToChildren: false },
    });
    const toggleOnJson: any = await toggleOnRes.json().catch(() => null);
    expect(
      toggleOnRes.ok() && toggleOnJson?.success && toggleOnJson?.data?.status === "Active",
      `toggle category active failed: http=${toggleOnRes.status()} body=${JSON.stringify(toggleOnJson)}`
    ).toBeTruthy();
  } finally {
    // Cleanup: delete the temporary category (best-effort).
    await ctx.delete(`admin/categories/${createdCategoryId}`, { headers: authHeaders });
  }

  // ---------- Orders: reversible status flip (avoid Processed/Delivered) ----------
  const ordersRes = await ctx.get("admin/orders?limit=30", { headers: authHeaders });
  const ordersJson: any = await ordersRes.json().catch(() => null);
  expect(
    ordersRes.ok() && Array.isArray(ordersJson?.data),
    `GET /admin/orders failed: http=${ordersRes.status()} body=${JSON.stringify(ordersJson)}`
  ).toBeTruthy();

  const reversibleOrder = (ordersJson.data as any[]).find((o) =>
    ["Received", "Pending"].includes(o?.status)
  );
  if (reversibleOrder?._id) {
    const orderId = reversibleOrder._id as string;
    const originalStatus = reversibleOrder.status as "Received" | "Pending";
    const nextStatus = originalStatus === "Received" ? "Pending" : "Received";

    const update1 = await ctx.patch(`admin/orders/${orderId}/status`, {
      headers: authHeaders,
      data: { status: nextStatus },
    });
    const update1Json: any = await update1.json().catch(() => null);
    expect(
      update1.ok() && update1Json?.success && update1Json?.data?.status === nextStatus,
      `order status update failed: http=${update1.status()} body=${JSON.stringify(update1Json)}`
    ).toBeTruthy();

    const update2 = await ctx.patch(`admin/orders/${orderId}/status`, {
      headers: authHeaders,
      data: { status: originalStatus },
    });
    const update2Json: any = await update2.json().catch(() => null);
    expect(
      update2.ok() && update2Json?.success && update2Json?.data?.status === originalStatus,
      `order status revert failed: http=${update2.status()} body=${JSON.stringify(update2Json)}`
    ).toBeTruthy();
  }

  // ---------- Customers: reversible status flip ----------
  const customersRes = await ctx.get("admin/customers?limit=20", { headers: authHeaders });
  const customersJson: any = await customersRes.json().catch(() => null);
  expect(
    customersRes.ok() && Array.isArray(customersJson?.data),
    `GET /admin/customers failed: http=${customersRes.status()} body=${JSON.stringify(customersJson)}`
  ).toBeTruthy();

  const customer = (customersJson.data as any[]).find((c) => c?._id && (c?.status === "Active" || c?.status === "Inactive"));
  if (customer?._id) {
    const customerId = customer._id as string;
    const original = (customer.status as "Active" | "Inactive") || "Active";
    const next = original === "Active" ? "Inactive" : "Active";

    const flip1 = await ctx.patch(`admin/customers/${customerId}/status`, {
      headers: authHeaders,
      data: { status: next },
    });
    const flip1Json: any = await flip1.json().catch(() => null);
    expect(
      flip1.ok() && flip1Json?.success && flip1Json?.data?.status === next,
      `customer status update failed: http=${flip1.status()} body=${JSON.stringify(flip1Json)}`
    ).toBeTruthy();

    const flip2 = await ctx.patch(`admin/customers/${customerId}/status`, {
      headers: authHeaders,
      data: { status: original },
    });
    const flip2Json: any = await flip2.json().catch(() => null);
    expect(
      flip2.ok() && flip2Json?.success && flip2Json?.data?.status === original,
      `customer status revert failed: http=${flip2.status()} body=${JSON.stringify(flip2Json)}`
    ).toBeTruthy();
  }

  // ---------- System Users: create -> update -> delete ----------
  const sysUserMobile = `9${String(Date.now()).slice(-9)}`; // stable 10-digit
  const sysUserEmail = `zz-admin-smoke-${uniqueSuffix}@example.com`;
  const createSysUserRes = await ctx.post("admin/system-users", {
    headers: authHeaders,
    data: {
      firstName: "Smoke",
      lastName: "Admin",
      mobile: sysUserMobile,
      email: sysUserEmail,
      password: "smoke123",
      role: "Admin",
    },
  });
  const createSysUserJson: any = await createSysUserRes.json().catch(() => null);
  expect(
    createSysUserRes.status() === 201 && createSysUserJson?.success && createSysUserJson?.data?.id,
    `create system user failed: http=${createSysUserRes.status()} body=${JSON.stringify(createSysUserJson)}`
  ).toBeTruthy();
  const createdSysUserId = createSysUserJson.data.id as string;

  try {
    const updateSysUserRes = await ctx.put(`admin/system-users/${createdSysUserId}`, {
      headers: authHeaders,
      data: { lastName: "AdminUpdated" },
    });
    const updateSysUserJson: any = await updateSysUserRes.json().catch(() => null);
    expect(
      updateSysUserRes.ok() && updateSysUserJson?.success && updateSysUserJson?.data?.lastName === "AdminUpdated",
      `update system user failed: http=${updateSysUserRes.status()} body=${JSON.stringify(updateSysUserJson)}`
    ).toBeTruthy();
  } finally {
    await ctx.delete(`admin/system-users/${createdSysUserId}`, { headers: authHeaders });
  }

  // ---------- Coupons: create -> update -> deactivate -> activate -> delete ----------
  const couponCode = `ZZZSMOKE${uniqueSuffix}`.slice(0, 20).toUpperCase(); // keep it short-ish
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const createCouponRes = await ctx.post("admin/coupons", {
    headers: authHeaders,
    data: {
      code: couponCode,
      description: "Admin coupon smoke test",
      discountType: "Percentage",
      discountValue: 10,
      startDate,
      endDate,
      minimumPurchase: 1,
    },
  });
  const createCouponJson: any = await createCouponRes.json().catch(() => null);
  expect(
    createCouponRes.status() === 201 && createCouponJson?.success && createCouponJson?.data?._id,
    `create coupon failed: http=${createCouponRes.status()} body=${JSON.stringify(createCouponJson)}`
  ).toBeTruthy();
  const couponId = createCouponJson.data._id as string;

  try {
    const updateCouponRes = await ctx.put(`admin/coupons/${couponId}`, {
      headers: authHeaders,
      data: { description: "Admin coupon smoke test (updated)" },
    });
    const updateCouponJson: any = await updateCouponRes.json().catch(() => null);
    expect(
      updateCouponRes.ok() && updateCouponJson?.success,
      `update coupon failed: http=${updateCouponRes.status()} body=${JSON.stringify(updateCouponJson)}`
    ).toBeTruthy();

    const deactivateRes = await ctx.put(`admin/coupons/${couponId}`, {
      headers: authHeaders,
      data: { isActive: false },
    });
    const deactivateJson: any = await deactivateRes.json().catch(() => null);
    expect(
      deactivateRes.ok() && deactivateJson?.success && deactivateJson?.data?.isActive === false,
      `deactivate coupon failed: http=${deactivateRes.status()} body=${JSON.stringify(deactivateJson)}`
    ).toBeTruthy();

    const activateRes = await ctx.put(`admin/coupons/${couponId}`, {
      headers: authHeaders,
      data: { isActive: true },
    });
    const activateJson: any = await activateRes.json().catch(() => null);
    expect(
      activateRes.ok() && activateJson?.success && activateJson?.data?.isActive === true,
      `activate coupon failed: http=${activateRes.status()} body=${JSON.stringify(activateJson)}`
    ).toBeTruthy();
  } finally {
    await ctx.delete(`admin/coupons/${couponId}`, { headers: authHeaders });
  }

  // ---------- Payment Methods: reversible status flip (avoid leaving system without COD) ----------
  const paymentMethodsRes = await ctx.get("admin/payment-methods", { headers: authHeaders });
  const paymentMethodsJson: any = await paymentMethodsRes.json().catch(() => null);
  expect(
    paymentMethodsRes.ok() && Array.isArray(paymentMethodsJson?.data),
    `GET /admin/payment-methods failed: http=${paymentMethodsRes.status()} body=${JSON.stringify(paymentMethodsJson)}`
  ).toBeTruthy();

  // Prefer toggling a gateway method (e.g., Razorpay) instead of COD, to reduce side-effects.
  const methods: any[] = paymentMethodsJson.data as any[];
  const gatewayMethod =
    methods.find((m) => /razorpay/i.test(`${m?.provider ?? ""}${m?.name ?? ""}`)) ||
    methods.find((m) => m?.type === "gateway") ||
    methods[0];

  if (gatewayMethod?._id) {
    const pmId = gatewayMethod._id as string;
    const originalStatus = (gatewayMethod.status as "Active" | "InActive") || "Active";
    const nextStatus = originalStatus === "Active" ? "InActive" : "Active";

    try {
      const flip1 = await ctx.patch(`admin/payment-methods/${pmId}/status`, {
        headers: authHeaders,
        data: { status: nextStatus },
      });
      const flip1Json: any = await flip1.json().catch(() => null);
      expect(
        flip1.ok() && flip1Json?.success && flip1Json?.data?.status === nextStatus,
        `payment method status update failed: http=${flip1.status()} body=${JSON.stringify(flip1Json)}`
      ).toBeTruthy();
    } finally {
      // Best-effort revert
      await ctx.patch(`admin/payment-methods/${pmId}/status`, {
        headers: authHeaders,
        data: { status: originalStatus },
      });
    }
  }

  // ---------- Delivery Boys: create -> update -> status/availability -> delete ----------
  const deliveryMobile = `8${String(Date.now()).slice(-9)}`; // stable 10-digit
  const deliveryEmail = `zz-delivery-smoke-${uniqueSuffix}@example.com`;
  const createDeliveryRes = await ctx.post("admin/delivery", {
    headers: authHeaders,
    data: {
      name: "Smoke Delivery",
      mobile: deliveryMobile,
      email: deliveryEmail,
      password: "smoke123",
      address: "Smoke Test Address",
      city: "Indore",
      pincode: "452001",
    },
  });
  const createDeliveryJson: any = await createDeliveryRes.json().catch(() => null);
  expect(
    createDeliveryRes.status() === 201 && createDeliveryJson?.success && createDeliveryJson?.data?._id,
    `create delivery boy failed: http=${createDeliveryRes.status()} body=${JSON.stringify(createDeliveryJson)}`
  ).toBeTruthy();
  const deliveryId = createDeliveryJson.data._id as string;

  try {
    const updateDeliveryRes = await ctx.put(`admin/delivery/${deliveryId}`, {
      headers: authHeaders,
      data: { city: "Indore (Updated)" },
    });
    const updateDeliveryJson: any = await updateDeliveryRes.json().catch(() => null);
    expect(
      updateDeliveryRes.ok() && updateDeliveryJson?.success,
      `update delivery boy failed: http=${updateDeliveryRes.status()} body=${JSON.stringify(updateDeliveryJson)}`
    ).toBeTruthy();

    const statusRes = await ctx.patch(`admin/delivery/${deliveryId}/status`, {
      headers: authHeaders,
      data: { status: "Active" },
    });
    const statusJson: any = await statusRes.json().catch(() => null);
    expect(
      statusRes.ok() && statusJson?.success && statusJson?.data?.status === "Active",
      `delivery boy status update failed: http=${statusRes.status()} body=${JSON.stringify(statusJson)}`
    ).toBeTruthy();

    const availabilityRes = await ctx.patch(`admin/delivery/${deliveryId}/availability`, {
      headers: authHeaders,
      data: { available: "Available" },
    });
    const availabilityJson: any = await availabilityRes.json().catch(() => null);
    expect(
      availabilityRes.ok() && availabilityJson?.success && availabilityJson?.data?.available === "Available",
      `delivery boy availability update failed: http=${availabilityRes.status()} body=${JSON.stringify(availabilityJson)}`
    ).toBeTruthy();
  } finally {
    await ctx.delete(`admin/delivery/${deliveryId}`, { headers: authHeaders });
  }

  // ---------- Sellers: list (read-only) ----------
  const sellersRes = await ctx.get("admin/sellers", { headers: authHeaders });
  const sellersJson: any = await sellersRes.json().catch(() => null);
  expect(
    sellersRes.ok() && sellersJson?.success && Array.isArray(sellersJson?.data),
    `GET /admin/sellers failed: http=${sellersRes.status()} body=${JSON.stringify(sellersJson)}`
  ).toBeTruthy();

  // ---------- Sellers: reversible status flip (avoid seller used by seller UI smoke login) ----------
  // NOTE: Seller management CRUD lives under `/sellers` (Admin-only). Admin `/admin/sellers` is read-only.
  const adminSellersRes = await ctx.get("sellers", { headers: authHeaders });
  const adminSellersJson: any = await adminSellersRes.json().catch(() => null);
  expect(
    adminSellersRes.ok() && adminSellersJson?.success && Array.isArray(adminSellersJson?.data),
    `GET /sellers failed: http=${adminSellersRes.status()} body=${JSON.stringify(adminSellersJson)}`
  ).toBeTruthy();

  const sellerSmokeMobile = process.env.PW_SELLER_MOBILE || "9111966732";
  const sellers: any[] = adminSellersJson.data as any[];
  const candidateSeller = sellers.find((s) => s?._id && s?.mobile && String(s.mobile) !== sellerSmokeMobile);
  if (candidateSeller?._id && (candidateSeller.status === "Approved" || candidateSeller.status === "Pending")) {
    const sellerId = candidateSeller._id as string;
    const originalStatus = candidateSeller.status as "Approved" | "Pending";
    const nextStatus = originalStatus === "Approved" ? "Pending" : "Approved";

    try {
      const flip1 = await ctx.patch(`sellers/${sellerId}/status`, {
        headers: authHeaders,
        data: { status: nextStatus },
      });
      const flip1Json: any = await flip1.json().catch(() => null);
      expect(
        flip1.ok() && flip1Json?.success && flip1Json?.data?.status === nextStatus,
        `seller status update failed: http=${flip1.status()} body=${JSON.stringify(flip1Json)}`
      ).toBeTruthy();
    } finally {
      // Best-effort revert.
      await ctx.patch(`sellers/${sellerId}/status`, {
        headers: authHeaders,
        data: { status: originalStatus },
      });
    }
  }

  await ctx.dispose();
});
