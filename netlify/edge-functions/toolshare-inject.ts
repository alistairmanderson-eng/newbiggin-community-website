export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();

  const publicCopy = [
    ["<title>Newbiggin Toolshare — Pilot</title>", "<title>Newbiggin Toolshare | Elizabethan Hall</title>"],
    [" tools in the pilot catalogue — Hall equipment plus approved tools passed on by local people.", " tools available to borrow from Elizabethan Hall and local people."],
    ["<h3>Simple pilot terms</h3>", "<h3>Toolshare terms</h3>"],
    ["These are pilot terms and will be reviewed as the scheme develops.", "These terms apply to all Toolshare members and bookings."],
    ["<h3>£0</h3><p>Pilot hire income</p>", "<h3>£0</h3><p>Hire income</p>"],
    ["<h3>Pilot rules</h3>", "<h3>Toolshare rules</h3>"],
    ["No separate deposit during the pilot.", "A separate deposit is not currently required."],
    ["Simple pilot agreement:", "Toolshare borrowing agreement:"],
    ["Hall-owned pilot equipment.", "Hall-owned equipment."],
    ["In the live version, this is where you will manage your membership, borrowing and Toolshare.", "Sign in here to manage your membership and bookings."],
    ["No active demo loans.", "Sign in to view your bookings."],
  ];
  for (const [outdated, current] of publicCopy) html = html.replaceAll(outdated, current);

  html = html.replace(/<section id="admin" class="page">[\\s\\S]*?<\\/section>/, '<section id="admin" class="page"><h2>Hall Admin</h2><p>Staff sign in is required to view shared member, payment and booking records.</p></section>');
  const legacyAdminMarker = "<!-- ADMIN DASHBOARD -->";
  const legacyAdminAt = html.indexOf(legacyAdminMarker);
  if (legacyAdminAt >= 0) {
    const legacyScriptStart = html.indexOf("<script>", legacyAdminAt);
    const legacyScriptEnd = html.indexOf("</script>", legacyScriptStart);
    if (legacyScriptStart >= 0 && legacyScriptEnd >= 0) {
      html = html.slice(0, legacyAdminAt) + "<!-- Hall Admin is managed by the authenticated Toolshare dashboard. -->" + html.slice(legacyScriptEnd + "</script>".length);
    }
  }
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

