/* ===================================================================
   AdvX — Atribuição de origem (UTM) · first-touch, 90 dias
   Guarda de qual anúncio/campanha o visitante veio e carrega esse código
   nos links de WhatsApp, para a Liz registrar a origem no lead do CRM.
   Referência: docs/atribuicao-utm.md no repo do AdvX.
   =================================================================== */
(function () {
  "use strict";

  var KEY = "advx_attrib";
  var MAX_MS = 90 * 24 * 60 * 60 * 1000; // first-touch vale 90 dias
  // Rótulo da ação de conversão "Clique no WhatsApp" do Google Ads.
  // Onde achar: Google Ads > Metas > Conversões > "Clique no WhatsApp" >
  // Configurar a tag > "Instalar a tag manualmente" — copie o valor de
  // `send_to`, no formato "AW-18451711790/AbCdEfGhIjKlMnOp".
  // Enquanto estiver vazio nada dispara, e nada quebra.
  var GADS_CONVERSAO_WHATSAPP = "AW-18451711790/zEIeCN2wkvgcEK6Ou95E";

  var CAMPOS = [
    "utm_source", "utm_medium", "utm_campaign",
    "utm_content", "utm_term", "fbclid", "gclid", "li_fat_id"
  ];

  function slug(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }

  /** Qual dos sites do escritório é este (usado quando não há campanha). */
  function siteSlug() {
    var h = String(location.hostname || "").replace(/^www\./, "");
    if (h.indexOf("cobertura") >= 0) return "site-cobertura";
    if (h.indexOf("odontologica") >= 0) return "site-odonto";
    if (h.indexOf("lgpd") >= 0) return "site-lgpd";
    if (h.indexOf("deniscarvalhoadvocacia") >= 0) return "site-institucional";
    return "site";
  }

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

  // Disponível para o JS da página.
  window.ADVX_ATTRIB = dados;

  /**
   * Código de origem que viaja na mensagem do WhatsApp. É a CHAVE DE JUNÇÃO:
   * a Liz o grava como utm_campaign do lead, e ele precisa casar com
   * campanhas.utm_campaign no AdvX.
   * Ordem: campanha > origem > clique de anúncio > o site em si.
   */
  window.ADVX_REF = function () {
    if (dados.utm_campaign) return slug(dados.utm_campaign);
    if (dados.utm_source) return slug(dados.utm_source);
    if (dados.fbclid) return "meta";
    if (dados.gclid) return "google";
    if (dados.li_fat_id) return "linkedin";
    return siteSlug(); // visita orgânica: ao menos sabemos qual site converteu
  };

  /**
   * Acrescenta "#ref-<codigo>" ao texto de um link do WhatsApp.
   * Monta na mão, com encodeURIComponent: o "#" PRECISA virar %23, senão o
   * navegador o trata como fragmento e corta a URL.
   */
  window.ADVX_WA = function (url) {
    try {
      if (!url) return url;
      if (url.indexOf("wa.me") < 0 && url.indexOf("api.whatsapp.com") < 0) return url;
      if (url.indexOf("%23ref-") >= 0 || url.indexOf("#ref-") >= 0) return url; // já marcado
      var ref = window.ADVX_REF();
      if (!ref) return url;
      var marca = encodeURIComponent("\n\n#ref-" + ref);
      var i = url.indexOf("text=");
      if (i < 0) return url + (url.indexOf("?") < 0 ? "?" : "&") + "text=" + marca;
      var fim = url.indexOf("&", i);
      return fim < 0 ? url + marca : url.slice(0, fim) + marca + url.slice(fim);
    } catch (e) { return url; }
  };

  /**
   * Dispara a conversão de clique no WhatsApp para o Google Ads.
   *
   * Empurra direto no dataLayer em vez de chamar gtag(): nos sites estáticos a
   * função gtag() vive dentro de outro IIFE e não é visível aqui; window.dataLayer
   * é global nos quatro. Push de um objeto `arguments` (não de um array) é o que
   * o gtag.js espera.
   *
   * Não usamos event_callback com redirect: os links de WhatsApp abrem em nova
   * aba (target="_blank"), então a página não navega e o ping não é cortado.
   *
   * Consent Mode v2 cuida do resto — com consentimento negado o Google envia
   * ping sem cookie (conversão modelada), então NÃO se deve condicionar isto ao
   * aceite do banner.
   */
  function conversaoWhatsApp() {
    if (!GADS_CONVERSAO_WHATSAPP) return;
    try {
      window.dataLayer = window.dataLayer || [];
      (function () { window.dataLayer.push(arguments); })(
        "event", "conversion", { send_to: GADS_CONVERSAO_WHATSAPP },
      );
    } catch (e) {}
  }

  // Marca qualquer link de WhatsApp no momento do clique. Pega links que já
  // estão na página, os que o React renderiza depois e os criados por script.
  document.addEventListener("click", function (ev) {
    try {
      var alvo = ev.target;
      if (!alvo || !alvo.closest) return;
      var a = alvo.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
      if (!a) return;
      var novo = window.ADVX_WA(a.getAttribute("href"));
      if (novo) a.setAttribute("href", novo);
      conversaoWhatsApp();
    } catch (e) {}
  }, true);

  // Injeta os campos ocultos em <form data-advx-lead> (para formulários que um
  // dia enviem a um backend). Hoje os formulários abrem o WhatsApp.
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

  function wa(msg) { var u = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg); return window.ADVX_WA ? window.ADVX_WA(u) : u; }

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
          material: EBOOK_NOME,
          origem: (window.ADVX_REF ? window.ADVX_REF() : ""),
          pagina: (window.ADVX_ATTRIB ? window.ADVX_ATTRIB.landing_page : "")
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

  /* ---------- LinkedIn Insight Tag (só com consentimento de marketing) ---------- */
  var liLoaded = false;
  function loadLinkedInInsight() {
    if (liLoaded) return;
    liLoaded = true;
    window._linkedin_partner_id = "10882153";
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push("10882153");
    (function (l) {
      if (!l) { window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); }; window.lintrk.q = []; }
      var s = document.getElementsByTagName("script")[0];
      var b = document.createElement("script");
      b.type = "text/javascript"; b.async = true;
      b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
      s.parentNode.insertBefore(b, s);
    })(window.lintrk);
  }

  /* ---------- Google Ads (gtag.js) — Consent Mode v2 ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", wait_for_update: 500
  });
  (function () {
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=AW-18451711790";
    document.head.appendChild(g);
  })();
  gtag("js", new Date());
  gtag("config", "AW-18451711790");
  gtag("config", "G-GVF13Q28HM"); // Google Analytics 4 (Consent Mode v2: só mede com cookie após o aceite)
  function updateAdsConsent(prefs) {
    prefs = prefs || {};
    gtag("consent", "update", {
      ad_storage: prefs.marketing ? "granted" : "denied",
      ad_user_data: prefs.marketing ? "granted" : "denied",
      ad_personalization: prefs.marketing ? "granted" : "denied",
      analytics_storage: prefs.analytics ? "granted" : "denied"
    });
  }

  /* ---------- Gestão de cookies (banner + modal de preferências) ---------- */
  // Injeta um banner simples nas páginas sem o HTML do banner (landing de anúncio).
  if (!$("#cookieBanner")) {
    var jaDecidiu = false;
    try { jaDecidiu = !!localStorage.getItem("lgpdsaude_cookie_consent"); } catch (e) {}
    if (!jaDecidiu) {
      var ckInj = document.createElement("div");
      ckInj.className = "cookie";
      ckInj.id = "cookieBanner";
      ckInj.innerHTML =
        '<p>Usamos cookies para melhorar sua experiência e analisar o tráfego do site. Você pode aceitar todos ou recusar os não essenciais. Saiba mais na <a href="cookies.html">Política de Cookies</a>.</p>' +
        '<div class="cookie__row">' +
        '<button class="btn btn-gold" id="cookieAccept">Aceitar todos</button>' +
        '<button class="btn btn-ghost" id="cookieReject">Recusar</button>' +
        '</div>';
      document.body.appendChild(ckInj);
    }
  }
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
  /* ---------- Pixel da Meta (só após consentimento) ---------- */
  //
  // Mesma regra do LinkedIn Insight Tag: o Pixel NÃO entra na página antes do
  // aceite do banner. Rastreador de terceiro carregado antes disso é tratamento
  // de dado sem base legal (LGPD) — e foi exatamente o que fez a tag do LinkedIn
  // ficar "Unverified" por dias: ela não existia até alguém clicar em aceitar.
  //
  // Difere do Google Ads DE PROPÓSITO: o gtag usa Consent Mode v2 e carrega
  // sempre, com consentimento negado por padrão (modela a conversão sem cookie).
  // A Meta não tem equivalente — ou o Pixel está lá, ou não está.
  var META_PIXEL_ID = "1637180061387534";
  var fbLoaded = false;
  function loadMetaPixel() {
    if (fbLoaded) return;
    fbLoaded = true;
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    try {
      window.fbq("init", META_PIXEL_ID);
      window.fbq("track", "PageView");
    } catch (e) {}
  }

    // Dispara os rastreadores conforme o consentimento. O LinkedIn Insight Tag
    // é cookie de marketing.
    if (prefs.marketing) { loadLinkedInInsight(); loadMetaPixel(); }
    updateAdsConsent(prefs);
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
  // Já consentiu marketing antes: carrega o LinkedIn Insight Tag de imediato.
  if (hasConsent && getPrefs().marketing) { loadLinkedInInsight(); loadMetaPixel(); }
  if (hasConsent) updateAdsConsent(getPrefs());

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
