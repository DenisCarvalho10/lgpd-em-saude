/* ===================================================================
   AdvX — Atribuição de origem (UTM) · first-touch, 90 dias
   Guarda de qual anúncio/campanha o visitante veio, para o AdvX medir
   CPL/CAC por campanha. Não envia nada sozinho: só captura e expõe.
   Referência: docs/atribuicao-utm.md no repo do AdvX.
   =================================================================== */
(function () {
  "use strict";

  var KEY = "advx_attrib";
  var MAX_MS = 90 * 24 * 60 * 60 * 1000; // first-touch vale 90 dias
  var CAMPOS = [
    "utm_source", "utm_medium", "utm_campaign",
    "utm_content", "utm_term", "fbclid", "gclid"
  ];

  function daUrl() {
    var out = {};
    try {
      var u = new URLSearchParams(location.search);
      CAMPOS.forEach(function (k) {
        var v = u.get(k);
        if (v) out[k] = String(v).slice(0, 200);
      });
    } catch (e) {}
    return out;
  }

  function guardado() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return null;
      if (d._ts && Date.now() - d._ts > MAX_MS) return null; // expirou
      return d;
    } catch (e) { return null; }
  }

  var salvo = guardado();
  var atual = daUrl();
  var novaOrigem = false;

  // First-touch: a primeira origem manda. Só grava campo que ainda não existe.
  var dados = salvo || { _ts: Date.now() };
  CAMPOS.forEach(function (k) {
    if (atual[k] && !dados[k]) { dados[k] = atual[k]; novaOrigem = true; }
  });
  if (!dados.landing_page) {
    dados.landing_page = location.href.split("#")[0].slice(0, 400);
    novaOrigem = true;
  }
  if (!dados.referrer) {
    dados.referrer = (document.referrer || "").slice(0, 400);
  }

  try {
    if (!salvo || novaOrigem) localStorage.setItem(KEY, JSON.stringify(dados));
  } catch (e) {}

  // Disponível para o JS da página (ex.: montar link de WhatsApp ou POST).
  window.ADVX_ATTRIB = dados;

  /**
   * Código curto de rastreio, para viajar em texto (ex.: mensagem do WhatsApp).
   * Ex.: "ig-cpc-medico-erro-setembro". Vazio se não houver origem de campanha.
   */
  window.ADVX_REF = function () {
    var p = [dados.utm_source, dados.utm_medium, dados.utm_campaign]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (p) return p.slice(0, 60);
    if (dados.fbclid) return "meta";
    if (dados.gclid) return "google";
    return "";
  };

  // Injeta os campos ocultos em <form data-advx-lead> (para formulários que
  // um dia enviem a um backend). Hoje os formulários abrem o WhatsApp, então
  // isto fica inerte — e correto quando o backend existir.
  function injetar() {
    var forms = document.querySelectorAll("form[data-advx-lead]");
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      Object.keys(dados).forEach(function (k) {
        if (k.charAt(0) === "_") return;
        if (f.querySelector('[name="' + k + '"]')) return;
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = dados[k];
        f.appendChild(input);
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injetar);
  } else {
    injetar();
  }
})();
/* ===================================================================
   LGPD em Saúde — Denis Carvalho Advocacia
   Interações do site (vanilla JS, sem dependências)
   =================================================================== */
