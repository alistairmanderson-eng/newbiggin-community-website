export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const html = await response.text();
  if (!html.includes("</body>") || html.includes("/assets/toolshare-live.js")) {
    return new Response(html, response);
  }
  const updated = html.replace("</body>", '<script defer src="/assets/toolshare-live.js"></script></body>');
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(updated, { status: response.status, statusText: response.statusText, headers });
};

