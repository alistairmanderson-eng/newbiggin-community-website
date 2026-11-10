import { acceptInvite, getUser, handleAuthCallback, login, logout, requestPasswordRecovery, signup, updateUser } from "@netlify/identity";

import { catalogueImportMarkup, initCatalogueImport } from "./catalogue-import.js";
const api = async (name, options = {}) => {
  const response = await fetch(`/.netlify/functions/${name}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
};
const byId = (id) => document.getElementById(id);
const statusText = (message, error = false) => {
  const box = byId("liveToolshareStatus");
  if (box) { box.textContent = message; box.style.color = error ? "#a00" : "#17442f"; }
};
const accountSection = byId("account");
if (accountSection) {
  const card = accountSection.querySelector(".card");
  if (card && !byId("liveToolshareAuth")) {
    const auth = document.createElement("div");
    auth.id = "liveToolshareAuth";
    auth.innerHTML = `<div class="notice" style="margin:12px 0"><b>Member sign in</b><div style="display:grid;gap:8px;margin-top:8px"><label>Email address<br><input id="liveLoginEmail" type="email" autocomplete="username" style="width:100%;padding:10px"></label><label>Password<br><input id="liveLoginPassword" type="password" autocomplete="current-password" style="width:100%;padding:10px"></label><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="liveLoginButton" class="btn">Sign in</button><button id="liveLogoutButton" class="btn alt" type="button">Sign out</button><button id="liveForgotPassword" class="btn alt" type="button">Forgot password?</button></div></div><div id="liveIdentityAction"></div><p id="liveToolshareStatus" role="status" aria-live="polite"></p></div>`;
    card.insertBefore(auth, card.children[1] || null);
    byId("liveLoginButton").onclick = async () => {
      try { await login(byId("liveLoginEmail").value.trim(), byId("liveLoginPassword").value); const membership = await refreshMember(); const pending = localStorage.getItem("toolsharePendingContribution"); if (membership?.member?.membershipStatus !== "active" && pending !== null) await startCheckout(Number(pending)); }
      catch (error) { statusText(error.message || "Sign in failed.", true); }
    };
    byId("liveForgotPassword").onclick = async () => {
      const email = byId("liveLoginEmail").value.trim();
      if (!email) { statusText("Enter your account email above, then choose Forgot password?", true); byId("liveLoginEmail").focus(); return; }
      try { await requestPasswordRecovery(email); statusText("If an account matches that email, Netlify has sent a password reset link. Check your inbox and spam folder."); }
      catch (error) { statusText(error.message || "We could not request a password reset. Please try again.", true); }
    };
    byId("liveLogoutButton").onclick = async () => {
      await logout(); statusText("You are signed out.");
      byId("accountMembership").textContent = "Sign in to view your membership.";
    };
  }
}

function showIdentityPasswordForm(mode, token) {
  show("account");
  const host = byId("liveIdentityAction");
  if (!host) return;
  const isInvite = mode === "invite";
  host.innerHTML = `<div class="card" style="margin-top:12px"><h3>${isInvite ? "Accept your Toolshare invitation" : "Choose a new password"}</h3><p>${isInvite ? "Set a password to activate your account." : "Enter a new password for your Toolshare account."}</p>${isInvite ? '<label>Email address<br><input id="liveInviteEmail" type="email" autocomplete="email" style="width:100%;padding:10px"></label>' : ""}<label>New password<br><input id="liveNewPassword" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:10px"></label><label>Confirm new password<br><input id="liveConfirmPassword" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:10px"></label><button id="liveSavePassword" class="btn" type="button">${isInvite ? "Accept invitation" : "Save new password"}</button></div>`;
  byId("liveSavePassword").onclick = async () => {
    const password = byId("liveNewPassword").value;
    const confirmation = byId("liveConfirmPassword").value;
    if (password.length < 8) { statusText("Choose a password with at least 8 characters.", true); return; }
    if (password !== confirmation) { statusText("The passwords do not match. Please enter them again.", true); return; }
    const button = byId("liveSavePassword");
    button.disabled = true;
    try {
      if (isInvite) {
        const email = byId("liveInviteEmail").value.trim();
        if (!email) { statusText("Enter the email address the invitation was sent to.", true); button.disabled = false; return; }
        await acceptInvite(token, password);
        await login(email, password);
        statusText("Invitation accepted. You are signed in; choose Admin in the menu to open Hall Admin.");
      } else {
        await updateUser({ password });
        statusText("Password updated. You are signed in; choose Admin in the menu to open Hall Admin.");
      }
      byId("accountName").textContent = "Welcome to Newbiggin Toolshare.";
      byId("accountMembership").textContent = "Your account is ready.";
      host.innerHTML = "";
    } catch (error) {
      statusText(error.message || "The password could not be updated. Please request a fresh email link and try again.", true);
      button.disabled = false;
    }
  };
}

function updateFirstVisitInstructions() {
  const proof = byId("proofAddress");
  if (proof) {
    const label = proof.closest("label");
    const next = label?.nextElementSibling;
    if (label) label.remove();
    if (next?.classList.contains("muted")) next.remove();
  }
  const localNotice = [...document.querySelectorAll(".notice")].find((el) => el.textContent.includes("Local membership"));
  if (localNotice && !localNotice.textContent.includes("At your first tool collection")) localNotice.innerHTML = "<b>Local membership</b><br>At your first tool collection, bring photo ID (a driving licence or passport) and proof of address, such as a utility bill dated within the last 3 months. Staff will check these at your first visit.";
  const paymentNote = byId("payItForwardPaymentNote");
  if (paymentNote && !paymentNote.textContent.includes("added to your SumUp checkout")) paymentNote.textContent = "Your selected contribution will be added to your SumUp checkout with the £30 annual membership. Elizabethan Hall allocates sponsored memberships.";
  const checkoutCopy = [...(byId("signup")?.querySelectorAll("p") || [])].find((p) => p.textContent.includes("After your membership details"));
  if (checkoutCopy && !checkoutCopy.textContent.includes("When you continue")) checkoutCopy.textContent = "When you continue, you will go to secure SumUp checkout for the £30 annual membership plus any Pay It Forward contribution you selected. Your membership activates after SumUp confirms payment. Daily tool hire charges remain separate.";
}

function readProfile() {
  return {
    firstName: byId("firstName")?.value.trim() || "",
    lastName: byId("lastName")?.value.trim() || "",
    address: byId("address")?.value.trim() || "",
    town: byId("town")?.value.trim() || "",
    postcode: byId("postcode")?.value.trim().toUpperCase() || "",
    mobile: byId("mobile")?.value.trim() || "",
  };
}
function validProfile(profile) {
  return Object.values(profile).every(Boolean);
}
async function startCheckout(contributionAmount) {
  const result = await api("start-membership-checkout", {
    method: "POST", body: JSON.stringify({ contributionAmount }),
  });
  window.location.assign(result.checkoutUrl);
}
async function refreshMember() {
  const user = await getUser();
  if (!user) {
    byId("accountMembership").textContent = "Sign in to view your membership.";
    return null;
  }
  byId("accountName").textContent = `Welcome, ${user.name || user.email}!`;
  const result = await api("my-membership");
  if (result.member?.membershipStatus === "active") {
    byId("accountMembership").textContent = `Universal membership — £30 per year · active until ${new Date(result.member.expiresAt).toLocaleDateString("en-GB")}`;
    statusText("Your membership is active.");
  } else {
    byId("accountMembership").textContent = "Your membership is awaiting payment confirmation.";
    statusText("Your account is signed in. Complete payment to activate your membership.");
  }
  return result;
}

window.createAccount = async function createLiveToolshareAccount() {
  if (!window.selectedMembership) { alert("Please choose the £30 annual membership first."); return; }
  const profile = readProfile();
  const email = byId("email")?.value.trim().toLowerCase() || "";
  const password = byId("password")?.value || "";
  const valid = byId("age18")?.checked && byId("agree")?.checked;
  const contribution = typeof window.updatePayItForwardAmount === "function" ? window.updatePayItForwardAmount() : 0;
  if (!email || !email.includes("@") || password.length < 8 || !validProfile(profile) || !valid) {
    alert("Complete all contact and address fields, use a password of at least 8 characters, and confirm your age and the terms."); return;
  }
  if (!valid) return;
  if (!byId("age18")?.checked || !byId("agree")?.checked) { alert("Please confirm you are 18 or over and agree to the terms."); return; }
  if (!Number.isFinite(contribution) || contribution < 0 || (byId("payItForwardAmount")?.value === "custom" && contribution <= 0)) {
    alert("Enter a valid Pay It Forward amount, or choose no contribution."); return;
  }
  localStorage.setItem("toolsharePendingContribution", String(contribution));
  const signupButton = document.querySelector('#signup button[onclick*="createAccount"]');
  if (signupButton) { signupButton.disabled = true; signupButton.textContent = "Creating your account…"; }
  try {
    await signup(email, password, {
      full_name: `${profile.firstName} ${profile.lastName}`,
      toolshareProfile: profile,
    });
    const user = await getUser();
    if (!user) {
      show("account");
      byId("liveLoginEmail").value = email;
      statusText("Check your email to confirm your account, then sign in here to continue to secure payment.");
      return;
    }
    await startCheckout(contribution);
  } catch (error) {
    show("account");
    byId("liveLoginEmail").value = email;
    statusText(`${error.message || "Account setup could not be completed."} If you already have an account, sign in to continue.`, true);
  } finally {
    if (signupButton) { signupButton.disabled = false; signupButton.textContent = "CONTINUE TO SECURE PAYMENT"; }
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  updateFirstVisitInstructions();
  const textObserver = new MutationObserver(updateFirstVisitInstructions);
  textObserver.observe(document.body, { childList: true, subtree: true });
  let authCallback;
  try { authCallback = await handleAuthCallback(); } catch (error) { statusText(error.message || "Account link could not be completed.", true); }
  if (authCallback?.type === "invite" && authCallback.token) {
    showIdentityPasswordForm("invite", authCallback.token);
  } else if (authCallback?.type === "recovery") {
    showIdentityPasswordForm("recovery");
  } else if (authCallback?.type === "confirmation") {
    show("account");
    statusText("Your email is confirmed. Sign in here to continue.");
  }
  try { await refreshMember(); } catch (error) { console.warn("Membership status is temporarily unavailable."); }
  const url = new URL(location.href);
  if (url.searchParams.get("payment") === "return" && url.searchParams.has("ref")) {
    show("account");
    const reference = url.searchParams.get("ref");
    statusText("Checking your SumUp payment…");
    try {
      let result;
      for (let attempt = 0; attempt < 4; attempt++) {
        result = await api(`membership-payment-status?ref=${encodeURIComponent(reference)}`);
        if (result.status === "paid") break;
        await new Promise((resolve) => setTimeout(resolve, 1800));
      }
      if (result?.status === "paid") {
        localStorage.removeItem("toolsharePendingContribution");
        statusText(result.emailStatus === "sent" ? "Payment confirmed. Your membership is active, and a confirmation email has been sent." : "Payment confirmed and your membership is active. Email confirmation is not ready yet; please contact Elizabethan Hall if you need help.");
        await refreshMember();
      } else statusText("SumUp has not confirmed the payment yet. Your membership will activate after confirmation; please refresh this page shortly.", true);
    } catch (error) { statusText(error.message || "We could not check the payment yet. Please refresh shortly.", true); }
  }
});

// Block new bookings unless the member is signed in with an active paid membership.
const originalBookingForm = window.showV14Booking;
if (typeof originalBookingForm === "function") {
  window.showV14Booking = async function (tool) {
    try {
      const result = await api("my-membership");
      if (result.member?.membershipStatus !== "active") {
        alert("Sign in and complete your annual membership payment before booking tools.");
        show("account");
        return;
      }
      return originalBookingForm.call(this, tool);
    } catch (error) {
      alert(error.message || "Sign in and complete your membership before booking tools.");
      show("account");
    }
  };
}

const h = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const gbp = (v) => `£${Number(v || 0).toFixed(2)}`;
const staffUser = (u) => u?.roles?.includes("admin") || u?.appMetadata?.roles?.includes("admin") || u?.app_metadata?.roles?.includes("admin");

let liveTools = [];
function renderLiveCatalogue() {
  const box=byId("toolList"); if(!box)return;
  const category=byId("cat"), search=byId("v12SearchInput"), query=(search?.value||byId("search")?.value||"").trim().toLowerCase();
  const selected=category?.value||"";
  if(category){const categories=[...new Set(liveTools.map(t=>t.category).filter(Boolean))].sort();const value=selected;category.innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${h(c)}">${h(c)}</option>`).join("");if(categories.includes(value))category.value=value;}
  const matches=liveTools.filter(t=>(!selected||t.category===selected)&&`${t.name} ${t.category} ${t.notes} ${t.safety} ${t.suitableUses||""} ${t.additionalItems||""}`.toLowerCase().includes(query));
  window.renderTools=renderLiveCatalogue;
  box.innerHTML=matches.length?matches.map(t=>`<div class="card tool"><div class="pic">${h(t.icon||"🛠️")}</div><div><div class="row"><h3>${h(t.name)}</h3><span class="tag">${t.type==="Community"?"💚 Pass-On Tool":"🏛️ Hall Tool"}</span></div><span class="tag">${h(t.category)}</span> <span class="tag">£${Number(t.rate||0).toFixed(2)}/day</span>${t.weeklyRate===null||t.weeklyRate===undefined?"":` <span class="tag">£${Number(t.weeklyRate).toFixed(2)}/week</span>`}<p class="muted">${h(t.condition||"Condition checked at collection")} · Collection at Elizabethan Hall</p>${t.notes?`<p>${h(t.notes)}</p>`:""}${t.suitableUses?`<p><b>Suitable uses:</b> ${h(t.suitableUses)}</p>`:""}${t.additionalItems?`<p><b>Additional items:</b> ${h(t.additionalItems)}</p>`:""}${t.safety?`<p><b>Safety:</b> ${h(t.safety)}</p>`:""}<button type="button" class="btn" data-live-borrow="${h(t.id)}">View & borrow</button></div></div>`).join(""):'<div class="card">No tools found.</div>';
  for(const button of box.querySelectorAll("[data-live-borrow]")){button.onclick=()=>{const tool=liveTools.find(t=>String(t.id)===button.dataset.liveBorrow);if(tool&&typeof window.showV14Booking==="function")window.showV14Booking(tool);else alert("Booking is temporarily unavailable. Please refresh and try again.");};}
}
async function loadCatalogue() {
  const { tools: list } = await api("catalogue");
  liveTools=list;
  if (Array.isArray(window.tools)) window.tools.splice(0, window.tools.length, ...list);
  localStorage.setItem("toolshareApprovedCatalogue", JSON.stringify(list.filter(x => x.type === "Community")));
  const search=byId("v12SearchInput"), category=byId("cat");
  if(search)search.oninput=renderLiveCatalogue;
  if(category)category.onchange=renderLiveCatalogue;
  if(byId("v12SearchBtn"))byId("v12SearchBtn").onclick=renderLiveCatalogue;
  if(byId("v12ClearBtn"))byId("v12ClearBtn").onclick=()=>{if(search)search.value="";if(byId("search"))byId("search").value="";if(category)category.value="";renderLiveCatalogue();};
  if(byId("search"))byId("search").oninput=renderLiveCatalogue;
  renderLiveCatalogue();
}
async function renderLiveLoans() {
  const box = byId("loanBox"); if (!box) return;
  try {
    const { bookings } = await api("bookings");
    box.innerHTML = bookings.length ? bookings.map(b => {
      const qr = encodeURIComponent(JSON.stringify({v:1,id:b.id,tool:b.toolName,start:b.start,end:b.end,total:b.total}));
      return `<div class="card"><h3>${h(b.toolName)}</h3><p>Reference: <b>${h(b.id)}</b></p><p>Collection ${h(b.start)} · Return ${h(b.end)}</p><p>Hire ${gbp(b.total)} · ${h(b.collectionStatus)} · ${h(b.paymentStatus)}</p><img width="180" height="180" alt="Booking QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qr}"><p>Show this Collection Pass at Elizabethan Hall.</p></div>`;
    }).join("") : "<p>No bookings yet.</p>";
  } catch(e) { box.textContent = e.message || "Sign in to view your bookings."; }
}
function addDonorFields() {
  const name=byId("lendName"), email=byId("lendEmail"); if(!name||!email||byId("lendDonorName"))return;
  const fields=document.createElement("div"); fields.innerHTML='<label>Donor full name<br><input id="lendDonorName" autocomplete="name" required></label><label>Donor phone number<br><input id="lendPhone" type="tel" autocomplete="tel" required></label><label>Donor address<br><input id="lendAddress" autocomplete="street-address" required></label>';
  name.closest("label").parentNode.insertBefore(fields,name.closest("label"));
  email.required=true; [name,byId("lendDescription"),email,byId("lendValue")].forEach(x=>{if(x)x.required=true});
  const safety=byId("lendSafety"); if(safety){safety.required=true;safety.placeholder="List requirements, or enter None known";}
  const note=document.querySelector("#lend .notice"); if(note&&!byId("lendSafetyConfirmed")){const p=document.createElement("p");p.innerHTML='<label><input id="lendSafetyConfirmed" type="checkbox"> I have listed known safety and experience requirements, or written “None known”.</label>';note.appendChild(p);}
}
window.submitDonor = async function(){
  const data={donorName:byId("lendDonorName")?.value||"",email:byId("lendEmail")?.value||"",phone:byId("lendPhone")?.value||"",address:byId("lendAddress")?.value||"",toolName:byId("lendName")?.value||"",category:byId("lendCategory")?.value||"Other",description:byId("lendDescription")?.value||"",condition:byId("lendCondition")?.value||"",safetyRequirements:byId("lendSafety")?.value||"",estimatedValue:byId("lendValue")?.value||0,handoverMethod:document.querySelector('input[name="handover"]:checked')?.value||"Drop-off",preferredDate:byId("lendDate")?.value||null,ownershipConfirmed:!!byId("lendOwner")?.checked,termsConfirmed:!!byId("lendTerms")?.checked,contactConfirmed:!!byId("lendContact")?.checked,safetyConfirmed:!!byId("lendSafetyConfirmed")?.checked};
  try{await api("donations",{method:"POST",body:JSON.stringify(data)});alert("Thank you. Your complete submission has been sent to Elizabethan Hall for review. We will contact you by email about the decision and handover.");document.querySelectorAll("#lend input").forEach(x=>{if(x.type==="checkbox")x.checked=false;else if(x.type!=="radio")x.value="";});}
  catch(e){alert(e.message||"Please complete all donor contact, tool and confirmation fields.");} return false;
};
async function renderLiveDonations(){
  const box=byId("donorAdminList");if(!box)return;box.innerHTML="Loading…";
  try{const {submissions}=await api("donations");box.innerHTML=submissions.length?submissions.map(x=>{const mail=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(x.donor_email)}&su=${encodeURIComponent(`Newbiggin Toolshare: ${x.tool_name}`)}`;const actions=x.status==="pending"?`<button class="btn" onclick="approveLiveDonation('${h(x.id)}')">Approve and add to catalogue</button> <button class="btn alt" onclick="rejectLiveDonation('${h(x.id)}')">Reject</button>`:`<span class="tag">${h(x.status)}</span>`;return `<div class="card"><h3>${h(x.tool_name)}</h3><p><b>Donor:</b> ${h(x.donor_name)} · ${h(x.category)} · ${h(x.condition)}</p><p><a href="${mail}" target="_blank" rel="noopener">${h(x.donor_email)} — reply in Gmail</a></p><p><b>Phone:</b> ${h(x.donor_phone)} · <b>Address:</b> ${h(x.donor_address)}</p><p>${h(x.description)}</p><p><b>Safety:</b> ${h(x.safety_requirements)}</p><p><b>Handover:</b> ${h(x.handover_method)} ${h(x.preferred_date||"")}</p><p><b>Estimated value:</b> ${gbp(x.estimated_value)}</p>${actions}</div>`}).join(""):"<p>No pass-on tool submissions yet.</p>"}
  catch(e){box.textContent=e.message||"Staff sign-in is required.";}
}
window.approveLiveDonation=async id=>{const rate=prompt("Set the daily hire rate for this tool (£ per day):","2");if(rate===null)return;try{await api("donations",{method:"PATCH",body:JSON.stringify({id,action:"approve",dailyRate:rate})});await loadCatalogue();await renderLiveDonations();alert("Approved and added to the shared catalogue.")}catch(e){alert(e.message||"Could not approve this tool.")}};
window.rejectLiveDonation=async id=>{if(!confirm("Reject this submission?"))return;try{await api("donations",{method:"PATCH",body:JSON.stringify({id,action:"reject"})});await renderLiveDonations()}catch(e){alert(e.message||"Could not reject this submission.")}};
async function findStaffBooking(ref,target){const box=byId(target);if(!box)return;try{const {bookings}=await api(`bookings?ref=${encodeURIComponent(ref)}`);const b=bookings[0];if(!b){box.textContent="Booking not found. Check the reference.";return;}const action=b.collectionStatus==="awaiting_collection"?"collect":b.collectionStatus==="collected"?"return":"";box.innerHTML=`<div class="card"><h3>${h(b.toolName)}</h3><p>Reference ${h(b.id)} · Member ${h(b.email)}</p><p>Collection ${h(b.start)} · Return ${h(b.end)} · Hire ${gbp(b.total)}</p><p>${h(b.collectionStatus)} · ${h(b.paymentStatus)}</p>${action?`<button id="staffRecordAction" class="btn">${action==="collect"?"Record collection and payment":"Record return"}</button>`:""}</div>`;if(action)byId("staffRecordAction").onclick=async()=>{try{await api("bookings",{method:"PATCH",body:JSON.stringify({id:b.id,action})});await findStaffBooking(b.id,target)}catch(e){box.insertAdjacentText("afterbegin",e.message)}}}catch(e){box.textContent=e.message||"Staff sign-in is required."}}
async function showAdmin(){const user=await getUser();if(!staffUser(user)){window.show("account");statusText("Hall Admin is restricted to staff accounts. Sign in with an account assigned the admin role.",true);return;}const gate=byId("adminLoginBox");if(gate)gate.remove();const dash=byId("adminDashboard");if(dash)dash.remove();window.__toolshareOriginalShow?.("admin");const page=byId("admin");page.innerHTML='<h2>Hall Admin</h2><p>Shared membership, payment, booking and donation records.</p><div class="grid"><div class="card"><h3 id="liveMembers">—</h3><p>Active members</p></div><div class="card"><h3 id="liveIncome">—</h3><p>Confirmed membership income</p></div><div class="card"><h3 id="liveForward">—</h3><p>Confirmed Pay It Forward</p></div><div class="card"><h3 id="liveOut">—</h3><p>Tools out</p></div></div>${catalogueImportMarkup}<div class="card"><h3>Pass-on tool submissions</h3><div id="donorAdminList">Loading…</div></div><div class="card"><h3>Collection and return</h3><input id="liveStaffRef" placeholder="Booking reference"><button id="liveStaffFind" class="btn">Find booking</button><div id="liveStaffResult"></div></div><button id="liveAdminSignOut" class="btn alt">Sign out</button>';try{const {report:r}=await api("admin-data");byId("liveMembers").textContent=r.active_members||0;byId("liveIncome").textContent=gbp(r.membership_income);byId("liveForward").textContent=gbp(r.contributions);byId("liveOut").textContent=r.tools_out||0;await renderLiveDonations();await initCatalogueImport({api,onPublished:loadCatalogue})}catch(e){statusText(e.message||"Admin data could not be loaded.",true)}byId("liveStaffFind").onclick=()=>findStaffBooking(byId("liveStaffRef").value.trim(),"liveStaffResult");byId("liveAdminSignOut").onclick=async()=>{await logout();window.show("home")};if(byId("staffFindBooking"))byId("staffFindBooking").onclick=()=>findStaffBooking(byId("staffBookingRef")?.value.trim()||"","staffBookingResult");if(byId("staffFindReturn"))byId("staffFindReturn").onclick=()=>findStaffBooking(byId("staffReturnRef")?.value.trim()||"","staffReturnResult")}
const savedShow=window.show;window.__toolshareOriginalShow=savedShow;window.show=async function(id){if(id==="admin"){await showAdmin();return}if(id==="borrow"){try{await loadCatalogue()}catch(e){alert(e.message||"The shared catalogue is temporarily unavailable.")}return savedShow.call(this,id)}savedShow.call(this,id);if(id==="loans")await renderLiveLoans();if(id==="account")try{await refreshMember()}catch{}};
window.renderDonorAdmin=renderLiveDonations;window.renderLoans=renderLiveLoans;
const savedBookingForm=window.showV14Booking;if(typeof savedBookingForm==="function")window.showV14Booking=async function(tool){try{const m=await api("my-membership");if(m.member?.membershipStatus!=="active"){alert("Sign in and complete your annual membership payment before booking tools.");window.show("account");return}await savedBookingForm.call(this,tool);const button=byId("v14Confirm");if(!button)return;button.onclick=async()=>{const start=byId("v14Start")?.value,end=byId("v14End")?.value;if(!start||!end||end<start){if(byId("v14Error"))byId("v14Error").textContent="Choose valid collection and return dates.";return}const suffix=Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>(n%36).toString(36)).join("").toUpperCase(),id=`TS-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${suffix}`;button.disabled=true;try{const {booking:b}=await api("bookings",{method:"POST",body:JSON.stringify({id,toolId:tool.id,start,end})});const qr=encodeURIComponent(JSON.stringify({v:1,id:b.id,tool:b.toolName,start:b.start,end:b.end,total:b.total}));byId("toolList").innerHTML=`<div class="card"><h2>✅ Booking request created</h2><p><b>${h(b.toolName)}</b></p><p>Collection ${h(b.start)} · Return ${h(b.end)}</p><p>Hire ${gbp(b.total)} (${b.days} day${b.days===1?"":"s"})</p><p>Bring your booking confirmation and photo ID for your first collection.</p><div class="card"><h3>Toolshare Collection Pass</h3><b>${h(b.id)}</b><br><img width="220" height="220" alt="Booking QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qr}"><p>Hire payment: cash or card at collection.</p></div><button class="btn" onclick="show('loans')">View my bookings</button></div>`}catch(e){if(byId("v14Error"))byId("v14Error").textContent=e.message||"The booking could not be saved.";button.disabled=false}}}catch(e){alert(e.message||"Sign in and complete your membership before booking tools.");window.show("account")}};
window.addEventListener("DOMContentLoaded",()=>{addDonorFields();byId("adminLoginBox")?.remove();byId("adminDashboard")?.remove();const b=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Admin");if(b)b.onclick=()=>window.show("admin")});