(function () {
  "use strict";

  /* === Configurações === */
  var WA_NUMBER = "5562992565904"; // WhatsApp de atendimento (roteamento dos links)

  // E-book entregue ao preencher o formulário lateral
  var EBOOK_URL  = "assets/ebooks/guia-lgpd-na-saude.pdf";
  var EBOOK_NOME = "Guia da LGPD no Ambiente Hospitalar";

  // Web3Forms — Access Key (mesma conta do escritório; leads chegam por e-mail).
  // Gere/atualize em https://web3forms.com  · deixe "" para só entregar o e-book.
  var LEAD_FORM_ACCESS_KEY = "477f7d7c-69b6-42f8-90be-0ab8c1010499";

  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $all(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }

  function wa(msg) { return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg); }

  /* ---------- Salvar lead (Web3Forms) ---------- */
  function salvarLead(nome, email, telefone) {
    if (!LEAD_FORM_ACCESS_KEY) return;
    try {
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: LEAD_FORM_ACCESS_KEY,
          subject: "Novo lead do e-book — LGPD em Saúde",
          from_name: "Site LGPD em Saúde",
          nome: nome,
          email: email,
          telefone: telefone || "(não informado)",
          material: EBOOK_NOME
        })
      });
    } catch (e) {}
  }

  function baixarEbook() {
    var a = document.createElement("a");
    a.href = EBOOK_URL;
    a.setAttribute("download", "");
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ---------- Header scroll + voltar ao topo ---------- */
  var header = $("#header");
  var toTop = $("#toTop");
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("scrolled", y > 10);
    if (toTop) toTop.classList.toggle("show", y > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- Menu mobile ---------- */
  var navToggle = $("#navToggle");
  var navLinks = $("#navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      document.body.style.overflow = open ? "hidden" : "";
    });
    $all("a", navLinks).forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.classList.remove("open");
        document.body.classList.remove("nav-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Toast ---------- */
  var toast = $("#toast");
  var toastMsg = $("#toastMsg");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 4500);
  }

  /* ---------- Formulário de contato -> WhatsApp ---------- */
  var contactForm = $("#contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = ($("#nome") || {}).value || "";
      var fone = ($("#fone") || {}).value || "";
      var assunto = ($("#assunto") || {}).value || "";
      var msg = ($("#msg") || {}).value || "";
      var texto =
        "Olá, Dr. Denis! Meu nome é " + nome.trim() + "." +
        (assunto ? "\nAssunto: " + assunto + "." : "") +
        (msg ? "\nMensagem: " + msg.trim() : "") +
        (fone ? "\nTelefone: " + fone.trim() : "");
      window.open(wa(texto), "_blank");
      showToast("Abrindo o WhatsApp para enviar sua mensagem...");
      contactForm.reset();
    });
  }

  /* ---------- Lead capture (slide-in) ---------- */
  var leadin = $("#leadin");
  var leadinTab = $("#leadinTab");
  var leadinClose = $("#leadinClose");
  var leadForm = $("#leadForm");
  var LEAD_KEY = "ao_lead_closed";

  function openLead() { if (leadin) { leadin.classList.add("show"); if (leadinTab) leadinTab.style.display = "none"; } }
  function closeLead() {
    if (leadin) leadin.classList.remove("show");
    if (leadinTab) leadinTab.style.display = "flex";
    try { sessionStorage.setItem(LEAD_KEY, "1"); } catch (e) {}
  }

  var leadShown = false;
  function maybeAutoLead() {
    if (leadShown || !leadin) return;
    if (window.innerWidth < 768) return; // no celular não abre sozinho (só pela aba/botão "E-book")
    try { if (sessionStorage.getItem(LEAD_KEY) === "1") return; } catch (e) {}
    leadShown = true;
    openLead();
  }
  setTimeout(maybeAutoLead, 14000);
  window.addEventListener("scroll", function () {
    var sc = (window.scrollY) / ((document.body.scrollHeight - window.innerHeight) || 1);
    if (sc > 0.4) maybeAutoLead();
  }, { passive: true });

  if (leadinTab) leadinTab.addEventListener("click", openLead);
  if (leadinClose) leadinClose.addEventListener("click", closeLead);
  // Qualquer botão/link com data-open-lead abre o formulário do e-book
  $all("[data-open-lead]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      leadShown = true;          // evita reabrir automaticamente depois
      openLead();
      var f = $("#leadNome"); if (f) setTimeout(function () { f.focus(); }, 600);
    });
  });
  if (leadForm) {
    leadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var consent = $("#leadConsent");
      if (consent && !consent.checked) { consent.focus(); return; }
      var nome = ($("#leadNome") || {}).value || "";
      var email = ($("#leadEmail") || {}).value || "";
      var tel = ($("#leadFone") || {}).value || "";
      salvarLead(nome.trim(), email.trim(), tel.trim());
      baixarEbook();
      showToast("Pronto, " + (nome.trim().split(" ")[0] || "tudo certo") + "! Seu e-book está sendo baixado. 📘");
      leadForm.reset();
      setTimeout(closeLead, 1400);
    });
  }

  /* ---------- Gestão de cookies (banner + modal de preferências) ---------- */
  var cookie = $("#cookieBanner");
  var cookieAccept = $("#cookieAccept");
  var cookieReject = $("#cookieReject");
  var cookiePrefsBtn = $("#cookiePrefs");          // link "Personalizar" no banner
  var cookieModal = $("#cookieModal");
  var ckSaveBtn = $("#ckSave");
  var ckAcceptAllBtn = $("#ckAcceptAll");
  var ckRejectAllBtn = $("#ckRejectAll");
  var ckAnalytics = $("#ckAnalytics");
  var ckMarketing = $("#ckMarketing");
  var COOKIE_KEY = "lgpdsaude_cookie_consent";     // "1" quando o usuário já decidiu
  var COOKIE_PREFS = "lgpdsaude_cookie_prefs";     // JSON com as categorias

  function savePrefs(prefs) {
    try {
      localStorage.setItem(COOKIE_KEY, "1");
      localStorage.setItem(COOKIE_PREFS, JSON.stringify(prefs));
    } catch (e) {}
    if (cookie) cookie.classList.remove("show");
    if (cookieModal) cookieModal.classList.remove("show");
    // Aqui podem ser disparados os scripts conforme o consentimento (ex.: Analytics)
    // if (prefs.analytics) { /* carregar Google Analytics */ }
  }
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(COOKIE_PREFS)) || {}; } catch (e) { return {}; }
  }
  function openCookieModal() {
    var p = getPrefs();
    if (ckAnalytics) ckAnalytics.checked = !!p.analytics;
    if (ckMarketing) ckMarketing.checked = !!p.marketing;
    if (cookieModal) cookieModal.classList.add("show");
  }
  function closeCookieModal() { if (cookieModal) cookieModal.classList.remove("show"); }

  var hasConsent = false;
  try { hasConsent = !!localStorage.getItem(COOKIE_KEY); } catch (e) {}
  if (!hasConsent && cookie) setTimeout(function () { cookie.classList.add("show"); }, 1800);

  if (cookieAccept) cookieAccept.addEventListener("click", function () { savePrefs({ essential: true, analytics: true, marketing: true }); });
  if (cookieReject) cookieReject.addEventListener("click", function () { savePrefs({ essential: true, analytics: false, marketing: false }); });
  if (cookiePrefsBtn) cookiePrefsBtn.addEventListener("click", function (e) { e.preventDefault(); openCookieModal(); });
  if (ckAcceptAllBtn) ckAcceptAllBtn.addEventListener("click", function () { savePrefs({ essential: true, analytics: true, marketing: true }); });
  if (ckRejectAllBtn) ckRejectAllBtn.addEventListener("click", function () { savePrefs({ essential: true, analytics: false, marketing: false }); });
  if (ckSaveBtn) ckSaveBtn.addEventListener("click", function () {
    savePrefs({ essential: true, analytics: !!(ckAnalytics && ckAnalytics.checked), marketing: !!(ckMarketing && ckMarketing.checked) });
  });
  if (cookieModal) {
    $all("[data-close-cookie]", cookieModal).forEach(function (el) { el.addEventListener("click", closeCookieModal); });
  }
  // Qualquer link/botão com [data-open-cookie] (ex.: rodapé, página de cookies) abre o modal
  $all("[data-open-cookie]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openCookieModal(); });
  });

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    $all(".card, .doc-card, .post, .split__media, .about__photo, .faq__item, .section__head").forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  /* ---------- Ano dinâmico no rodapé ---------- */
  $all("#year, .js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
