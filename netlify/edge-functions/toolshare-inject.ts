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
    ["<p>Borrow the tools you need. Share the tools you don't. Save money, reduce waste, build skills and support Newbiggin.</p>", "<p>Borrow tools from Elizabethan Hall. Donate suitable tools to the Hall; if accepted, they become Hall property.</p>"],
    ["<p><b>Powered by Elizabethan Hall and local people.</b></p>", "<p><b>Operated by Elizabethan Hall.</b></p>"],
    [" tools in the pilot catalogue — Hall equipment plus approved tools passed on by local people.", " tools available to borrow from Elizabethan Hall."],
    ["Newbiggin Toolshare · Powered by Elizabethan Hall and local people", "Newbiggin Toolshare · Operated by Elizabethan Hall"],
    ["Powered by Elizabethan Hall and local people", "Operated by Elizabethan Hall"],
    ["A community tool-sharing service operated by Elizabethan Hall.", "A tool borrowing service operated by Elizabethan Hall."],
    ["community tool-sharing service", "tool borrowing service"],
    ["community lenders", "Elizabethan Hall"],
    ["tools passed on by local people", "tools donated to Elizabethan Hall"],
    ["local people access useful tools", "members borrow useful tools"],
    ["support local people, support Elizabethan Hall", "support Elizabethan Hall"],
    ["<h3>Simple pilot terms</h3>", "<h3>Toolshare terms</h3>"],
    ["These are pilot terms and will be reviewed as the scheme develops.", "These terms apply to all Toolshare members and bookings."],
    ["<h3>£0</h3><p>Pilot hire income</p>", "<h3>£0</h3><p>Hire income</p>"],
    ["<h3>Pilot rules</h3>", "<h3>Toolshare rules</h3>"],
    ["No separate deposit during the pilot.", "A separate deposit is not currently required."],
    ["Simple pilot agreement:", "Toolshare borrowing agreement:"],
    ["Hall-owned pilot equipment.", "Hall-owned equipment."],
    ["In the live version, this is where you will manage your membership, borrowing and Toolshare.", "Sign in here to manage your membership and bookings."],
    ["No active demo loans.", "Sign in to view your bookings."],
    ["<h3>💚 Pass-On Tool</h3>", "<h3>🏛️ Donate a Tool to the Hall</h3>"],
    ["💚 Pass-On Tool", "🏛️ Elizabethan Hall Tool"],
    ["Pass-On Tool submissions", "Tool donation review"],
    ["Pass-on tool submissions", "Tool donation review"],
    ["Pass On a Tool", "Donate a Tool"],
    ["Your unused tools can help a neighbour complete a job without buying something they'll rarely use.", "Donate a tool to Elizabethan Hall. If accepted, it becomes Hall property and may be added to the catalogue for members to borrow."],
    ["Your unwanted tool could help a neighbour complete a job without having to buy equipment they may only use once or twice.", "Donate a usable tool to Elizabethan Hall. If accepted, it becomes Hall property and may be added to the catalogue for members to borrow."],
    ["Review community-owned tools here before they are added to the borrower catalogue.", "Accepted donations become Elizabethan Hall property before staff add them to the catalogue."],
    ["by passing on a tool", "by donating a tool to Elizabethan Hall"],
    ["ownership passes to Elizabethan Hall", "the tool becomes Elizabethan Hall property"],
    ["reimburse the donor at the replacement value recorded in the Toolshare terms", "reimburse Elizabethan Hall at the replacement value recorded for the tool"],
    ["reimburse the donor", "reimburse Elizabethan Hall"],
    ["donor's stated value", "Hall's recorded replacement value"],
    ["If you are unsure how to use a tool safely, please ask before using it.", "Please only use a tool if you know how to operate it safely."],
    ["Safety information and any experience requirements shown for a tool must be followed.", "Please only use a tool if you know how to operate it safely."],
    ["For community-owned tools, the donor remains the owner of the item.", "If Elizabethan Hall accepts a tool donation, it becomes Elizabethan Hall property."],
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
    html = html.replace("</body>", '<script defer src="/assets/toolshare-live.js?v=20261117-mobile-refresh-2"></script></body>');
  }

  const homeCardEnhancement = "<script>(function(){if(document.getElementById(\"toolshare-home-card-details\"))return;var info=[\"These are tools owned and maintained by Elizabethan Hall. Browse the catalogue to check availability and daily hire rates. Collection and returns are arranged at the Hall.\",\"Donate a tool to Elizabethan Hall. If accepted, it becomes Hall property. Elizabethan Hall reviews each tool for safety and suitability before adding it to the catalogue.\",\"Borrowing lets tools be used when they are needed, reduces one-off purchases and helps keep useful equipment in the community.\",\"Daily hire charges help cover tool care and repairs, and replace equipment that is worn or no longer safe to use.\"];var cards=document.querySelectorAll(\"#home > .grid > .card\");cards.forEach(function(card,index){if(index>=info.length)return;card.classList.add(\"home-info-card\");card.setAttribute(\"role\",\"button\");card.setAttribute(\"tabindex\",\"0\");card.setAttribute(\"aria-expanded\",\"false\");var hint=document.createElement(\"span\");hint.className=\"home-card-hint\";hint.textContent=\"More information +\";var details=document.createElement(\"p\");details.className=\"home-card-detail\";details.hidden=true;details.textContent=info[index];card.append(hint,details);var toggle=function(){var open=card.getAttribute(\"aria-expanded\")===\"true\";card.setAttribute(\"aria-expanded\",String(!open));details.hidden=open;hint.textContent=open?\"More information +\":\"Less information −\";};card.addEventListener(\"click\",toggle);card.addEventListener(\"keydown\",function(event){if(event.key===\"Enter\"||event.key===\" \"){event.preventDefault();toggle();}});});if(cards.length){var style=document.createElement(\"style\");style.id=\"toolshare-home-card-details\";style.textContent=\"#home .home-info-card{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}#home .home-info-card:hover,#home .home-info-card:focus-visible{transform:translateY(-2px);box-shadow:0 5px 16px rgba(18,61,43,.18);outline:3px solid #93c6a8;outline-offset:2px}#home .home-card-hint{display:block;margin-top:12px;color:#176b48;font-weight:700;font-size:.9rem}#home .home-card-detail{margin-top:12px;padding-top:12px;border-top:1px solid #d9e6dd;color:#294b39}#home .home-card-detail[hidden]{display:none!important}\";document.head.appendChild(style);}})();</script>";
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
  const cleanLandingHero = '<style id="toolshare-clean-hero">#home .hero{display:block!important;width:min(100%,720px)!important;max-width:720px!important;aspect-ratio:1214/1295!important;height:auto!important;min-height:0!important;padding:0!important;margin:0 auto 18px!important;background-color:#e8efe9!important;background-image:url("/toolshare-hero-v4.jpg?v=20261117-mobile-refresh-1")!important;background-size:100% 100%!important;background-repeat:no-repeat!important;background-position:center!important;box-sizing:border-box!important}#home .heroBox{display:block!important;width:min(calc(100% - 32px),900px)!important;max-width:900px!important;margin:16px auto 24px!important;padding:24px!important;box-sizing:border-box!important;background:#fff!important;color:#173f2c!important;border:1px solid #e1e9e4!important;border-radius:16px!important;box-shadow:0 3px 12px rgba(0,0,0,.08)!important}#home .heroBox h1,#home .heroBox h2,#home .heroBox p,#home .heroBox strong{color:#173f2c!important}#home .heroBox h1{font-size:clamp(1.5rem,2.3vw,1.9rem)!important;line-height:1.12!important;margin-bottom:10px!important}#toolshareHeroActions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}#toolshareHeroActions button{flex:1 1 190px;min-height:48px;padding:12px 16px;font-weight:700}#toolshareHeroActions button:last-child{background:#e97812;color:#fff}@media(max-width:600px){#home .hero{width:100%!important;margin:0 auto 12px!important}#home .heroBox{width:calc(100% - 20px)!important;padding:18px!important;margin:10px auto 18px!important}#home .heroBox h1{font-size:clamp(1.45rem,7vw,1.7rem)!important}#toolshareHeroActions{display:grid;grid-template-columns:1fr;gap:8px}#toolshareHeroActions button{width:100%;min-height:48px}.toolshareStaffScanShortcut{position:static!important;inset:auto!important;display:block!important;width:calc(100% - 24px)!important;margin:14px auto!important}}</style>';
  if (html.includes("</head>") && !html.includes('id="toolshare-clean-hero"')) {
    html = html.replace("</head>", cleanLandingHero + "</head>");
  }


  const landingActions = `<script>(function(){
    if(document.getElementById('toolshareHeroActions'))return;
    var box=document.querySelector('#home .heroBox');
    if(!box)return;
    var oldButton=box.querySelector('button');
    if(oldButton)oldButton.remove();
    var actions=document.createElement('div');
    actions.id='toolshareHeroActions';
    actions.setAttribute('aria-label','Toolshare shortcuts');
    [
      {label:'BROWSE THE TOOLS',page:'borrow'},
      {label:'SHARE YOUR TOOLS',page:'lend'},
      {label:'GET STARTED TODAY',page:'join'}
    ].forEach(function(item){
      var button=document.createElement('button');
      button.type='button';
      button.className='btn';
      button.textContent=item.label;
      button.addEventListener('click',function(){if(typeof window.show==='function')window.show(item.page);});
      actions.appendChild(button);
    });
    box.appendChild(actions);
  })();</script>`;
  if(html.includes('</body>')&&!html.includes('toolshareHeroActions')){
    html=html.replace('</body>',landingActions+'</body>');
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};


