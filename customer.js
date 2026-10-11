/* ============ PREMVIO — Customer panel ============ */
const S = { user: null, profile: null, settings: {}, products: [], features: [], channel: null, unread: 0, histTab: "all", timer: null };
const root = $("#root");
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });

/* ---------------- start ---------------- */
sb.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") { setTimeout(newPasswordModal, 300); return; }
  if (event === "SIGNED_OUT") { S.user = null; stopLive(); renderAuth(); return; }
  if (session?.user && (!S.user || S.user.id !== session.user.id)) {
    S.user = session.user;
    setTimeout(startApp, 0);
  }
});
sb.auth.getSession().then(({ data }) => { if (!data.session) renderAuth(); });

/* ---------------- auth screens ---------------- */
function renderAuth(mode = "login") {
  root.innerHTML = `
  <div class="auth-wrap"><div class="auth-box">
    <img src="img/logo.png" class="auth-logo" alt="Premvio">
    <p class="center muted mb">Telegram Stars &amp; Premium</p>
    <div class="card">
      <div class="tabs"><button data-m="login" class="${mode === "login" ? "on" : ""}">Log in</button>
        <button data-m="register" class="${mode === "register" ? "on" : ""}">Register</button></div>
      <div id="authBody"></div>
    </div>
  </div></div>`;
  $$(".tabs button", root).forEach((b) => (b.onclick = () => renderAuth(b.dataset.m)));
  const body = $("#authBody");

  if (mode === "login") {
    body.innerHTML = `<form id="f">
      <label>Email (Gmail)</label><input type="email" name="email" required autocomplete="email" placeholder="you@gmail.com">
      <label>Password</label><input type="password" name="password" required autocomplete="current-password">
      <label>Security check</label><div id="cap"></div>
      <button class="btn block mt">Log in</button>
      <p class="center mt small"><button type="button" class="link-btn" id="forgot">Forgot password?</button></p>
    </form>`;
    const cap = mountCaptcha($("#cap"));
    $("#forgot").onclick = () => renderAuth("forgot");
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (!cap.ok()) { toast("Wrong captcha answer, try again.", "error"); cap.reset(); return; }
      busy($("button.btn", f), async () => {
        const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
        if (error) { cap.reset(); throw error; }
      });
    };
  } else if (mode === "register") {
    body.innerHTML = `<form id="f">
      <label>Full name</label><input name="full_name" required autocomplete="name" maxlength="80">
      <label>Email (Gmail)</label><input type="email" name="email" required autocomplete="email" placeholder="you@gmail.com">
      <label>Phone number</label><input type="tel" name="phone" required autocomplete="tel" placeholder="98XXXXXXXX" maxlength="20">
      <label>Country</label><select name="country" required>${countryOptions("Nepal")}</select>
      <label>Password</label><input type="password" name="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters">
      <label>Confirm password</label><input type="password" name="password2" required minlength="6" autocomplete="new-password">
      <label>Security check</label><div id="cap"></div>
      <button class="btn block mt">Create account</button>
    </form>`;
    const cap = mountCaptcha($("#cap"));
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.password.value !== f.password2.value) { toast("Passwords don't match.", "error"); return; }
      if (!/^[+0-9 ()-]{7,20}$/.test(f.phone.value.trim())) { toast("Enter a valid phone number.", "error"); return; }
      if (!cap.ok()) { toast("Wrong captcha answer, try again.", "error"); cap.reset(); return; }
      busy($("button.btn", f), async () => {
        const { data, error } = await sb.auth.signUp({
          email: f.email.value.trim(),
          password: f.password.value,
          options: {
            data: { full_name: f.full_name.value.trim(), phone: f.phone.value.trim(), country: f.country.value },
            emailRedirectTo: location.origin + location.pathname,
          },
        });
        if (error) { cap.reset(); throw error; }
        if (!data.session) {
          body.innerHTML = `<div class="empty"><div class="big">📩</div>
            <h3>Check your email</h3><p>We sent a confirmation link to <b>${esc(f.email.value)}</b>. Open it, then log in.</p>
            <button class="btn block mt" id="toLogin">Go to login</button></div>`;
          $("#toLogin").onclick = () => renderAuth("login");
        }
      });
    };
  } else {
    body.innerHTML = `<form id="f"><h3>Reset password</h3>
      <p class="muted small">Enter your email and we'll send a reset link.</p>
      <label>Email</label><input type="email" name="email" required>
      <label>Security check</label><div id="cap"></div>
      <button class="btn block mt">Send reset link</button>
      <p class="center mt small"><button type="button" class="link-btn" id="back">Back to login</button></p></form>`;
    const cap = mountCaptcha($("#cap"));
    $("#back").onclick = () => renderAuth("login");
    $("#f").onsubmit = (e) => {
      e.preventDefault();
      if (!cap.ok()) { toast("Wrong captcha answer.", "error"); cap.reset(); return; }
      busy($("button.btn", e.target), async () => {
        const { error } = await sb.auth.resetPasswordForEmail(e.target.email.value.trim(), { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        toast("Reset link sent. Check your email.", "success");
      });
    };
  }
}

function newPasswordModal() {
  openModal(`<h2>Set a new password</h2><form id="np">
    <label>New password</label><input type="password" name="p" minlength="6" required>
    <button class="btn block mt">Save password</button></form>`, (m) => {
    $("#np", m).onsubmit = (e) => {
      e.preventDefault();
      busy($("button", e.target), async () => {
        const { error } = await sb.auth.updateUser({ password: e.target.p.value });
        if (error) throw error;
        closeModal(); toast("Password updated.", "success");
      });
    };
  });
}

/* ---------------- app shell ---------------- */
const TABS = [
  { id: "home", label: "Home", icon: ICONS.home },
  { id: "features", label: "New", icon: ICONS.spark },
  { id: "wallet", label: "Wallet", icon: ICONS.wallet },
  { id: "history", label: "History", icon: ICONS.clock },
  { id: "settings", label: "Settings", icon: ICONS.gear },
];

async function startApp() {
  root.innerHTML = `<div class="loader"></div>`;
  try {
    await Promise.all([loadProfile(), loadSettings()]);
  } catch (e) { toast(errMsg(e), "error"); return; }
  if (S.profile.blocked) {
    root.innerHTML = `<div class="auth-wrap"><div class="card center"><h2>Account blocked</h2>
      <p class="muted">Please contact ${esc(S.settings.telegram_username || "support")} on Telegram.</p>
      <button class="btn mt" id="lo">Log out</button></div></div>`;
    $("#lo").onclick = () => sb.auth.signOut();
    return;
  }
  applyTheme(S.profile.theme);
  root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <img src="img/logo.png" alt="">
      <div class="grow"><div class="title">Premvio</div><div class="small muted" id="hello"></div></div>
      <button class="icon-btn" id="bell" aria-label="Notifications">${ICONS.bell}<span class="dot hidden" id="bellDot"></span></button>
    </header>
    <main id="view"></main>
  </div>
  <nav class="bottom-nav"><div class="inner">${TABS.map((t) =>
    `<button class="nav-item" data-tab="${t.id}">${t.icon}<span>${t.label}</span></button>`).join("")}</div></nav>`;
  $("#hello").textContent = "Hi, " + (S.profile.full_name || "there").split(" ")[0];
  $$(".nav-item").forEach((b) => (b.onclick = () => (location.hash = b.dataset.tab)));
  $("#bell").onclick = showNotifications;
  window.onhashchange = route;
  route();
  startLive();
  refreshUnread();
  if (S.profile.notify && pushSupported() && Notification.permission === "granted") enablePush(true);
}

async function loadProfile() {
  const { data, error } = await sb.from("profiles").select("*").eq("id", S.user.id).single();
  if (error) throw error;
  S.profile = data;
}
async function loadSettings() {
  const { data } = await sb.from("app_settings").select("*");
  S.settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}
function tgHandle() { return (S.settings.telegram_username || "@premvio").trim(); }
function tgLink() { return "https://t.me/" + tgHandle().replace(/^@/, ""); }

function route() {
  const tab = (location.hash || "#home").slice(1);
  const t = TABS.find((x) => x.id === tab) ? tab : "home";
  $$(".nav-item").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  clearInterval(S.timer);
  const view = $("#view");
  view.className = "view";
  void view.offsetWidth;
  view.className = "view";
  ({ home: viewHome, features: viewFeatures, wallet: viewWallet, history: viewHistory, settings: viewSettings })[t](view);
  window.scrollTo(0, 0);
}

/* ---------------- live updates ---------------- */
function startLive() {
  stopLive();
  S.channel = sb.channel("me-" + S.user.id)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${S.user.id}` }, (p) => {
      S.profile = { ...S.profile, ...p.new };
      $$("[data-balance]").forEach((el) => (el.textContent = money(S.profile.balance)));
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${S.user.id}` }, (p) => {
      toast(p.new.title + (p.new.body ? " — " + p.new.body : ""), "success");
      refreshUnread();
      const tab = (location.hash || "#home").slice(1);
      if (["wallet", "history", "settings"].includes(tab)) route();
    })
    .subscribe();
}
function stopLive() { if (S.channel) { sb.removeChannel(S.channel); S.channel = null; } }

async function refreshUnread() {
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
  S.unread = count || 0;
  const d = $("#bellDot");
  if (d) { d.textContent = S.unread > 9 ? "9+" : S.unread; d.classList.toggle("hidden", !S.unread); }
}
async function showNotifications() {
  openModal(`<h2>Notifications</h2><div id="nl"><div class="loader"></div></div>`);
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(40);
  const nl = $("#nl");
  if (!nl) return;
  nl.innerHTML = data?.length ? data.map((n) => `
    <div class="list-item"><div class="ic">${n.read ? "🔔" : "🟦"}</div>
      <div class="grow"><b>${esc(n.title)}</b><div class="small muted">${esc(n.body)}</div>
      <div class="small muted">${fmtDate(n.created_at)}</div></div></div>`).join("")
    : `<div class="empty"><div class="big">🔕</div>No notifications yet</div>`;
  await sb.rpc("mark_notifications_read");
  refreshUnread();
}

function balanceCard() {
  return `<div class="balance-card">
    <div class="label">Your balance</div>
    <div class="amount" data-balance>${money(S.profile.balance)}</div>
    <div class="row between">
      <span class="member">Member ID: <b>${esc(S.profile.member_id)}</b></span>
      <button class="btn sm" onclick="copyText('${esc(S.profile.member_id)}')">${ICONS.copy} Copy</button>
    </div>
  </div>
  <div class="money-actions mt">
    <a class="btn deposit" href="#wallet" onclick="setTimeout(()=>document.getElementById('depCard')?.scrollIntoView({behavior:'smooth'}),80)">${ICONS.cash} Deposit</a>
    <a class="btn withdraw" href="#wallet" onclick="setTimeout(()=>document.getElementById('wdCard')?.scrollIntoView({behavior:'smooth'}),80)">${ICONS.wallet} Withdraw</a>
  </div>`;
}

/* ---------------- HOME ---------------- */
async function viewHome(v) {
  const showPush = pushSupported() && Notification.permission === "default" && S.profile.notify;
  v.innerHTML = `${balanceCard()}
    ${showPush ? `<div class="card mt row"><div class="grow"><b>Turn on notifications</b><div class="small muted">Get alerts for orders, loads and withdrawals.</div></div>
      <button class="btn sm" id="pushOn">Allow</button></div>` : ""}
    <h2 class="mt">Products</h2>
    <div id="plist"><div class="loader"></div></div>`;
  if (showPush) $("#pushOn").onclick = async (e) => { if (await enablePush()) { toast("Notifications on.", "success"); e.target.closest(".card").remove(); } };
  const { data, error } = await sb.from("products").select("*").eq("active", true).order("sort").order("created_at", { ascending: false });
  if (error) { $("#plist").innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
  S.products = data;
  $("#plist").innerHTML = data.length ? `<div class="products">${data.map((p) => `
    <button class="product" data-id="${p.id}">
      <div class="ph">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : `<span style="color:var(--gold);width:44px">${ICONS.star}</span>`}</div>
      <div class="info"><div class="name">${esc(p.name)}</div><div class="price">${money(p.price)}</div></div>
    </button>`).join("")}</div>`
    : `<div class="empty"><div class="big">🛍️</div>No products yet. Check back soon!</div>`;
  $$(".product", v).forEach((b) => (b.onclick = () => productModal(S.products.find((p) => p.id == b.dataset.id))));
}

function productModal(p) {
  openModal(`
    ${p.image_url ? `<img class="hero" src="${esc(p.image_url)}" alt="">` : ""}
    <h2>${esc(p.name)}</h2>
    <div class="price" style="color:var(--gold);font-weight:800;font-size:1.3rem">${money(p.price)}</div>
    <p class="muted mt" style="white-space:pre-wrap">${esc(p.description || "No description.")}</p>
    <button class="btn block gold mt" id="buyBtn">${ICONS.bag} Buy now</button>`, (m) => {
    $("#buyBtn", m).onclick = () => buyModal(p);
  });
}

function fieldInput(f) {
  const name = `f_${esc(f.id)}`, req = f.required ? "required" : "", ph = esc(f.placeholder || "");
  let saved = "";
  try { saved = localStorage.getItem("pv_field_" + f.label.toLowerCase()) || ""; } catch (e) {}
  const label = `<label>${esc(f.label)}${f.required ? "" : ' <span class="muted">(optional)</span>'}</label>`;
  if (f.type === "select") return label + `<select name="${name}" ${req}><option value="">Choose…</option>${(f.options || []).map((o) => `<option ${saved === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  if (f.type === "textarea") return label + `<textarea name="${name}" ${req} maxlength="500" placeholder="${ph}"></textarea>`;
  if (f.type === "number") return label + `<input type="number" step="any" name="${name}" ${req} placeholder="${ph}" inputmode="decimal">`;
  return label + `<input name="${name}" ${req} maxlength="200" placeholder="${ph}" value="${esc(saved)}">`;
}
function buyModal(p) {
  const fields = p.fields || [];
  openModal(`<h2>Buy ${esc(p.name)}</h2>
    <p class="muted small">Price: ${money(p.price)} each · Your balance: <b data-balance>${money(S.profile.balance)}</b></p>
    <form id="bf">
      <label>Quantity <span class="muted">(${p.min_qty}–${p.max_qty})</span></label>
      <input type="number" name="qty" min="${p.min_qty}" max="${p.max_qty}" step="1" value="${p.min_qty}" required inputmode="numeric">
      ${fields.map(fieldInput).join("")}
      <div class="card mt row between" style="box-shadow:none"><span class="muted">Total</span><b id="tot" style="font-size:1.2rem;color:var(--gold)"></b></div>
      <p class="small muted mt" id="warn"></p>
      <button class="btn block gold mt">Confirm purchase</button>
    </form>`, (m) => {
    const f = $("#bf", m);
    const calc = () => {
      const t = Math.max(0, Math.floor(Number(f.qty.value) || 0)) * Number(p.price);
      $("#tot", m).textContent = money(t);
      const low = t > Number(S.profile.balance);
      $("#warn", m).innerHTML = low ? `⚠️ Not enough balance. <a href="#wallet" data-close>Deposit money</a>` : "The amount will be deducted from your balance.";
      return t;
    };
    f.qty.oninput = calc; calc();
    f.onsubmit = (e) => {
      e.preventDefault();
      const qty = Math.floor(Number(f.qty.value));
      if (qty < p.min_qty || qty > p.max_qty) { toast(`Quantity must be ${p.min_qty}–${p.max_qty}.`, "error"); return; }
      const form = {};
      for (const fd of fields) {
        let v = (f.elements["f_" + fd.id]?.value || "").trim();
        if (/telegram/i.test(fd.label) && v && !v.startsWith("@") && !/^\+?\d/.test(v)) v = "@" + v;
        form[fd.id] = v;
      }
      if (calc() > Number(S.profile.balance)) { toast("Not enough balance.", "error"); return; }
      busy($("button.btn", f), async () => {
        const { data, error } = await sb.rpc("place_order", { p_product: p.id, p_quantity: qty, p_form: form });
        if (error) throw error;
        try { fields.forEach((fd) => { if (form[fd.id] && fd.type !== "textarea") localStorage.setItem("pv_field_" + fd.label.toLowerCase(), form[fd.id]); }); } catch (e) {}
        await loadProfile();
        openModal(`<div class="empty"><div class="big">✅</div><h2>Order #${data} placed</h2>
          <p>We'll deliver <b>${esc(p.name)}</b> soon. You'll get a notification when it's done.</p>
          <button class="btn block mt" data-close>OK</button></div>`);
        $$("[data-balance]").forEach((el) => (el.textContent = money(S.profile.balance)));
      });
    };
  });
}

/* ---------------- NEW FEATURES ---------------- */
async function viewFeatures(v) {
  v.innerHTML = `<h2>What's coming next</h2><p class="muted">New features we're working on.</p><div id="fl"><div class="loader"></div></div>`;
  const { data } = await sb.from("features").select("*").order("created_at", { ascending: false });
  $("#fl").innerHTML = data?.length ? data.map((f) => `
    <div class="card feature">
      ${f.image_url ? `<img src="${esc(f.image_url)}" alt="" loading="lazy">` : `<div class="ic" style="width:56px;height:56px;border-radius:12px;background:var(--card-2);display:grid;place-items:center;color:var(--gold);flex:0 0 auto"><span style="width:26px">${ICONS.spark}</span></div>`}
      <div class="grow"><h3>${esc(f.title)}</h3>
        ${f.eta ? `<span class="badge pending">🗓 ${esc(f.eta)}</span>` : ""}
        <p class="muted small mt" style="white-space:pre-wrap">${esc(f.description)}</p></div>
    </div>`).join("") : `<div class="empty"><div class="big">✨</div>Nothing announced yet.</div>`;
}

/* ---------------- LOAD / WITHDRAW ---------------- */
async function viewWallet(v) {
  v.innerHTML = `${balanceCard()}
  <div class="card mt" id="depCard">
    <h2 style="color:var(--green)">Deposit</h2>
    <p class="muted">To add money, message us on Telegram with your Member ID. An agent will deposit it to your balance.</p>
    <div class="row wrap mt">
      <a class="btn deposit grow" href="${esc(tgLink())}" target="_blank" rel="noopener">${ICONS.send} Message ${esc(tgHandle())}</a>
      <button class="btn soft" onclick="copyText('${esc(S.profile.member_id)}')">${ICONS.copy} ${esc(S.profile.member_id)}</button>
    </div>
  </div>
  <div class="card" id="wdCard"><h2 style="color:var(--red)">Withdraw</h2><div id="wd"><div class="loader"></div></div></div>`;
  const { data: active } = await sb.from("withdrawals").select("*").eq("status", "pending").order("created_at", { ascending: false });
  const wd = $("#wd");
  if (!wd) return;
  let html = "";
  (active || []).forEach((w) => {
    html += `<div class="code-box mb">
      <div class="small muted">Show this code to an agent</div>
      <div class="code mono">${esc(w.code)}</div>
      <div><b>${money(w.amount)}</b> · ${esc(w.city)}, ${esc(w.street)}</div>
      <div class="small mt" data-exp="${esc(w.expires_at)}" style="color:var(--orange);font-weight:700">${timeLeft(w.expires_at)}</div>
      <div class="row mt" style="justify-content:center">
        <button class="btn sm soft" onclick="copyText('${esc(w.code)}')">${ICONS.copy} Copy</button>
        <button class="btn sm ghost" data-cancel="${w.id}">Cancel &amp; refund</button>
      </div>
      <p class="small muted mt">If no agent pays you within the time limit, the money comes back to your balance automatically.</p>
    </div>`;
  });
  const kyc = S.profile.kyc_status;
  if (kyc !== "approved") {
    html += `<div class="empty" style="padding:14px"><div class="big">🪪</div>
      <b>${kyc === "pending" ? "Your KYC is being reviewed" : "KYC verification required"}</b>
      <p class="muted small">${kyc === "pending" ? "You can withdraw once it is approved. We'll notify you." : "Complete KYC in Settings before you can withdraw."}</p>
      ${kyc === "pending" ? "" : `<a class="btn mt" href="#settings">Complete KYC</a>`}</div>`;
  } else if (!active?.length) {
    const min = Number(S.settings.min_withdraw || 0);
    html += `<form id="wf">
      <p class="muted small">You'll get a code valid for ${esc(S.settings.withdraw_hours || 24)} hours. An agent uses it to pay you cash.</p>
      <label>Amount (${CFG.CURRENCY})</label><input type="number" name="amount" min="${min}" step="0.01" required inputmode="decimal" placeholder="Minimum ${min}">
      <label>City</label><input name="city" required maxlength="60">
      <label>Street / area</label><input name="street" required maxlength="120">
      <button class="btn block withdraw mt">Get withdrawal code</button></form>`;
  }
  wd.innerHTML = html;
  $$("[data-cancel]", wd).forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox("Cancel withdrawal?", "The amount will go back to your balance.", "Cancel code", true))) return;
    const { error } = await sb.rpc("cancel_withdrawal", { p_id: Number(b.dataset.cancel) });
    if (error) return toast(errMsg(error), "error");
    toast("Cancelled and refunded.", "success"); await loadProfile(); route();
  }));
  const wf = $("#wf");
  if (wf) wf.onsubmit = (e) => {
    e.preventDefault();
    const amt = Number(wf.amount.value);
    if (amt > Number(S.profile.balance)) { toast("Not enough balance.", "error"); return; }
    busy($("button.btn", wf), async () => {
      const { error } = await sb.rpc("request_withdrawal", { p_amount: amt, p_city: wf.city.value, p_street: wf.street.value });
      if (error) throw error;
      toast("Withdrawal code created.", "success");
      await loadProfile(); route();
    });
  };
  S.timer = setInterval(() => $$("[data-exp]").forEach((el) => (el.textContent = timeLeft(el.dataset.exp))), 30000);
}

/* ---------------- HISTORY ---------------- */
const TX_NAME = { load: "Deposit", adjust: "Admin adjustment", withdraw: "Withdrawal", purchase: "Purchase", refund: "Refund", agent_load: "Deposit to customer", agent_payout: "Withdrawal paid" };
const TX_ICON = { adjust: "💰", load: "💰", withdraw: "🏧", purchase: "🛍️", refund: "↩️", agent_load: "📤", agent_payout: "📥" };
async function viewHistory(v) {
  v.innerHTML = `<h2>History</h2><p class="muted small">Last 30 days</p>
    <div class="chips">${[["all", "All"], ["orders", "Orders"], ["withdrawals", "Withdrawals"]].map(([k, l]) =>
      `<button class="chip ${S.histTab === k ? "on" : ""}" data-h="${k}">${l}</button>`).join("")}</div>
    <div class="card" id="hl"><div class="loader"></div></div>`;
  $$(".chip", v).forEach((c) => (c.onclick = () => { S.histTab = c.dataset.h; viewHistory(v); }));
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const hl = $("#hl");
  let rows = [];
  if (S.histTab === "all") {
    const { data } = await sb.from("transactions").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    rows = (data || []).map((t) => `<div class="list-item"><div class="ic">${TX_ICON[t.type] || "•"}</div>
      <div class="grow"><b>${esc(t.type === "adjust" ? (t.amount >= 0 ? "Deposit" : "Withdrawal") : TX_NAME[t.type] || t.type)}</b>
      <div class="small muted">${esc(t.description || "")}</div><div class="small muted">${fmtDate(t.created_at)}</div></div>
      <div class="${t.amount >= 0 ? "amt-pos" : "amt-neg"}">${t.amount >= 0 ? "+" : "−"}${money(Math.abs(t.amount)).replace(CFG.CURRENCY + " ", "")}</div></div>`);
  } else if (S.histTab === "orders") {
    const { data } = await sb.from("orders").select("*").gte("created_at", since).order("created_at", { ascending: false });
    rows = (data || []).map((o) => `<div class="list-item"><div class="ic">🛍️</div>
      <div class="grow"><b>#${o.id} ${esc(o.product_name)} × ${o.quantity}</b>
      <div class="small muted">${esc((o.form_data || []).filter((x) => x.value).map((x) => x.value).join(" · "))}</div>
      <div class="small muted">${fmtDate(o.created_at)}</div>
      ${o.admin_note ? `<div class="small muted">Note: ${esc(o.admin_note)}</div>` : ""}</div>
      <div style="text-align:right"><div class="amt-neg">${money(o.total)}</div><span class="badge ${o.status}">${o.status}</span></div></div>`);
  } else {
    const { data } = await sb.from("withdrawals").select("*").gte("created_at", since).order("created_at", { ascending: false });
    rows = (data || []).map((w) => `<div class="list-item"><div class="ic">🏧</div>
      <div class="grow"><b class="mono">${esc(w.code)}</b><div class="small muted">${esc(w.city)}, ${esc(w.street)} · ${fmtDate(w.created_at)}</div></div>
      <div style="text-align:right"><div><b>${money(w.amount)}</b></div><span class="badge ${w.status}">${w.status}</span></div></div>`);
  }
  hl.innerHTML = rows.length ? rows.join("") : `<div class="empty"><div class="big">🗂️</div>Nothing here yet</div>`;
}

/* ---------------- SETTINGS ---------------- */
async function viewSettings(v) {
  const p = S.profile;
  const { data: kyc } = await sb.from("kyc").select("*").eq("user_id", p.id).maybeSingle();
  const kycBadge = { none: "Not submitted", pending: "Under review", approved: "Verified", rejected: "Rejected" }[p.kyc_status];
  v.innerHTML = `
  <h2>Settings</h2>
  <div class="card">
    <div class="row"><img src="img/logo.png" style="width:52px"><div class="grow">
      <b>${esc(p.full_name)}</b><div class="small muted">${esc(p.email)}</div>
      <div class="small muted">ID ${esc(p.member_id)} · ${esc(p.phone || "")} · ${esc(p.country || "")}</div></div></div>
  </div>

  <div class="card">
    <div class="row between"><h3 style="margin:0">KYC verification</h3><span class="badge ${p.kyc_status === "none" ? "" : p.kyc_status}">${kycBadge}</span></div>
    <div id="kycBox" class="mt"></div>
  </div>

  <div class="card">
    <h3>Preferences</h3>
    <div class="setting-row"><div><b>Light theme</b><div class="small muted">Switch between dark and light</div></div>
      <label class="switch" style="margin:0"><input type="checkbox" id="thm" ${p.theme === "light" ? "checked" : ""}><span></span></label></div>
    <div class="setting-row"><div><b>Notifications</b><div class="small muted">Push alerts on this device</div></div>
      <label class="switch" style="margin:0"><input type="checkbox" id="ntf" ${p.notify ? "checked" : ""}><span></span></label></div>
  </div>

  <div class="card">
    <h3>Account</h3>
    <div class="setting-row"><b>Password</b><button class="btn sm soft" id="chPass">Change</button></div>
    <div class="setting-row"><div><b>Email</b><div class="small muted">${esc(p.email)}</div></div><button class="btn sm soft" id="chMail">Change</button></div>
    <div class="setting-row"><div><b>Phone</b><div class="small muted">${esc(p.phone || "—")}</div></div><button class="btn sm soft" id="chPhone">Change</button></div>
    <div class="setting-row"><div><b>Install app</b><div class="small muted">Add Premvio to your home screen</div></div><button class="btn sm soft" id="inst">Install</button></div>
  </div>
  <button class="btn ghost block mt" id="logout">${ICONS.logout} Log out</button>
  <p class="center small muted mt">Need help? <a href="${esc(tgLink())}" target="_blank" rel="noopener">${esc(tgHandle())}</a></p>`;

  // KYC
  const kb = $("#kycBox");
  if (p.kyc_status === "approved" || p.kyc_status === "pending") {
    kb.innerHTML = kyc ? `<div class="small">
      <div class="setting-row"><span class="muted">Name</span><b>${esc(kyc.full_name)}</b></div>
      <div class="setting-row"><span class="muted">Document</span><b>${esc(kyc.doc_type)} · ${esc(kyc.doc_number)}</b></div>
      <div class="setting-row"><span class="muted">Region / City</span><b>${esc(kyc.region)}, ${esc(kyc.city)}</b></div></div>
      ${p.kyc_status === "pending" ? `<p class="small muted mt">We're reviewing your details. You'll be notified.</p>` : ""}` : "";
  } else {
    kb.innerHTML = `${p.kyc_status === "rejected" && kyc?.note ? `<p class="small" style="color:var(--red)">Reason: ${esc(kyc.note)}</p>` : ""}
      <p class="small muted">Required before you can withdraw money.</p>
      <form id="kf">
        <label>Full name (as on document)</label><input name="full_name" required value="${esc(kyc?.full_name || p.full_name)}">
        <label>Document type</label><select name="doc_type" required>
          ${["Citizenship", "Passport", "National ID", "Driving License", "Voter ID"].map((d) => `<option ${kyc?.doc_type === d ? "selected" : ""}>${d}</option>`).join("")}</select>
        <label>Document number</label><input name="doc_number" required value="${esc(kyc?.doc_number || "")}">
        <div class="grid-2"><div><label>Region / Province</label><input name="region" required value="${esc(kyc?.region || "")}"></div>
        <div><label>City</label><input name="city" required value="${esc(kyc?.city || "")}"></div></div>
        <button class="btn block mt">Submit KYC</button>
      </form>`;
    $("#kf").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      busy($("button", f), async () => {
        const { error } = await sb.rpc("submit_kyc", { p_full_name: f.full_name.value, p_doc_type: f.doc_type.value,
          p_doc_number: f.doc_number.value, p_region: f.region.value, p_city: f.city.value });
        if (error) throw error;
        toast("KYC submitted for review.", "success");
        await loadProfile(); route();
      });
    };
  }

  $("#thm").onchange = async (e) => {
    const t = e.target.checked ? "light" : "dark";
    applyTheme(t); S.profile.theme = t;
    await sb.from("profiles").update({ theme: t }).eq("id", p.id);
  };
  $("#ntf").onchange = async (e) => {
    const on = e.target.checked;
    if (on) {
      const ok = await enablePush();
      if (!ok) { e.target.checked = false; return; }
    } else {
      await disablePush();
    }
    await sb.from("profiles").update({ notify: on }).eq("id", p.id);
    S.profile.notify = on;
    toast(on ? "Notifications on." : "Notifications off.", "success");
  };
  $("#chPass").onclick = () => openModal(`<h2>Change password</h2><form id="cp">
      <label>Current password</label><input type="password" name="old" required>
      <label>New password</label><input type="password" name="n1" minlength="6" required>
      <label>Confirm new password</label><input type="password" name="n2" minlength="6" required>
      <button class="btn block mt">Save</button></form>`, (m) => {
    $("#cp", m).onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.n1.value !== f.n2.value) return toast("New passwords don't match.", "error");
      busy($("button", f), async () => {
        const { error: e1 } = await sb.auth.signInWithPassword({ email: p.email, password: f.old.value });
        if (e1) throw new Error("Current password is wrong.");
        const { error } = await sb.auth.updateUser({ password: f.n1.value });
        if (error) throw error;
        closeModal(); toast("Password changed.", "success");
      });
    };
  });
  $("#chMail").onclick = () => openModal(`<h2>Change email</h2><form id="cm">
      <label>New email</label><input type="email" name="email" required>
      <p class="small muted mt">We'll send confirmation links to your old and new email. The change applies after you confirm.</p>
      <button class="btn block mt">Send confirmation</button></form>`, (m) => {
    $("#cm", m).onsubmit = (e) => {
      e.preventDefault();
      busy($("button", e.target), async () => {
        const { error } = await sb.auth.updateUser({ email: e.target.email.value.trim() }, { emailRedirectTo: location.origin + location.pathname });
        if (error) throw error;
        closeModal(); toast("Check your email to confirm the change.", "success");
      });
    };
  });
  $("#chPhone").onclick = () => openModal(`<h2>Change phone</h2><form id="cph">
      <label>New phone number</label><input type="tel" name="phone" required value="${esc(p.phone || "")}">
      <label>Country</label><select name="country">${countryOptions(p.country || "Nepal")}</select>
      <button class="btn block mt">Save</button></form>`, (m) => {
    $("#cph", m).onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      if (!/^[+0-9 ()-]{7,20}$/.test(f.phone.value.trim())) return toast("Enter a valid phone number.", "error");
      busy($("button", f), async () => {
        const { error } = await sb.from("profiles").update({ phone: f.phone.value.trim(), country: f.country.value }).eq("id", p.id);
        if (error) throw error;
        await loadProfile(); closeModal(); toast("Phone updated.", "success"); route();
      });
    };
  });
  $("#inst").onclick = async () => {
    if (isStandalone()) return toast("Premvio is already installed.", "success");
    if (installEvt) { installEvt.prompt(); installEvt = null; return; }
    openModal(`<h2>Install Premvio</h2>
      <p><b>iPhone (Safari):</b> tap the Share button, then <b>Add to Home Screen</b>.</p>
      <p><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Add to Home screen</b> or <b>Install app</b>.</p>
      <button class="btn block mt" data-close>Got it</button>`);
  };
  $("#logout").onclick = async () => {
    if (!(await confirmBox("Log out?", "You can log in again any time.", "Log out"))) return;
    await disablePush().catch(() => {});
    await sb.auth.signOut();
    location.hash = "";
  };
}
