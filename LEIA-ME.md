# LGPD em Saúde — www.lgpdesaude.com.br

Site institucional de captação para a frente de atuação **LGPD na Saúde** do escritório
Denis Carvalho Advocacia (OAB/GO 53.904). Construído em **HTML + CSS + JavaScript puro**
(sem framework, sem build), no mesmo padrão dos demais sites da rede.

---

## 📁 Estrutura

```
Site LGPD/
├── index.html                          ← página principal (landing)
├── blog.html                           ← lista de artigos
├── artigo-anpd-saude.html              ← artigo do blog
├── artigo-prontuario-eletronico.html   ← artigo do blog
├── artigo-vazamento-dados-saude.html   ← artigo do blog
├── privacidade.html                    ← Política de Privacidade (LGPD)
├── cookies.html                        ← Política de Cookies + gestão de preferências
├── LEIA-ME.md                          ← este arquivo
└── assets/
    ├── css/styles.css                  ← folha de estilo única
    ├── js/main.js                      ← interações (menu, e-book, cookies, etc.)
    ├── img/                            ← imagens (logo, foto, fotos de saúde)
    └── ebooks/
        ├── _ebook-fonte.html           ← fonte do e-book (editável)
        └── guia-lgpd-na-saude.pdf      ← e-book entregue no formulário
```

---

## ☎️ Contatos usados no site

- **WhatsApp / telefone principal (com link):** (62) 99258-6422 → `5562992586422`
- **Telefone secundário (apenas texto, sem link):** (64) 99945-2151
- **E-mail:** contato@deniscarvalhoadvocacia.com.br

Para trocar o número de WhatsApp, altere `WA_NUMBER` em `assets/js/main.js` **e**
os links `wa.me/5562992586422` espalhados pelo HTML (busque por `5562992586422`).

---

## ✉️ Captação de leads (e-book)

O formulário do e-book usa o serviço **Web3Forms** (gratuito). A chave está em
`assets/js/main.js` → `LEAD_FORM_ACCESS_KEY` (mesma conta dos outros sites; os leads
chegam por e-mail). Para usar outra conta, gere uma chave em https://web3forms.com.
Se deixar a chave em branco (`""`), o site apenas entrega o PDF, sem registrar o lead.

---

## 🍪 Gestão de cookies

- Banner inicial com **Aceitar todos / Recusar / Personalizar**.
- Modal de preferências granulares (Essenciais, Analíticos, Marketing).
- A decisão fica salva em `localStorage` (`lgpdsaude_cookie_consent` / `..._prefs`).
- Reabra o modal por qualquer link com `data-open-cookie` (rodapé e página de cookies).
- Para realmente carregar o Google Analytics só após o consentimento, descomente o
  bloco no `<head>` do `index.html` e ative dentro de `savePrefs()` em `main.js`
  (há um comentário indicando o ponto).

---

## 📘 Atualizar o e-book

1. Edite `assets/ebooks/_ebook-fonte.html`.
2. Gere o PDF (Edge/Chrome em modo headless):
   ```
   msedge --headless=new --no-pdf-header-footer ^
     --print-to-pdf="assets/ebooks/guia-lgpd-na-saude.pdf" ^
     "file:///CAMINHO/COMPLETO/_ebook-fonte.html"
   ```
   Ou abra o HTML no navegador e use **Imprimir → Salvar como PDF**.

---

## 📝 Adicionar um artigo no blog

1. Duplique um arquivo `artigo-*.html` e edite o conteúdo.
2. Em `blog.html` e na seção "Blog" do `index.html`, copie um bloco
   `<article class="post">…</article>` apontando para o novo arquivo.

---

## 🚀 Publicação

É um site estático: basta subir a pasta inteira para qualquer hospedagem
(Hostinger, Vercel, Netlify, GitHub Pages, etc.) e apontar o domínio
`www.lgpdesaude.com.br` para ela. Não há etapa de build.

Antes de publicar, troque, se quiser, o ID `G-XXXXXXXXXX` do Google Analytics
no `<head>` do `index.html`.

---

© 2026 Denis Carvalho Advocacia · OAB/GO 53.904. Conteúdo informativo, em conformidade
com o Provimento nº 205/2021 do CFOAB.
