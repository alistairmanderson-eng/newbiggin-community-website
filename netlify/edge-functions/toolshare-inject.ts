export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const escapeBootstrap = `window.esc = window.esc || (value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"));`;
  const firstScript = html.indexOf("<script>");
  if (firstScript >= 0 && !html.includes("window.esc = window.esc ||")) {
    const insertionPoint = firstScript + "<script>".length;
    html = html.slice(0, insertionPoint) + escapeBootstrap + html.slice(insertionPoint);
  }

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

  // Keep the original catalogue search and category filter; remove the duplicate v12 search panel.
  const duplicateSearchOpening = /<div\b(?=[^>]*\bid=["']v12Search["'])[^>]*>/i.exec(html);
  if (duplicateSearchOpening) {
    const divTags = /<\/?div\b[^>]*>/gi;
    divTags.lastIndex = duplicateSearchOpening.index;
    let depth = 0;
    let duplicateSearchEnd = -1;
    let tag;
    while ((tag = divTags.exec(html))) {
      if (tag[0].startsWith("</")) depth -= 1;
      else if (!tag[0].endsWith("/>")) depth += 1;
      if (depth === 0) {
        duplicateSearchEnd = divTags.lastIndex;
        break;
      }
    }
    if (duplicateSearchEnd > duplicateSearchOpening.index) {
      html = html.slice(0, duplicateSearchOpening.index) + html.slice(duplicateSearchEnd);
    }
  }

  // Disable the legacy inline installer that repeatedly recreates the duplicate search panel.
  const duplicateSearchScriptMarker = "// If the original catalogue re-renders, reinstall our search controls.";
  const duplicateSearchScriptAt = html.indexOf(duplicateSearchScriptMarker);
  if (duplicateSearchScriptAt >= 0) {
    const duplicateScriptStart = html.lastIndexOf("<script>", duplicateSearchScriptAt);
    const duplicateScriptEnd = html.indexOf("</script>", duplicateSearchScriptAt);
    if (duplicateScriptStart >= 0 && duplicateScriptEnd >= 0) {
      html = html.slice(0, duplicateScriptStart) + html.slice(duplicateScriptEnd + "</script>".length);
    }
  }

  html = html.replace(/<section id="admin" class="page">[\s\S]*?<\/section>/, '<section id="admin" class="page"><h2>Hall Admin</h2><p>Staff sign in is required to view shared member, payment and booking records.</p></section>');
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

  // Keep the original collage as a clean image area and move its text and call to action below it.
  const divEnd = (source, start) => {
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = start;
    let depth = 0;
    let tag;
    while ((tag = tags.exec(source))) {
      if (tag[0].startsWith("</")) depth -= 1;
      else if (!tag[0].endsWith("/>")) depth += 1;
      if (depth === 0) return tags.lastIndex;
    }
    return -1;
  };
  const heroBoxMatch = /<div\b(?=[^>]*\bclass=["'][^"']*\bheroBox\b[^"']*["'])[^>]*>/i.exec(html);
  if (heroBoxMatch) {
    const heroBoxStart = heroBoxMatch.index;
    const heroBoxEnd = divEnd(html, heroBoxStart);
    if (heroBoxEnd > heroBoxStart) {
      const heroBox = html.slice(heroBoxStart, heroBoxEnd);
      html = html.slice(0, heroBoxStart) + html.slice(heroBoxEnd);
      const heroMatch = /<div\b(?=[^>]*\bclass=["'][^"']*\bhero\b[^"']*["'])[^>]*>/i.exec(html);
      if (heroMatch) {
        const heroEnd = divEnd(html, heroMatch.index);
        if (heroEnd > heroMatch.index) html = html.slice(0, heroEnd) + heroBox + html.slice(heroEnd);
      }
    }
  }
  const cleanLandingHero = '<style id="toolshare-clean-hero">#home .hero{height:280px!important;min-height:280px!important;display:block!important;background-color:#123d2b}#home .heroBox{width:min(100% - 44px,1080px)!important;max-width:1080px!important;margin:16px auto 24px!important;padding:24px!important;box-sizing:border-box!important;background:#fff!important;color:#173f2c!important;border:1px solid #e1e9e4!important;box-shadow:0 3px 12px rgba(0,0,0,.08)!important}#home .heroBox h1,#home .heroBox h2,#home .heroBox p,#home .heroBox strong{color:#173f2c!important}#home .heroBox h1{font-size:clamp(2rem,4vw,3rem)!important;line-height:1.08!important}@media(max-width:600px){#home .heroBox h1{font-size:clamp(1.7rem,8vw,2.25rem)!important}}</style>';
  if (html.includes("</head>") && !html.includes('id="toolshare-clean-hero"')) {
    html = html.replace("</head>", cleanLandingHero + "</head>");
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

