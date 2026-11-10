import { json, sumupConfig } from "../lib/toolshare-shared.mts";
import { verifyAndApplyPayment } from "../lib/payment.mts";

export default async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 204 });
  let event;
  try { event = await request.json(); } catch { return new Response(null, { status: 204 }); }
  if (event?.event_type !== "CHECKOUT_STATUS_CHANGED" || typeof event.id !== "string") {
    return new Response(null, { status: 204 });
  }
  try {
    const { apiKey } = sumupConfig();
    const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(event.id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return new Response(null, { status: 503 });
    const checkout = await response.json();
    if (checkout.status !== "PAID" || typeof checkout.checkout_reference !== "string") return new Response(null, { status: 204 });
    await verifyAndApplyPayment(event.id, checkout.checkout_reference);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("SumUp webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return new Response(null, { status: 503 });
  }
};

