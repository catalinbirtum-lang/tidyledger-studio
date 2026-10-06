/*! Tidy Ledger Studio FAQ chatbot widget v1.0 - plain JavaScript, no API key, no cookies, no tracking.
 * Answers from the business's own facts (opening hours, prices, FAQs) using keyword + typo-tolerant matching,
 * and collects booking requests (opens the visitor's email app with a pre-filled message, or shows a confirmation).
 * Usage: <script src="chatbot.js"></script><script>TLChat.init({...config...})</script>
 * Licence: written from scratch by Tidy Ledger Studio; the client receives full rights to use and edit it.
 */
(function (w, d) {
  "use strict";
  var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  var DAY_WORDS = { monday: "mon", mon: "mon", tuesday: "tue", tues: "tue", tue: "tue", wednesday: "wed", wed: "wed", weds: "wed",
    thursday: "thu", thurs: "thu", thu: "thu", friday: "fri", fri: "fri", saturday: "sat", sat: "sat", sunday: "sun", sun: "sun" };
  var STOP = ("a an the is are am do does did you your yours i me my we our us it its to of for in on at and or can could would will " +
    "please pls what whats which who how there here be have has any some this that with about just get got like know tell").split(" ");
  var BUILTIN = {
    greet: ["hi", "hello", "hey", "hiya", "good morning", "good afternoon", "good evening", "morning", "alright"],
    thanks: ["thanks", "thank you", "cheers", "ta", "brilliant", "great thanks", "perfect"],
    hours: ["open", "opening", "opening hours", "hours", "close", "closing", "closed", "times", "open today", "open now",
      "open tomorrow", "what time", "bank holiday", "weekend", "late"],
    prices: ["price", "prices", "price list", "cost", "costs", "how much", "charge", "charges", "fee", "fees", "rates", "menu", "tariff", "cheap", "expensive"],
    booking: ["book", "booking", "appointment", "appointments", "reserve", "reservation", "table", "slot", "availability",
      "available", "quote", "estimate", "callout", "call out", "visit", "come out", "request"],
    location: ["where", "address", "location", "located", "directions", "find you", "parking", "park", "postcode", "area", "areas", "cover", "near"],
    contact: ["contact", "phone", "call", "ring", "email", "e-mail", "speak", "human", "person", "someone", "whatsapp", "message"],
    services: ["services", "service", "what do you do", "offer", "treatments", "options", "list"]
  };

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9£.\s-]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokens(s) { return norm(s).split(" ").filter(function (t) { return t && STOP.indexOf(t) < 0; }); }
  function lev(a, b) { /* optimal string alignment distance (counts a swapped pair of letters as 1) */
    if (a === b) return 0; if (Math.abs(a.length - b.length) > 2) return 9;
    var m = [], i, j; for (i = 0; i <= a.length; i++) { m[i] = [i]; } for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
    return m[a.length][b.length];
  }
  function tokMatch(kt, toks) {
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t === kt) return 2;
      if (kt.length >= 4 && (t === kt + "s" || kt === t + "s" || t === kt + "es")) return 2;
      if (kt.length >= 4 && t.length >= 4 && lev(t, kt) <= (kt.length >= 8 ? 2 : 1)) return 1.5;
    }
    return 0;
  }
  /* score how well a message matches a list of keyword phrases */
  function score(msgNorm, toks, keywords) {
    var best = 0, total = 0;
    (keywords || []).forEach(function (k) {
      var kn = norm(k); if (!kn) return;
      var s = 0;
      if ((" " + msgNorm + " ").indexOf(" " + kn + " ") > -1) s = kn.indexOf(" ") > -1 ? 4 : 3;
      else {
        var kts = kn.split(" ").filter(function (t) { return STOP.indexOf(t) < 0; });
        if (!kts.length) return;
        var hit = 0, n = 0; kts.forEach(function (kt) { var h = tokMatch(kt, toks); hit += h; if (h) n++; });
        if (n === kts.length) s = kts.length > 1 ? 3 : (hit >= 2 ? 2.5 : (kts[0].length >= 6 ? 2.5 : 2));
        else if (kts.length > 1 && n >= 2 && n >= kts.length / 2) s = 1.5;
      }
      if (s > best) best = s; total += s;
    });
    return best + Math.min(total - best, 3) * 0.35;
  }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toMin(hhmm) { var p = hhmm.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function fmtTime(hhmm) {
    var m = toMin(hhmm), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "pm" : "am", h12 = h % 12 || 12;
    return h12 + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + ap;
  }
  function nowIn(tz) {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: o.weekday.slice(0, 3).toLowerCase(), min: (+o.hour) * 60 + (+o.minute) };
    } catch (e) { var n = new Date(); return { day: DAYS[n.getDay()], min: n.getHours() * 60 + n.getMinutes() }; }
  }

  function Bot(cfg) {
    this.c = cfg; this.tz = cfg.timezone || "Europe/London"; this.open = false; this.lastService = null;
    this.intents = this.buildIntents();
  }
  Bot.prototype.dayText = function (day) {
    var r = (this.c.hours || {})[day] || [];
    if (!r.length) return "closed";
    return r.map(function (x) { return fmtTime(x[0]) + "–" + fmtTime(x[1]); }).join(" and ");
  };
  Bot.prototype.openStatus = function () {
    if (!this.c.hours) return "";
    var n = nowIn(this.tz), r = (this.c.hours || {})[n.day] || [], i;
    for (i = 0; i < r.length; i++) if (n.min >= toMin(r[i][0]) && n.min < toMin(r[i][1])) return "We're open now, until " + fmtTime(r[i][1]) + " today.";
    for (i = 0; i < r.length; i++) if (n.min < toMin(r[i][0])) return "We're closed right now. We open at " + fmtTime(r[i][0]) + " today.";
    var di = DAYS.indexOf(n.day);
    for (var k = 1; k <= 7; k++) {
      var dd = DAYS[(di + k) % 7], rr = (this.c.hours || {})[dd] || [];
      if (rr.length) return "We're closed right now. We next open " + (k === 1 ? "tomorrow (" + DAY_NAMES[dd] + ")" : "on " + DAY_NAMES[dd]) + " at " + fmtTime(rr[0][0]) + ".";
    }
    return "";
  };
  Bot.prototype.hoursList = function () {
    var self = this;
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(function (k) { return DAY_NAMES[k] + ": " + self.dayText(k); });
  };
  Bot.prototype.buildIntents = function () {
    var c = this.c, list = [];
    (c.services || []).forEach(function (s, i) {
      list.push({ type: "service", ref: s, keywords: [s.name].concat(s.keywords || []) });
    });
    (c.faqs || []).forEach(function (f) { list.push({ type: "faq", ref: f, keywords: (f.keywords || []).concat([f.q]) }); });
    return list;
  };
  Bot.prototype.reply = function (text) {
    var c = this.c, m = norm(text), toks = tokens(text), self = this;
    if (!m) return { text: "Type a question, or tap one of the buttons below." };
    if (c.booking && (m === norm(c.booking.cta || "") || m === norm(c.booking.title || ""))) {
      return { text: c.booking.intro || "Fill in the short form and we'll get back to you.", action: "booking" };
    }
    var b = {}; Object.keys(BUILTIN).forEach(function (k) { b[k] = score(m, toks, BUILTIN[k]); });
    var day = null; toks.forEach(function (t) { if (DAY_WORDS[t]) day = DAY_WORDS[t]; });
    if (/\btoday\b/.test(m)) day = nowIn(this.tz).day;
    if (/\btomorrow\b/.test(m)) day = DAYS[(DAYS.indexOf(nowIn(this.tz).day) + 1) % 7];
    var best = null, bestS = 0, svc = null, svcS = 0, faq = null, faqS = 0;
    this.intents.forEach(function (it) {
      var s = score(m, toks, it.keywords);
      if (it.type === "service" && s > svcS) { svc = it.ref; svcS = s; }
      if (it.type === "faq" && s > faqS) { faq = it.ref; faqS = s; }
      if (s > bestS) { best = it; bestS = s; }
    });
    var builtinTop = Object.keys(b).sort(function (x, y) { return b[y] - b[x]; })[0], builtinS = b[builtinTop];
    // booking intent wins when clearly asked
    if (c.booking && b.booking >= 3 && faqS < 2.5) {
      if (svcS >= 3) this.lastService = svc.name;
      return { text: (c.booking && c.booking.intro) || "Happy to help you book. Fill in the short form and we'll confirm by message.", action: "booking" };
    }
    if (svc && svc.diet && svcS >= 2.5 && /\b(vegan|vegetarian|veggie|gluten|gf|dairy|allerg\w*|nuts?|coeliac|plant)\b/.test(m)) {
      this.lastService = svc.name;
      return { text: svc.name + ": " + svc.diet + (c.dietNote ? " " + c.dietNote : ""), chips: ["Vegan options?", "Allergens"] };
    }
    if (svc && svcS >= 2.5 && (svcS > faqS || (b.prices >= 1.5 && svcS >= faqS))) {
      this.lastService = svc.name;
      return { text: svc.name + ": " + svc.price + (svc.duration ? " (" + svc.duration + ")" : "") + "." + (svc.note ? " " + svc.note : ""),
        chips: [c.booking ? (c.booking.cta || "Book this") : null, "Full price list"].filter(Boolean) };
    }
    if (faq && faqS >= 2.5 && (faqS >= builtinS - 0.5 || (faqS >= 3 && (builtinTop === "booking" || builtinTop === "contact")))) {
      return { text: faq.a, chips: faq.chips };
    }
    if ((b.hours >= 1.5 || (day && builtinS < 3)) && !c.hours) {
      return { text: c.hoursNote || "Please get in touch to check availability.", chips: [c.booking ? (c.booking.cta || "Get in touch") : null].filter(Boolean) };
    }
    if (b.hours >= 1.5 || (day && builtinS < 3)) {
      var out = [];
      var today = nowIn(this.tz).day;
      if (day) out.push(DAY_NAMES[day] + ": " + (this.dayText(day) === "closed" ? "we're closed." : this.dayText(day) + "."));
      if (!day || day === today) { var st = this.openStatus(); if (st) out.push(st); }
      if (!day) out.push("Opening hours:\n" + this.hoursList().join("\n"));
      if (c.hoursNote && (!day || /bank|holiday|christmas|easter/.test(m))) out.push(c.hoursNote);
      return { text: out.join("\n\n"), chips: [c.booking ? (c.booking.cta || "Book") : null, "Where are you?"].filter(Boolean) };
    }
    if (b.prices >= 1.5 || (b.services >= 1.5 && builtinTop === "services")) {
      var lines = (c.services || []).map(function (s) { return "• " + s.name + " – " + s.price + (s.duration ? " (" + s.duration + ")" : ""); });
      return { text: (c.pricesIntro || "Here are our prices:") + "\n" + lines.join("\n") + (c.pricesNote ? "\n\n" + c.pricesNote : ""),
        chips: [c.booking ? (c.booking.cta || "Book") : null, "Opening hours"].filter(Boolean) };
    }
    if (b.location >= 1.5) return { text: c.locationText || "Please see the contact section of this page for where to find us.", chips: ["Opening hours"] };
    if (c.booking && b.booking >= 1.5) return { text: (c.booking && c.booking.intro) || "Fill in the short form and we'll get back to you.", action: "booking" };
    if (b.contact >= 1.5) return { text: c.contactText || "The quickest way to reach us is the booking/enquiry form here in the chat.", chips: [c.booking ? (c.booking.cta || "Send an enquiry") : null].filter(Boolean) };
    if (best && bestS >= 2.5) return { text: best.type === "faq" ? best.ref.a : best.ref.name + ": " + best.ref.price + ".", chips: best.ref.chips };
    if (b.thanks >= 1.5) return { text: "You're welcome! Anything else I can help with?" };
    if (b.greet >= 1.5) return { text: "Hello! Ask me about opening hours, prices, or making a booking." };
    return { text: c.fallback || "Sorry, I'm not sure about that one. I can help with opening hours, prices and bookings, or you can send the team a message and they'll reply.",
      chips: (c.suggestions || []).slice(0, 3).concat([c.booking ? (c.booking.cta || "Send a message") : null]).filter(Boolean) };
  };

  /* ---------- UI ---------- */
  Bot.prototype.mount = function () {
    var c = this.c, self = this;
    var root = el("div", "tlc"); root.setAttribute("data-tlc", "");
    if (c.accent) root.style.setProperty("--tlc-accent", c.accent);
    if (c.accentText) root.style.setProperty("--tlc-accent-text", c.accentText);
    var btn = el("button", "tlc-launch"); btn.type = "button"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "tlc-panel");
    btn.setAttribute("data-tl-event", "chat_open");
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01zm5 0a1.5 1.5 0 1 0 0 .01z"/></svg>';
    btn.appendChild(el("span", "tlc-launch-label", c.launcherLabel || "Ask us"));
    var panel = el("section", "tlc-panel"); panel.id = "tlc-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", (c.botName || "Chat assistant"));
    panel.hidden = true;
    var head = el("header", "tlc-head");
    var ht = el("div", "tlc-head-t");
    ht.appendChild(el("strong", null, c.botName || (c.business + " assistant")));
    ht.appendChild(el("span", "tlc-sub", c.demo ? "Demo assistant · instant answers" : "Instant answers · replies from the team by message"));
    head.appendChild(ht);
    var x = el("button", "tlc-x"); x.type = "button"; x.setAttribute("aria-label", "Close chat"); x.innerHTML = "&times;"; head.appendChild(x);
    var log = el("div", "tlc-log"); log.setAttribute("aria-live", "polite"); log.setAttribute("role", "log");
    var chips = el("div", "tlc-chips");
    var form = el("form", "tlc-form"); form.setAttribute("autocomplete", "off");
    var inp = el("input", "tlc-in"); inp.type = "text"; inp.placeholder = c.placeholder || "Type your question…"; inp.setAttribute("aria-label", "Your question"); inp.maxLength = 300;
    var send = el("button", "tlc-send", "Send"); send.type = "submit";
    form.appendChild(inp); form.appendChild(send);
    var foot = el("p", "tlc-foot", c.footNote || "Automated answers from this business's own information. No cookies.");
    panel.appendChild(head); panel.appendChild(log); panel.appendChild(chips); panel.appendChild(form); panel.appendChild(foot);
    root.appendChild(panel); root.appendChild(btn); d.body.appendChild(root);
    this.root = root; this.btn = btn; this.panel = panel; this.log = log; this.chipsEl = chips; this.inp = inp; this.form = form;
    btn.addEventListener("click", function () { self.toggle(); });
    x.addEventListener("click", function () { self.toggle(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && self.open) self.toggle(false); });
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = inp.value.trim(); if (!v) return; inp.value = ""; self.ask(v); });
    d.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest("[data-chat-ask],[data-chat-book]"); if (!t) return;
      e.preventDefault();
      if (t.hasAttribute("data-chat-book")) { self.toggle(true); if (t.getAttribute("data-chat-book")) self.lastService = t.getAttribute("data-chat-book"); self.showBooking(); }
      else { self.toggle(true); self.ask(t.getAttribute("data-chat-ask")); }
    });
  };
  Bot.prototype.toggle = function (force) {
    var open = force == null ? !this.open : !!force;
    if (open === this.open) { if (open) this.inp.focus(); return; }
    this.open = open; this.panel.hidden = !open; this.btn.setAttribute("aria-expanded", String(open));
    this.root.classList.toggle("tlc-is-open", open);
    if (open && !this.greeted) { this.greeted = true; this.say(this.c.greeting || ("Hi! I'm the " + this.c.business + " assistant. How can I help?"), "bot"); this.setChips(this.c.suggestions); }
    if (open) { var s = this; setTimeout(function () { s.inp.focus(); }, 30); } else this.btn.focus();
  };
  Bot.prototype.say = function (text, who) {
    var b = el("div", "tlc-msg tlc-" + who); b.textContent = text; this.log.appendChild(b);
    this.log.scrollTop = this.log.scrollHeight; return b;
  };
  Bot.prototype.setChips = function (arr) {
    var self = this; this.chipsEl.innerHTML = "";
    (arr || []).forEach(function (label) {
      var ch = el("button", "tlc-chip", label); ch.type = "button";
      ch.addEventListener("click", function () { self.ask(label); });
      self.chipsEl.appendChild(ch);
    });
  };
  Bot.prototype.ask = function (q) {
    var self = this; this.say(q, "user");
    var r = this.reply(q);
    var typing = el("div", "tlc-msg tlc-bot tlc-typing"); typing.innerHTML = "<span></span><span></span><span></span>"; typing.setAttribute("aria-hidden", "true");
    this.log.appendChild(typing); this.log.scrollTop = this.log.scrollHeight;
    setTimeout(function () {
      typing.remove(); self.say(r.text, "bot");
      if (r.action === "booking") self.showBooking();
      self.setChips(r.chips || self.c.suggestions);
    }, 350);
  };
  Bot.prototype.showBooking = function () {
    if (!this.c.booking) { this.say(this.c.contactText || "Please use the contact details on this page.", "bot"); return; }
    var c = this.c, bk = c.booking || {}, self = this;
    if (this.log.querySelector(".tlc-book:not(.tlc-done)")) { this.log.querySelector(".tlc-book:not(.tlc-done) input").focus(); return; }
    var f = el("form", "tlc-msg tlc-bot tlc-book"); f.noValidate = true;
    f.appendChild(el("strong", null, bk.title || "Booking request"));
    function field(label, name, type, req, opts) {
      var wrap = el("label", "tlc-f"); wrap.appendChild(el("span", null, label + (req ? " *" : "")));
      var i;
      if (type === "select") { i = el("select"); (opts || []).forEach(function (o) { var op = el("option", null, o); op.value = o; i.appendChild(op); }); if (self.lastService) i.value = self.lastService; }
      else if (type === "textarea") { i = el("textarea"); i.rows = 2; i.maxLength = 500; }
      else { i = el("input"); i.type = type; if (type === "date") { var t = new Date(); i.min = t.toISOString().slice(0, 10); } if (type !== "date" && type !== "time") i.maxLength = 120; }
      i.name = name; if (req) i.required = true; wrap.appendChild(i); f.appendChild(wrap); return i;
    }
    field("Your name", "name", "text", true);
    field(bk.contactLabel || "Phone or email", "contact", "text", true);
    var opts = bk.options || (c.services || []).map(function (s) { return s.name; });
    if (opts.length) field(bk.optionLabel || "What for?", "service", "select", false, opts);
    if (bk.extraField) field(bk.extraField.label, "extra", bk.extraField.type || "text", !!bk.extraField.required, bk.extraField.options);
    field(bk.dateLabel || "Preferred date", "date", "date", true);
    if (bk.askTime !== false) field(bk.timeLabel || "Preferred time", "time", bk.timeOptions ? "select" : "time", false, bk.timeOptions);
    field(bk.notesLabel || "Anything else?", "notes", "textarea", false);
    var err = el("p", "tlc-err"); err.setAttribute("role", "alert"); f.appendChild(err);
    var sb = el("button", "tlc-submit", bk.submitLabel || "Send request"); sb.type = "submit"; f.appendChild(sb);
    f.appendChild(el("p", "tlc-small", bk.privacy || "We only use these details to reply to your request."));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) data[x.name] = String(x.value || "").trim(); });
      var miss = Array.prototype.filter.call(f.elements, function (x) { return x.required && !String(x.value || "").trim(); });
      if (miss.length) { err.textContent = "Please fill in: " + miss.map(function (x) { return x.parentNode.firstChild.textContent.replace(" *", ""); }).join(", ") + "."; miss[0].focus(); return; }
      if (!/@|\d{6,}/.test(data.contact.replace(/\s/g, ""))) { err.textContent = "Please enter a phone number or an email address so we can reply."; f.elements.contact.focus(); return; }
      if (data.date && data.date < new Date().toISOString().slice(0, 10)) { err.textContent = "Please choose today or a future date."; f.elements.date.focus(); return; }
      err.textContent = "";
      var label = { name: "Name", contact: "Contact", service: bk.optionLabel || "Service", extra: bk.extraField ? bk.extraField.label : "Extra", date: "Preferred date", time: "Preferred time", notes: "Notes" };
      var lines = Object.keys(label).filter(function (k) { return data[k]; }).map(function (k) { return label[k] + ": " + data[k]; });
      Array.prototype.forEach.call(f.elements, function (x) { x.disabled = true; }); f.classList.add("tlc-done");
      if (typeof bk.onSubmit === "function") { try { bk.onSubmit(data, lines); } catch (x) {} }
      if (bk.sendTo) { /* sendTo = the client's email-link address, set in the page config (see DELIVERY_PLAYBOOK.md) */
        var href = bk.sendTo + (bk.sendTo.indexOf("?") > -1 ? "&" : "?") + "subject=" + encodeURIComponent((bk.subject || "Booking request") + " – " + data.name) + "&body=" + encodeURIComponent(lines.join("\n") + "\n\n(Sent from the website chat)");
        self.say("Thanks, " + data.name + "! Your email app should now open with the request filled in – just press send. " + (bk.after || "We'll confirm as soon as we can."), "bot");
        w.location.href = href;
      } else {
        self.say((c.demo ? (c.demoNote || "Demo only – nothing was sent. On a real site this request goes straight to the business (by email or a free form service).") + "\n\n" : "Thanks! ") +
          "Request summary:\n" + lines.join("\n") + "\n\n" + (bk.after || "We'll confirm by message as soon as we can."), "bot");
      }
      self.setChips(c.suggestions);
    });
    this.log.appendChild(f); this.log.scrollTop = this.log.scrollHeight;
    var first = f.querySelector("input"); if (first) setTimeout(function () { first.focus(); }, 30);
  };

  /* fill page elements from the same config so the site and the bot never disagree */
  function renderPage(bot) {
    var c = bot.c;
    Array.prototype.forEach.call(d.querySelectorAll("[data-tlc-hours]"), function (t) {
      t.innerHTML = ""; var today = nowIn(bot.tz).day;
      if (!c.hours) { var r = el("tr"); r.appendChild(el("td", null, c.hoursNote || "Hours to be confirmed.")); t.appendChild(r); return; }
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].forEach(function (k) {
        var tr = el("tr"); if (k === today) tr.className = "is-today";
        tr.appendChild(el("th", null, DAY_NAMES[k])); tr.appendChild(el("td", null, bot.dayText(k))); t.appendChild(tr);
      });
    });
    Array.prototype.forEach.call(d.querySelectorAll("[data-tlc-status]"), function (t) { if (c.hours) { t.textContent = bot.openStatus(); t.classList.toggle("is-closed", /closed/.test(t.textContent)); } else t.hidden = true; });
    Array.prototype.forEach.call(d.querySelectorAll("[data-tlc-faqs]"), function (t) {
      t.innerHTML = "";
      (c.faqs || []).filter(function (f) { return f.onPage !== false; }).forEach(function (f) {
        var det = el("details"), s = el("summary", null, f.q), p = el("p", null, f.a); det.appendChild(s); det.appendChild(p); t.appendChild(det);
      });
    });
  }

  w.TLChat = {
    init: function (cfg) {
      var bot = new Bot(cfg);
      function go() {
        bot.mount(); renderPage(bot); w.TLChat.bot = bot;
        /* deep link: page.html#ask=Opening%20hours|Book opens the chat and asks those questions (handy for sharing) */
        var m = /[#&]ask=([^&]+)/.exec(w.location.hash || "");
        if (m) { var qs = decodeURIComponent(m[1]).split("|").slice(0, 4); bot.toggle(true);
          qs.forEach(function (q, i) { setTimeout(function () { bot.ask(q.slice(0, 120)); }, 200 + i * 700); }); }
      }
      if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", go); else go();
      return bot;
    },
    _Bot: Bot
  };
})(window, document);
