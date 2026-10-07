import { createClient } from "@supabase/supabase-js";
const config = __CONFIG__,
  root = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
let client,
  identity,
  view = "overview",
  generation = 0,
  page = 0,
  search = "",
  status = "pending";
const labels = {
  overview: "Overview",
  reports: "Reports",
  screenings: "Flagged submissions",
  readers: "Readers",
  clubs: "Clubs",
  announcements: "Announcements",
  usage: "API & cache",
  audit: "Action history",
  settings: "Settings",
};
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const add = (parent, ...children) => {
  parent.append(...children.filter(Boolean));
  return parent;
};
const button = (text, fn, cls = "secondary") => {
  const b = el("button", text, cls);
  b.type = "button";
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      showError(
        e.message,
        b.closest("dialog") || document.querySelector("main"),
      );
    } finally {
      b.disabled = false;
    }
  };
  return b;
};
const date = (v) => (v ? new Date(v).toLocaleString() : "—");
const name = (r) => r?.display_name || r?.username || "Unavailable reader";
const pretty = (v) => String(v ?? "").replaceAll("_", " ");
const toast = (text) => {
  const n = document.querySelector("#toast");
  n.textContent = text;
  setTimeout(() => (n.textContent = ""), 6500);
};
function showError(text, parent) {
  if (!parent) return;
  parent.querySelector(".error")?.remove();
  parent.append(el("p", text, "error"));
}
function field(
  parent,
  title,
  { value = "", type = "text", max, required = true } = {},
) {
  const id = crypto.randomUUID();
  const label = el("label", title);
  label.htmlFor = id;
  const input = el(type === "textarea" ? "textarea" : "input");
  input.id = id;
  if (type !== "textarea") input.type = type;
  input.value = value ?? "";
  input.required = required;
  if (max) input.maxLength = max;
  add(parent, label, input);
  return input;
}
async function api(action, data = {}) {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new Error("Sign in to continue.");
  const res = await fetch(`${config.url}/functions/v1/novori-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(
      [
        "retry_jobs",
        "publish_announcement",
        "suspend_reader",
        "ban_reader",
        "restore_reader",
      ].includes(action)
        ? 90000
        : 25000,
    ),
  });
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error("The admin service is unavailable. Please try again.");
  }
  if (!res.ok) {
    if (res.status === 401) {
      await client.auth.signOut({ scope: "local" });
      login();
    }
    throw new Error(result.error || "The request could not be completed.");
  }
  return result.data;
}
function openDialog(title, description) {
  dialog.replaceChildren(el("h2", title), el("p", description));
  dialog.showModal();
  return dialog;
}
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
function password(parent, title) {
  const wrapper = el("div");
  const input = field(wrapper, title, { type: "password" });
  input.autocomplete = "current-password";
  const row = el("div", undefined, "password");
  input.remove();
  add(
    row,
    input,
    button("Show", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      row.lastChild.textContent = visible ? "Hide" : "Show";
      row.lastChild.setAttribute(
        "aria-label",
        visible ? "Hide password" : "Show password",
      );
    }),
  );
  wrapper.append(row);
  parent.append(wrapper);
  return input;
}
function login(message) {
  identity = null;
  generation++;
  root.replaceChildren();
  const m = el("main", undefined, "login"),
    logo = el("img", undefined, "logo");
  logo.src = "/novori.png";
  logo.alt = "Novori";
  add(
    m,
    logo,
    el("div", "PRIVATE WORKSPACE", "eyebrow"),
    el("h1", "Novori Admin"),
    el(
      "p",
      "Keep the community welcoming. Sign in with your approved Novori account.",
    ),
  );
  const form = el("form");
  const email = field(form, "Email", { type: "email" });
  email.autocomplete = "username";
  const pw = password(form, "Password");
  const submit = el("button", "Sign in");
  submit.type = "submit";
  add(form, el("br"), submit);
  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      const r = await client.auth.signInWithPassword({
        email: email.value.trim(),
        password: pw.value,
      });
      if (r.error)
        throw new Error("Could not sign in. Check your email and password.");
      await enter();
    } catch (err) {
      showError(err.message, m);
    } finally {
      submit.disabled = false;
    }
  };
  add(
    m,
    form,
    el(
      "p",
      "Admin access is granted privately. Password recovery is available through the Novori app.",
      "hint",
    ),
  );
  if (message) add(m, el("p", message, "error"));
  root.append(m);
}
async function enter() {
  identity = await api("session");
  if (identity.mfa_required) {
    await mfa();
    return;
  }
  renderShell();
  await load();
}
async function mfa() {
  root.replaceChildren();
  const m = el("main", undefined, "login");
  add(
    m,
    el("div", "ACCOUNT SECURITY", "eyebrow"),
    el("h1", "Verify it’s you"),
    el("p", "Use your authenticator app to unlock the admin workspace."),
  );
  root.append(m);
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new Error("Could not load your authenticator settings.");
  let factor = data.totp.find((x) => x.status === "verified");
  if (!factor) {
    for (const old of data.totp.filter((x) => x.status !== "verified"))
      await client.auth.mfa.unenroll({ factorId: old.id });
    const enrolled = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Novori Admin",
    });
    if (enrolled.error) throw new Error("Could not set up the authenticator.");
    factor = enrolled.data;
    const qr = el("img", undefined, "qr");
    qr.alt = "Scan this code with your authenticator app";
    qr.src = factor.totp.qr_code;
    add(m, el("p", "Scan the QR code, then enter the six digit code."), qr);
    const details = el("details");
    add(
      details,
      el("summary", "Can’t scan the code?"),
      el("p", factor.totp.secret, "body-text"),
    );
    m.append(details);
  }
  const form = el("form"),
    code = field(form, "Authenticator code");
  code.inputMode = "numeric";
  code.autocomplete = "one-time-code";
  code.pattern = "[0-9]{6}";
  code.maxLength = 6;
  const submit = el("button", "Verify & continue");
  submit.type = "submit";
  add(form, el("br"), submit);
  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      const r = await client.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.value.trim(),
      });
      if (r.error)
        throw new Error(
          "That code could not be verified. Try the current code.",
        );
      await enter();
    } catch (err) {
      showError(err.message, m);
    } finally {
      submit.disabled = false;
    }
  };
  add(m, form, button("Sign out", signOut, "link"));
}
async function signOut() {
  await client.auth.signOut({ scope: "local" });
  dialog.close();
  login();
}
function renderShell() {
  root.replaceChildren();
  const layout = el("div", undefined, "layout"),
    aside = el("aside"),
    brand = el("div", undefined, "brand"),
    logo = el("img", undefined, "logo");
  logo.src = "/novori.png";
  logo.alt = "";
  add(brand, logo, add(el("div"), "Novori", el("small", "Admin workspace")));
  const nav = el("nav");
  nav.setAttribute("aria-label", "Admin sections");
  for (const [key, label] of Object.entries(labels)) {
    const b = button(label, async () => {
      view = key;
      status = "pending";
      page = 0;
      search = "";
      await load();
    });
    b.dataset.view = key;
    nav.append(b);
  }
  const account = el("div", undefined, "account");
  add(
    account,
    add(
      el("div"),
      el("strong", identity.email),
      el("small", `${identity.role} · authenticator verified`),
    ),
    button("Sign out", signOut, "link"),
  );
  add(aside, brand, nav, account);
  add(layout, aside, el("main", undefined, "workspace"));
  root.append(layout);
}
function heading(main, subtitle) {
  const head = el("div", undefined, "heading");
  add(
    head,
    add(
      el("div"),
      el("div", "NOVORI / ADMIN", "eyebrow"),
      el("h1", labels[view]),
      el("p", subtitle),
    ),
    button("Refresh", () => load()),
  );
  main.append(head);
}
function table(parent, columns, rows) {
  const wrap = el("div", undefined, "table-scroll"),
    t = el("table"),
    thead = el("thead"),
    tr = el("tr");
  columns.forEach((c) => tr.append(el("th", c)));
  thead.append(tr);
  const body = el("tbody");
  for (const values of rows) {
    const row = el("tr");
    for (const value of values) row.append(el("td", value));
    body.append(row);
  }
  add(t, thead, body);
  wrap.append(t);
  parent.append(wrap);
  if (!rows.length) parent.append(el("p", "No entries yet.", "empty"));
}
function pager(main, total) {
  const row = el("div", undefined, "row pager"),
    prev = button("Previous", async () => {
      page--;
      await load();
    }),
    next = button("Next", async () => {
      page++;
      await load();
    });
  prev.disabled = page === 0;
  next.disabled = total !== undefined ? (page + 1) * 50 >= total : false;
  add(
    row,
    prev,
    el(
      "small",
      `Page ${page + 1}${total !== undefined ? ` · ${total} entries` : ""}`,
    ),
    next,
  );
  main.append(row);
}
function list(main, rows, render, onOpen) {
  const l = el("div", undefined, "list");
  rows.forEach((r) => {
    const b = button("", () => onOpen(r));
    b.replaceChildren(...render(r));
    l.append(b);
  });
  if (!rows.length) l.append(el("div", "Nothing here yet.", "empty"));
  main.append(l);
}
async function load() {
  const current = ++generation;
  const main = document.querySelector("main.workspace");
  if (!main) return;
  document.querySelectorAll("nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false");
  });
  main.replaceChildren();
  heading(
    main,
    {
      overview: "A clear view of your community.",
      reports: "Review the context, record the decision, and follow up.",
      screenings: "Review unpublished submissions flagged by safety checks.",
      readers: "Account support and community moderation.",
      clubs: "Keep reading groups healthy.",
      announcements: "Draft and send community updates.",
      usage: "Recorded upstream requests and shared cache activity.",
      audit: "A record of every moderation decision.",
      settings: "Security, alerts, and background processing.",
    }[view],
  );
  const loading = add(
    el("div", undefined, "loading"),
    el("span", undefined, "spinner"),
    el("span", "Loading…"),
  );
  main.append(loading);
  try {
    const data = await api(view === "settings" ? "session" : view, {
      page,
      search,
      status,
    });
    if (current !== generation) return;
    loading.remove();
    await screens[view](main, data);
  } catch (e) {
    if (current !== generation) return;
    loading.remove();
    showError(e.message, main);
    main.append(button("Try again", load));
  }
}
function detail(title, subtitle) {
  generation++;
  const main = document.querySelector("main.workspace");
  main.replaceChildren(
    button(`← Back to ${labels[view].toLowerCase()}`, load, "link"),
  );
  add(main, el("br"), el("h1", title), el("p", subtitle));
  return main;
}
function renderHistory(parent, rows) {
  add(parent, el("h3", "Recent decisions"));
  for (const r of rows ?? [])
    add(
      parent,
      el("p", `${pretty(r.action)} · ${date(r.created_at)}`, "hint"),
      el("p", r.reason, "body-text"),
    );
  if (!rows?.length)
    parent.append(el("p", "No prior decisions recorded.", "hint"));
}
function restrictionText(r) {
  return r?.permanent
    ? "Banned"
    : r?.blocked_until && Date.parse(r.blocked_until) > Date.now()
      ? `Suspended until ${date(r.blocked_until)}`
      : "No active restriction";
}
function decision(
  action,
  target,
  { expected, payload = {}, refresh = load, description } = {},
) {
  const d = openDialog(
    pretty(action).replace(/^./, (c) => c.toUpperCase()),
    description ||
      "Record a clear reason. Reader notices include this reason for warnings and account restrictions.",
  );
  const form = el("form");
  const reason = field(form, "Decision reason", {
    type: "textarea",
    max: 1000,
  });
  reason.minLength = 5;
  let duration;
  if (action === "suspend_reader") {
    const label = el("label", "Suspension duration");
    duration = el("select");
    for (const [hours, text] of [
      [24, "1 day"],
      [168, "7 days"],
      [720, "30 days"],
    ]) {
      const o = el("option", text);
      o.value = hours;
      duration.append(o);
    }
    add(form, label, duration);
  }
  const request_id = crypto.randomUUID();
  let submitted;
  const submit = el(
    "button",
    "Confirm decision",
    action === "ban_reader" || action === "remove_content" ? "danger" : "",
  );
  submit.type = "submit";
  add(
    form,
    add(
      el("div", undefined, "actions"),
      button("Cancel", () => d.close()),
      submit,
    ),
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      submitted ??= {
        target_type: target.type,
        target_id: target.id,
        request_id,
        expected_updated_at: expected,
        reason: reason.value.trim(),
        payload: {
          ...payload,
          ...(duration ? { hours: Number(duration.value) } : {}),
        },
      };
      const result = await api(action, submitted);
      d.close();
      toast(
        result.auth_sync_pending
          ? "Decision saved. Account access is queued for synchronization."
          : action === "publish_announcement"
            ? "Announcement published. Delivery continues in the background."
            : "Decision saved.",
      );
      await refresh();
    } catch (err) {
      showError(err.message, d);
    } finally {
      submit.disabled = false;
    }
  };
  d.append(form);
  reason.focus();
}
const writable = () =>
  identity.role === "owner" || identity.role === "moderator";
const screens = {
  overview(main, d) {
    const cards = el("div", undefined, "cards");
    for (const [key, title] of [
      ["pending_reports", "Reports to review"],
      ["pending_screenings", "Unpublished submissions to review"],
      ["readers", "Readers"],
      ["clubs", "Clubs"],
      ["posts", "Posts"],
      ["auth_jobs", "Account jobs queued"],
      ["pending_alerts", "Report emails queued"],
      ["pending_screening_alerts", "Screening emails queued"],
    ])
      add(
        cards,
        add(
          el("div", undefined, "card"),
          el("small", title),
          el("strong", d[key] ?? "—"),
        ),
      );
    main.append(cards);
    const panel = el("section", undefined, "panel");
    add(
      panel,
      el("h2", "Start with the report inbox"),
      el(
        "p",
        "A report is a request for review. Read the context before deciding whether to dismiss it, remove content, or restrict an account.",
      ),
      button("Review reports", async () => {
        view = "reports";
        page = 0;
        await load();
      }),
    );
    main.append(panel);
    const worker = el("section", undefined, "panel");
    add(
      worker,
      el("h3", "Background processing"),
      el(
        "p",
        d.worker?.last_heartbeat
          ? `Last successful run: ${date(d.worker.last_heartbeat)}`
          : "The background worker has not reported a successful run yet.",
      ),
    );
    main.append(worker);
  },
  reports(main, d) {
    const toolbar = el("div", undefined, "toolbar"),
      select = el("select");
    select.setAttribute("aria-label", "Report status");
    for (const v of ["pending", "reviewed", "actioned", "dismissed", "all"]) {
      const o = el("option", pretty(v));
      o.value = v;
      select.append(o);
    }
    select.value = status;
    select.onchange = async () => {
      status = select.value;
      page = 0;
      await load();
    };
    toolbar.append(select);
    main.append(toolbar);
    main.append(el('p','Priority: 3 distinct reporters = High; 5 = Urgent. Repeated reports by one reader count once. Reports do not automatically remove content.','hint'));
    list(
      main,
      d.rows,
      (r) => [
        add(
          el("div", undefined, "row"),
          el("strong", `${pretty(r.priority ?? 'normal')} · ${pretty(r.reason)} · ${r.target_type}`),
          el("span", r.status, `badge ${r.status}`),
        ),
        el("small", `${r.distinct_reporters ?? 1} distinct reporter(s) · ${date(r.created_at)}`),
      ],
      (r) => showReport(r.id),
    );
    pager(main, d.total);
  },
  screenings(main,d) {
    const select = el('select'); select.setAttribute('aria-label','Screening status');
    for(const value of ['pending','approved','rejected','passed']) { const option=el('option',pretty(value)); option.value=value; select.append(option); }
    select.value=['pending','approved','rejected','passed'].includes(status)?status:'pending';
    select.onchange=async()=>{status=select.value;page=0;await load();}; main.append(select);
    main.append(el('p','New flagged submissions have not been published. Approval allows resubmission; approval of a migrated legacy image restores its delivery. An AI flag is not an automatic account ban.','hint'));
    list(main,d.rows,r=>[el('strong',`${r.priority_rank===3?'Urgent · ':''}${r.surface} · ${pretty(r.state)}`),el('small',`${Object.entries(r.categories??{}).filter(([,flag])=>flag).map(([category])=>category).join(', ') || 'Review'} · ${date(r.created_at)}`)],async r=>{
      try {
        const {item,image}=await api('screening_detail',{id:r.id});
        const panel=el('section',undefined,'panel');
        panel.append(el('h2','Submission review'));
        panel.append(el('pre',JSON.stringify(item.content,null,2),'content-text'));
        if(image) {
          // Reviewers choose to reveal flagged imagery; never automatically display it.
          panel.append(button('Reveal flagged image',async()=>{const fresh=await api('screening_detail',{id:r.id});const img=el('img');img.src=fresh.image;img.alt='Flagged submission';img.style.maxWidth='100%';panel.append(img);},'secondary'));
        }
        if(['pending','rejected'].includes(item.state)&&['owner','moderator'].includes(identity.role)) {
          const requests={approved:crypto.randomUUID(),rejected:crypto.randomUUID()};
          const reason=el('textarea');reason.placeholder='Decision reason (5–1000 characters)';reason.maxLength=1000;reason.setAttribute('aria-label','Screening decision reason');panel.append(reason);
          for(const decisionValue of (item.state==='rejected'?['approved']:['approved','rejected'])) panel.append(button(decisionValue==='approved'?'Approve resubmission':'Reject',async()=>{
            if(reason.value.trim().length<5) return showError('Enter a reason of at least five characters.',panel);
            try {await api('review_screening',{id:item.id,expected_updated_at:item.updated_at,decision:decisionValue,reason:reason.value.trim(),request_id:requests[decisionValue]});dialog.replaceChildren();dialog.close();await load();} catch(e){showError(e.message,panel);}
          },decisionValue==='rejected'?'danger':'secondary'));
        }
        panel.append(button('Close',()=>{dialog.close();dialog.replaceChildren();},'secondary'));dialog.replaceChildren(panel);dialog.showModal();
      }catch(e){showError(e.message,main);}
    });pager(main,d.total);
  },
  readers(main, d) {
    searchbar(main, "Search by username");
    list(
      main,
      d.rows,
      (r) => [
        el("strong", name(r)),
        el(
          "small",
          `@${r.username || "unavailable"} · Joined ${date(r.created_at)}`,
        ),
      ],
      (r) => showReader(r.id),
    );
    pager(main, d.total);
  },
  clubs(main, d) {
    searchbar(main, "Search clubs");
    list(
      main,
      d.rows,
      (r) => [
        el("strong", r.name),
        el(
          "small",
          `${r.privacy || "Club"} · ${r.description || "No description"}`,
        ),
      ],
      (r) => showClub(r.id),
    );
    pager(main, d.total);
  },
  announcements(main, d) {
    if (identity.role === "owner")
      main.append(button("New announcement", () => announcementEditor()));
    list(
      main,
      d.rows,
      (r) => [
        add(
          el("div", undefined, "row"),
          el("strong", r.title),
          el("span", r.state, "badge"),
        ),
        el(
          "small",
          r.state === "published"
            ? `${r.delivered_count} delivered · ${r.delivery_complete ? "Delivery complete" : "Delivery queued"}`
            : `Updated ${date(r.updated_at)}`,
        ),
      ],
      (r) => showAnnouncement(r),
    );
    pager(main, d.total);
  },
  usage(main, d) {
    main.append(el("p", d.note, "hint"));
    if (d.configuration) {
      main.append(
        el(
          "p",
          `Configured book provider: ${pretty(d.configuration.book_provider)} · ISBNdb key: ${d.configuration.isbndb_key_configured ? "configured" : "missing"} · Backend version: ${d.configuration.audit_version}`,
          "hint",
        ),
      );
      if (
        d.configuration.book_provider !== "isbndb" ||
        !d.configuration.isbndb_key_configured
      )
        main.append(
          el(
            "p",
            "ISBNdb routing is not fully configured. Check NOVORI_BOOK_PROVIDER and ISBNDB_API_KEY in Supabase secrets.",
            "hint",
          ),
        );
    } else {
      main.append(
        el(
          "p",
          "Deploy the updated novori-admin Edge Function to load ISBNdb usage and provider configuration.",
          "hint",
        ),
      );
    }
    if (d.utc_window)
      main.append(
        el(
          "p",
          `Today’s UTC window: ${d.utc_window.start} to ${d.utc_window.end}. Compare provider totals for the same window and refresh time.`,
          "hint",
        ),
      );
    main.append(
      el(
        "p",
        `Refreshed ${date(d.refreshed_at)} · daily buckets use UTC`,
        "hint",
      ),
    );
    const cards = el("div", undefined, "cards");
    for (const [provider, title] of [
      ["google_books", "Google Books · legacy counter"],
      ["hardcover", "Hardcover"],
      ["isbndb", "ISBNdb"],
    ]) {
      const totals = d.summary?.[provider];
      const card = add(el("div", undefined, "card"), el("h2", title));
      if (!totals || (provider !== "google_books" && !totals.ready)) {
        card.append(
          el(
            "p",
            "Tracker setup required. Historical provider usage is not included.",
            "hint",
          ),
        );
      } else {
        for (const [key, label] of [
          ["today", "Today"],
          ["days7", "Last 7 days"],
          ["days30", "Last 30 days"],
        ])
          card.append(
            add(
              el("div"),
              el("small", label),
              el("strong", Number(totals[key]).toLocaleString()),
            ),
          );
        card.append(
          el(
            "p",
            provider === "google_books"
              ? `Earliest recorded day: ${totals.first_recorded_day ?? "No requests recorded yet"}. Earlier history may be incomplete.`
              : provider === "isbndb"
                ? `Daily safety limit: ${totals.daily_safety_limit?.toLocaleString() ?? "4,500"}. Last request: ${date(totals.last_request_at)}.`
                : `Recording enabled: ${date(totals.tracking?.enabled_at)}. First request: ${date(totals.tracking?.first_request_at)}. Last request: ${date(totals.tracking?.last_request_at)}.`,
            "hint",
          ),
        );
      }
      cards.append(card);
    }
    main.append(cards);
    const panel = el("section", undefined, "panel");
    add(panel, el("h2", "Daily upstream requests · UTC"));
    table(
      panel,
      ["Day", "Provider", "Requests"],
      (d.rows ?? []).map((r) => [
        r.usage_date,
        pretty(r.provider),
        r.upstream_requests,
      ]),
    );
    main.append(panel);
    main.append(
      el(
        "p",
        "If a provider website differs: refresh both snapshots, compare the daily time windows, and confirm every provider function has the latest deployment. Earlier untracked requests and calls using this key outside Novori are not recoverable from these counters. Counts are never adjusted to match a website without evidence.",
        "hint",
      ),
    );
    const cache = el("section", undefined, "panel");
    add(
      cache,
      el("h2", "Shared book cache"),
      el(
        "p",
        `${d.cache.total ?? "—"} cache records · ${d.cache.sample_size} recent records sampled. These include provider responses, derived metadata and retry controls; they are not API requests. Hit counts belong to the current entries and may reset on refresh.`,
      ),
    );
    table(
      cache,
      ["Provider", "Kind", "Hits", "Fetched", "Expires"],
      d.cache.rows.map((r) => [
        pretty(r.provider),
        r.request_key?.startsWith("publication:")
          ? "Derived publication date"
          : r.request_key?.includes(":retry")
            ? "Retry control"
            : "Provider / derived response",
        r.hit_count,
        date(r.fetched_at),
        date(r.expires_at),
      ]),
    );
    main.append(cache);
  },
  audit(main, d) {
    table(
      main,
      ["When", "Action", "Target", "Reason"],
      d.rows.map((r) => [
        date(r.created_at),
        pretty(r.action),
        `${r.target_type} · ${r.target_id}`,
        r.reason,
      ]),
    );
    pager(main, d.total);
  },
  settings(main, d) {
    const p = el("section", undefined, "panel");
    add(
      p,
      el("h2", "Account security"),
      el("p", `${d.email} · ${d.role}`),
      el(
        "p",
        "An approved role and authenticator verification are checked by the server for every admin request. Sessions are kept in this browser tab.",
      ),
      el("h3", "Report email alerts"),
      el(
        "p",
        d.email_alerts_configured
          ? "Report email delivery is configured."
          : "Report email delivery needs a Resend key on the backend.",
      ),
      button(
        d.email_alerts ? "Disable my email alerts" : "Enable my email alerts",
        async () => {
          await api("alert_preferences", { enabled: !d.email_alerts });
          await load();
        },
      ),
    );
    main.append(p);
    const jobs = el("section", undefined, "panel");
    add(
      jobs,
      el("h2", "Background jobs"),
      el(
        "p",
        d.worker_configured
          ? "Worker credentials are configured. Check Overview for the last successful run."
          : "Worker credentials are not configured. Scheduled processing must be configured before launch.",
      ),
      el(
        "p",
        "Account changes, notification delivery, and report emails are queued durably. A failed operation can retry without losing the decision.",
      ),
    );
    if (identity.role === "owner")
      jobs.append(
        button("Process queued jobs now", async () => {
          const r = await api("retry_jobs");
          toast(
            `${r.synchronized} account updates · ${r.delivered} notifications · ${r.alerts} emails · ${r.failed} failed`,
          );
        }),
      );
    main.append(jobs);
  },
};
function searchbar(main, placeholder) {
  const form = el("form", undefined, "toolbar"),
    input = el("input");
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  input.value = search;
  const b = el("button", "Search");
  b.type = "submit";
  add(form, input, b);
  form.onsubmit = async (e) => {
    e.preventDefault();
    search = input.value.trim();
    page = 0;
    await load();
  };
  main.append(form);
}
async function showReport(id) {
  const d = await api("report_detail", { id });
  const main = detail(
    `${pretty(d.report.reason)} report`,
    `${d.report.target_type} · ${date(d.report.created_at)} · ${d.report.status}`,
  );
  const split = el("div", undefined, "split"),
    context = el("section", undefined, "panel"),
    actions = el("section", undefined, "panel");
  add(
    context,
    el("h2", "Reported content"),
    el(
      "p",
      d.reader
        ? `${name(d.reader)} · @${d.reader.username || "unavailable"}`
        : "Author unavailable",
      "hint",
    ),
    el(
      "p",
      d.content?.body ||
        d.content?.bio ||
        "Content unavailable or already removed.",
      "body-text",
    ),
  );
  if (d.content?.post_image_url || d.content?.avatar_url) {
    context.append(button('Reveal reported image',async()=>{
      const preview=await api('report_image',{id});
      const image=el('img');image.src=preview.image;image.alt='Reported image';image.className='reported-image';context.append(image);
    }));
  }
  if (d.parent)
    add(
      context,
      el("hr", undefined, "divider"),
      el("h3", "Post context"),
      el("p", d.parent.body, "body-text"),
    );
  if (d.thread.length) {
    add(
      context,
      el("h3", "Conversation context"),
      el(
        "p",
        "Up to 100 comments, in time order. Parent IDs identify reply chains.",
        "hint",
      ),
    );
    for (const c of d.thread) {
      const t = el(
        "div",
        undefined,
        `thread ${c.id === d.report.target_id ? "target" : ""}`,
      );
      add(
        t,
        el(
          "small",
          `${c.id === d.report.target_id ? "Reported comment · " : ""}${date(c.created_at)}${c.parent_comment_id ? ` · Reply to ${c.parent_comment_id.slice(0, 8)}` : ""}`,
        ),
        el("p", c.body, "body-text"),
      );
      context.append(t);
    }
  }
  add(
    actions,
    el("h2", "Review & decide"),
    el("p", restrictionText(d.restriction)),
  );
  if (writable()) {
    const target = { type: "report", id },
      options = {
        expected: d.report.updated_at,
        refresh: () => showReport(id),
      };
    for (const [action, label] of [
      ["review_report", "Mark reviewed"],
      ["dismiss_report", "Dismiss report"],
      ...(d.content && d.report.target_type !== "profile"
        ? [["remove_content", "Remove content"]]
        : []),
      ...(d.content?.post_image_url || d.content?.avatar_url ? [["block_reported_image", "Remove image"]] : []),
      ...(d.reader
        ? [
            ["warn_reader", "Warn reader"],
            ["suspend_reader", "Suspend reader"],
            ["ban_reader", "Ban reader"],
          ]
        : []),
    ])
      actions.append(
        button(
          label,
          () =>
            decision(action, target, {
              ...options,
              description:
                action === "remove_content"
                  ? d.report.target_type === "post"
                    ? "This permanently removes the post and its comments. Record why it violates Novori’s rules."
                    : "This removes the comment text and author while preserving other readers’ replies."
                  : undefined,
            }),
          action === "remove_content" || action === "ban_reader"
            ? "danger"
            : "secondary",
        ),
      );
  } else
    actions.append(
      el(
        "p",
        "Your support role can review context. A moderator or owner must record a decision.",
      ),
    );
  if (d.reader)
    actions.append(
      button(
        "Open reader account",
        () => {
          view = "readers";
          return showReader(d.reader.id);
        },
        "link",
      ),
    );
  actions.append(el("hr", undefined, "divider"));
  renderHistory(actions, d.history);
  add(split, context, actions);
  main.append(split);
}
async function showReader(id) {
  const d = await api("reader_detail", { id }),
    main = detail(
      name(d.reader),
      `@${d.reader.username || "unavailable"} · ${restrictionText(d.restriction)}`,
    ),
    split = el("div", undefined, "split"),
    p = el("section", undefined, "panel"),
    h = el("section", undefined, "panel");
  add(
    p,
    el("h2", "Account support"),
    el("p", d.reader.bio || "No profile bio.", "body-text"),
  );
  table(
    p,
    ["Account detail", "Value"],
    [
      ["Email", d.account.email || "Visible to owner and support only"],
      ["Email confirmed", d.account.email_confirmed ? "Yes" : "No"],
      ["Last sign in", date(d.account.last_sign_in_at)],
      ["Auth restriction expires", date(d.account.banned_until)],
      ["Created", date(d.reader.created_at)],
    ],
  );
  if (writable()) {
    const row = el("div", undefined, "actions");
    for (const [action, label] of [
      ["warn_reader", "Warn"],
      ["suspend_reader", "Suspend"],
      ["ban_reader", "Ban"],
      ["restore_reader", "Restore access"],
    ])
      row.append(
        button(
          label,
          () =>
            decision(
              action,
              { type: "reader", id },
              { refresh: () => showReader(id) },
            ),
          action === "ban_reader" ? "danger" : "secondary",
        ),
      );
    p.append(row);
  }
  add(p, el("hr", undefined, "divider"), el("h3", "Recent account jobs"));
  table(
    p,
    ["Status", "Attempts", "Created"],
    d.jobs.map((r) => [r.status, r.attempts, date(r.created_at)]),
  );
  renderHistory(h, d.history);
  add(split, p, h);
  main.append(split);
}
async function showClub(id) {
  const d = await api("club_detail", { id }),
    main = detail(
      d.club.name,
      `${d.club.privacy} · ${d.control?.posting_paused ? "Posting paused" : "Posting enabled"}`,
    ),
    p = el("section", undefined, "panel");
  add(
    p,
    el("h2", "Club details"),
    el("p", d.club.description || "No description.", "body-text"),
    el("h3", "Rules"),
    el("p", d.club.rules || "No rules provided.", "body-text"),
    el("p", `${d.members.length} members shown (maximum 100).`, "hint"),
  );
  if (identity.role === "owner") {
    const actions = el("div", undefined, "actions");
    add(
      actions,
      button("Edit details", () => {
        const dialogEl = openDialog("Edit club", "Update public club details.");
        const form = el("form"),
          n = field(form, "Name", { value: d.club.name, max: 100 }),
          desc = field(form, "Description", {
            type: "textarea",
            value: d.club.description,
            max: 2000,
            required: false,
          }),
          rules = field(form, "Rules", {
            type: "textarea",
            value: d.club.rules,
            max: 10000,
            required: false,
          });
        const b = el("button", "Continue");
        b.type = "submit";
        add(
          form,
          b,
          button("Cancel", () => dialog.close()),
        );
        form.onsubmit = (e) => {
          e.preventDefault();
          dialog.close();
          decision(
            "edit_club",
            { type: "club", id },
            {
              expected: d.club.updated_at,
              payload: {
                name: n.value,
                description: desc.value,
                rules: rules.value,
              },
              refresh: () => showClub(id),
            },
          );
        };
        dialogEl.append(form);
      }),
      button(
        d.control?.posting_paused ? "Resume posting" : "Pause posting",
        () =>
          decision(
            d.control?.posting_paused ? "resume_club" : "pause_club",
            { type: "club", id },
            {
              expected: d.club.updated_at,
              refresh: () => showClub(id),
              description:
                "This controls new posts and comment edits. Club membership and existing reading access remain available.",
            },
          ),
      ),
    );
    p.append(actions);
  }
  table(
    p,
    ["Reader ID", "Role", "Joined"],
    d.members.map((r) => [r.user_id, r.role, date(r.joined_at)]),
  );
  main.append(p);
}
function announcementEditor(item) {
  const d = openDialog(
    item ? "Edit announcement" : "New announcement",
    "Draft an update. Nothing is sent until you publish.",
  );
  const form = el("form"),
    title = field(form, "Title", { value: item?.title, max: 120 }),
    body = field(form, "Message", {
      type: "textarea",
      value: item?.body,
      max: 2000,
    });
  const b = el("button", "Continue");
  b.type = "submit";
  add(
    form,
    b,
    button("Cancel", () => dialog.close()),
  );
  form.onsubmit = (e) => {
    e.preventDefault();
    dialog.close();
    decision(
      "save_announcement",
      { type: "announcement", id: item?.id || crypto.randomUUID() },
      {
        expected: item?.updated_at,
        payload: { title: title.value, body: body.value },
      },
    );
  };
  d.append(form);
}
function showAnnouncement(r) {
  const main = detail(
      r.title,
      `${r.state} · ${r.delivered_count} notifications delivered`,
    ),
    p = el("section", undefined, "panel");
  add(p, el("p", r.body, "body-text"));
  if (identity.role === "owner") {
    const opts = { expected: r.updated_at, refresh: load },
      target = { type: "announcement", id: r.id };
    const actions = el("div", undefined, "actions");
    if (r.state === "draft")
      add(
        actions,
        button("Edit draft", () => announcementEditor(r)),
        button("Publish to readers", () =>
          decision("publish_announcement", target, {
            ...opts,
            description:
              "This sends an in-app notification to active readers in batches. Review the title and message before confirming.",
          }),
        ),
      );
    if (r.state !== "archived")
      actions.append(
        button("Archive", () =>
          decision("archive_announcement", target, {
            ...opts,
            description:
              "This stops remaining delivery. Notifications already delivered remain in readers’ inboxes.",
          }),
        ),
      );
    p.append(actions);
  }
  main.append(p);
}
async function boot() {
  if (!config.key) {
    root.replaceChildren(
      add(
        el("main", undefined, "login"),
        el("h1", "Novori Admin"),
        el(
          "p",
          "The public Supabase configuration has not been added to this deployment. No admin data is available.",
        ),
      ),
    );
    return;
  }
  client = createClient(config.url, config.key, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "novori-admin-session",
    },
  });
  const {
    data: { session },
  } = await client.auth.getSession();
  if (session) {
    try {
      await enter();
    } catch (e) {
      login(e.message);
    }
  } else login();
}
boot().catch((e) => {
  root.replaceChildren(
    add(
      el("main", undefined, "login"),
      el("h1", "Could not open Novori Admin"),
      el("p", e.message, "error"),
    ),
  );
});
