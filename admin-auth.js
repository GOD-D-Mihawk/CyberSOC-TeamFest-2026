/* CyberSOC TeamFest 2026 — Hughes ADM browser auth, no external JS dependency.
   The Supabase publishable key is public. Never put privileged keys here. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const message = (text) => { $("message").textContent = text; };
  const configuration = window.TEAMFEST_CONFIG;
  const storageKey = "teamfest_hughes_admin_session_v1";
  const base = "https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/";
  let busy = false;
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { session = null; }
  const buttons = ["signin", "activate", "refresh", "logout", "extend", "enable"];
  const loading = (value) => {
    busy = value;
    for (const id of buttons) {
      const el = $(id);
      if (el) el.disabled = value;
    }
  };
  const fail = (text) => { message(text); throw new Error(text); };
  if (!configuration?.url || !configuration?.key) {
    message("Website configuration did not load. Check config.js, then refresh.");
    return;
  }
  const endpoint = configuration.url.replace(/\/$/, "");
  const pinValid = () => /^[0-9]{8}$/.test($("pin").value);
  const emailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("email").value.trim());
  const loginPanel = () => { $("loginbox").classList.remove("hidden"); $("admin").classList.add("hidden"); };
  const dashboardPanel = () => { $("loginbox").classList.add("hidden"); $("admin").classList.remove("hidden"); };
  const save = (body) => {
    if (body?.access_token && body?.refresh_token) {
      session = {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: Date.now() + Number(body.expires_in || 3600) * 1000
      };
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    }
  };
  const signout = () => { session = null; sessionStorage.removeItem(storageKey); loginPanel(); };
  const request = async (path, method, payload, token) => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 16000);
    try {
      const headers = {"apikey": configuration.key, "Content-Type": "application/json"};
      if (token) headers.Authorization = "Bearer " + token;
      const res = await fetch(endpoint + path, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: ac.signal,
        cache: "no-store"
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {error: raw.slice(0, 500)}; }
      if (!res.ok || data.error) {
        const detail = data.msg || data.error_description || data.message || (typeof data.error === "string" ? data.error : "");
        const code = data.error_code ? " (" + data.error_code + ")" : "";
        throw new Error((detail || "Request failed") + code + " [HTTP " + res.status + "]");
      }
      return data;
    } catch (e) {
      if (e?.name === "AbortError") throw new Error("Server request timed out. Check connectivity and retry.");
      if (e instanceof TypeError) throw new Error("Browser could not connect to Supabase. Check network, ad blockers or CORS.");
      throw e;
    } finally { clearTimeout(timeout); }
  };
  const credentialRequest = (path, method, body, token) => request(path, method, body, token);
  const ensureSession = async () => {
    if (!session?.access_token) return null;
    if (session.expires_at - Date.now() < 60000) {
      if (!session.refresh_token) { signout(); return null; }
      try {
        const next = await credentialRequest("/auth/v1/token?grant_type=refresh_token", "POST", {refresh_token: session.refresh_token});
        save(next);
      } catch { signout(); return null; }
    }
    return session?.access_token || null;
  };
  const adminRequest = async (action, data = {}) => {
    const token = await ensureSession();
    if (!token) fail("You're not signed in. Activate your account first, then sign in.");
    return credentialRequest("/functions/v1/tf-admin-control", "POST", {action, ...data}, token);
  };
  const updateDashboard = (data) => {
    dashboardPanel();
    $("welcome").textContent = "Welcome, " + data.admin.display_name;
    $("info").textContent = "Registered participants: " + data.summary.activated_count +
      " / " + data.summary.participant_count +
      "\nNew analyst pending: " + (data.summary.placeholder_count ? "Yes" : "No");
    $("deadline").textContent = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Indian/Mauritius"
    }).format(new Date(data.settings.vote_deadline)) + " MUT";
    $("drawstate").textContent = data.settings.draw_enabled
      ? "Draw authorised. Secure execution pending."
      : "Draw not authorised.";
    $("enable").disabled = Boolean(data.settings.draw_enabled);
  };
  const withBusy = async (fn) => {
    if (busy) return;
    loading(true);
    try { await fn(); }
    catch (error) { message("⚠️ " + (error?.message || String(error))); }
    finally { loading(false); }
  };
  const refresh = async () => {
    const token = await ensureSession();
    if (!token) { loginPanel(); return; }
    const data = await adminRequest("status");
    updateDashboard(data);
    message("✅ Admin access verified.");
  };
  $("activate").addEventListener("click", () => withBusy(async () => {
    if (!emailValid()) return message("Please enter your Outlook email address.");
    if (!pinValid()) return message("Your PIN must contain exactly 8 digits.");
    message("Requesting activation...");
    const response = await credentialRequest(
      "/auth/v1/signup?redirect_to=" + encodeURIComponent(base + "admin.html"),
      "POST",
      {email: $("email").value.trim().toLowerCase(), password: $("pin").value}
    );
    if (response.access_token) {
      save(response);
      await refresh();
      return;
    }
    message("✅ Activation submitted. Check your Outlook inbox and junk folder for the Supabase verification email. Follow the link before signing in. If no email arrives, email delivery may need configuration.");
  }));
  $("signin").addEventListener("click", () => withBusy(async () => {
    if (!emailValid()) return message("Please enter your Outlook email address.");
    if (!pinValid()) return message("Please enter your 8-digit PIN.");
    message("Signing in...");
    const response = await credentialRequest(
      "/auth/v1/token?grant_type=password",
      "POST",
      {email: $("email").value.trim().toLowerCase(), password: $("pin").value}
    );
    save(response);
    await refresh();
  }));
  $("refresh").addEventListener("click", () => withBusy(refresh));
  $("logout").addEventListener("click", () => {
    signout(); message("Signed out."); $("pin").value = "";
  });
  $("extend").addEventListener("click", () => withBusy(async () => {
    const value = $("next").value;
    if (!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(value)) return message("Choose a date and time.");
    const r = await adminRequest("extend_vote", {vote_deadline: value + ":00+04:00"});
    message(r.ok ? "✅ Deadline extended." : "Request did not complete.");
    await refresh();
  }));
  $("enable").addEventListener("click", () => withBusy(async () => {
    if (!confirm("Authorise the Secret Santa draw? No recipient names will be revealed.")) return;
    const r = await adminRequest("enable_draw");
    message(r.note || "Draw setting updated.");
    await refresh();
  }));
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const errorDescription = hash.get("error_description") || query.get("error_description");
  if (errorDescription) message("⚠️ Email confirmation failed: " + errorDescription);
  if (hash.has("access_token") && hash.has("refresh_token")) {
    save({
      access_token: hash.get("access_token"),
      refresh_token: hash.get("refresh_token"),
      expires_in: Number(hash.get("expires_in") || 3600)
    });
    history.replaceState(null, "", location.pathname);
    withBusy(refresh);
  } else if (query.has("code")) {
    message("A confirmation code was returned without an exchange verifier. Please sign in using your PIN.");
  } else if (session) {
    withBusy(refresh);
  } else if (!errorDescription) {
    message("Ready. Use Activate account once; after email verification, use Sign in.");
  }
})();