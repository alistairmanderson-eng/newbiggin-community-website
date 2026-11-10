export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const outdatedCheckoutCopy = "After your membership details have been completed, you will be taken to the secure SumUp payment page for the £30 annual membership. If you selected a Pay It Forward amount, the account screen will offer a separate SumUp payment. For custom amounts without a matching fixed link, enter the amount again on SumUp. Toolshare does not receive payment confirmation; Elizabethan Hall must check SumUp.";
  const currentCheckoutCopy = "When you continue, you will go to secure SumUp checkout for the £30 annual membership plus any Pay It Forward contribution you selected. Your membership activates after SumUp confirms payment. Daily tool hire charges remain separate.";
  html = html.replace(outdatedCheckoutCopy, currentCheckoutCopy);
  if (html.includes("</body>") && !html.includes("/assets/toolshare-live.js")) {
    html = html.replace("</body>", '<script defer src="/assets/toolshare-live.js"></script></body>');
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

