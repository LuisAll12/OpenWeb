// server.js
import express from "express";
import cors from "cors";
import { JSDOM } from "jsdom";

const app = express();
app.use(cors());

const ALLOWED_HOSTS = [
  "expovina.ch",
  "www.expovina.ch",
  "umb.ch",
  "www.umb.ch",
  "bsse.ethz.ch",
  "www.bsse.ethz.ch",
  "expovina.ticketino.com",
  "ticketino.com",
  "www.ticketino.com"];

function validateUrl(raw) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Protocol not allowed");
  if (!ALLOWED_HOSTS.includes(u.hostname)) throw new Error("Host not allowed");
  return u.toString();
}

app.get("/proxy", async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).send("Missing url");
    const targetUrl = validateUrl(rawUrl);

    const upstream = await fetch(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) return res.status(upstream.status).send("Upstream error");
    const html = await upstream.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Base-URL setzen, damit relative href/src korrekt auf die Originalseite zeigen
    document.querySelectorAll("base").forEach(b => b.remove());
    const base = document.createElement("base");
    base.setAttribute("href", new URL(targetUrl).toString());
    (document.head || document.documentElement).prepend(base);

    // Strikte CSPs aus dem Dokument entfernen
    document
      .querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
      .forEach(m => m.remove());

    // Selektoren, die häufige Overlays, HubSpot-Popups, Cookie-Banner etc. treffen
    const REMOVE_SELECTORS = [
      '[id^="hs-overlay-cta-"]',
      ".hs-web-interactives-top-push-anchor",
      "#interactive-close-button-container",
      ".mfp-wrap",
      ".mfp-bg",
      ".modal",
      ".overlay",
      "#popup",
      "[data-popup]",
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '[class*="banner"][class*="cookie"]',
      'iframe[src*="hubspot"]',
      'iframe[src*="hs-"]'
    ];

    // Sofort alles entfernen, was schon im Initial-HTML vorhanden ist
    REMOVE_SELECTORS.forEach(sel =>
      document.querySelectorAll(sel).forEach(n => n.remove())
    );

    // Styles injizieren, damit später eingehängte Overlays sofort unsichtbar sind
    const style = document.createElement("style");
    style.textContent = `
${REMOVE_SELECTORS.join(",")}
{ display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
html, body { overflow: auto !important; }
`;
    (document.head || document.documentElement).appendChild(style);

    // Optionales Scrollen zu einem Ziel-Selektor mit Offset
    const selector = req.query.selector || "";
    const offset = Number(req.query.offset || 0);

    // Clientseitiger Beobachter, um nachgeladene Overlays zu entfernen und erst zu scrollen, wenn das Ziel existiert
    const script = document.createElement("script");
    script.textContent = `
(function(){
  const SELECTORS = ${JSON.stringify(REMOVE_SELECTORS)};
  const CLEAN_CLASSES = ["modal-open","no-scroll","overflow-hidden"];

  function nuke(){
    try {
      SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
      [document.body, document.documentElement].forEach(n => {
        if (!n) return;
        CLEAN_CLASSES.forEach(c => n.classList.remove(c));
        n.style.overflow = "auto";
      });
    } catch(e){}
  }

  function tryScroll(){
    if (!${JSON.stringify(selector)}) return true;
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    var top = el.getBoundingClientRect().top + window.scrollY - ${offset};
    window.scrollTo({ top, behavior: "instant" });
    return true;
  }

  document.addEventListener("DOMContentLoaded", function(){
    nuke();
    tryScroll();
  });

  const obs = new MutationObserver(function(){
    nuke();
    tryScroll();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class","style"] });

  setInterval(function(){ nuke(); tryScroll(); }, 2000);
  setTimeout(function(){ obs.disconnect(); }, 15000);
})();
`;
    (document.body || document.documentElement).appendChild(script);

    res.setHeader("Cache-Control", "no-store");
    res.send(dom.serialize());
  } catch (e) {
    res.status(400).send(e.message || "Bad request");
  }
});

app.listen(3000, () => {
  console.log("Proxy up on http://localhost:3000");
});
