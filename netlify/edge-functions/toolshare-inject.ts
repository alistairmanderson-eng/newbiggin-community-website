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

  const homeCardEnhancement = "<script>(function(){if(document.getElementById(\"toolshare-home-card-details\"))return;var info=[\"These are tools owned and maintained by Elizabethan Hall. Browse the catalogue to check availability and daily hire rates. Collection and returns are arranged at the Hall.\",\"Donate a usable tool to help neighbours. Elizabethan Hall reviews each submission for suitability and safety before it can appear in the catalogue.\",\"Borrowing lets tools be used when they are needed, reduces one-off purchases and helps keep useful equipment in the community.\",\"Daily hire charges help cover tool care and repairs, and replace equipment that is worn or no longer safe to use.\"];var cards=document.querySelectorAll(\"#home > .grid > .card\");cards.forEach(function(card,index){if(index>=info.length)return;card.classList.add(\"home-info-card\");card.setAttribute(\"role\",\"button\");card.setAttribute(\"tabindex\",\"0\");card.setAttribute(\"aria-expanded\",\"false\");var hint=document.createElement(\"span\");hint.className=\"home-card-hint\";hint.textContent=\"More information +\";var details=document.createElement(\"p\");details.className=\"home-card-detail\";details.hidden=true;details.textContent=info[index];card.append(hint,details);var toggle=function(){var open=card.getAttribute(\"aria-expanded\")===\"true\";card.setAttribute(\"aria-expanded\",String(!open));details.hidden=open;hint.textContent=open?\"More information +\":\"Less information −\";};card.addEventListener(\"click\",toggle);card.addEventListener(\"keydown\",function(event){if(event.key===\"Enter\"||event.key===\" \"){event.preventDefault();toggle();}});});if(cards.length){var style=document.createElement(\"style\");style.id=\"toolshare-home-card-details\";style.textContent=\"#home .home-info-card{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}#home .home-info-card:hover,#home .home-info-card:focus-visible{transform:translateY(-2px);box-shadow:0 5px 16px rgba(18,61,43,.18);outline:3px solid #93c6a8;outline-offset:2px}#home .home-card-hint{display:block;margin-top:12px;color:#176b48;font-weight:700;font-size:.9rem}#home .home-card-detail{margin-top:12px;padding-top:12px;border-top:1px solid #d9e6dd;color:#294b39}#home .home-card-detail[hidden]{display:none!important}\";document.head.appendChild(style);}})();</script>";
  if (html.includes("</body>") && !html.includes("toolshare-home-card-details")) {
    html = html.replace("</body>", homeCardEnhancement + "</body>");
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
  const cleanLandingHero = '<style id="toolshare-clean-hero">#home .hero{width:min(100%,900px)!important;max-width:900px!important;aspect-ratio:1214/1295!important;height:auto!important;min-height:0!important;padding:0!important;margin:0 auto 18px!important;background-size:100% 100%!important;background-repeat:no-repeat!important;background-position:center!important;box-sizing:border-box!important}#home .heroBox{width:min(100% - 44px,1080px)!important;max-width:1080px!important;margin:16px auto 24px!important;padding:24px!important;box-sizing:border-box!important;background:#fff!important;color:#173f2c!important;border:1px solid #e1e9e4!important;box-shadow:0 3px 12px rgba(0,0,0,.08)!important}#home .heroBox h1,#home .heroBox h2,#home .heroBox p,#home .heroBox strong{color:#173f2c!important}#home .heroBox h1{font-size:clamp(1.6rem,2.8vw,2.1rem)!important;line-height:1.12!important;margin-bottom:10px!important}@media(max-width:600px){#home .hero{width:100%!important;margin-bottom:14px!important}#home .heroBox{width:calc(100% - 24px)!important;padding:18px!important;margin:12px auto 18px!important}#home .heroBox h1{font-size:clamp(1.5rem,7vw,1.8rem)!important}}</style>';
  if (html.includes("</head>") && !html.includes('id="toolshare-clean-hero"')) {
    html = html.replace("</head>", cleanLandingHero + "</head>");
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

