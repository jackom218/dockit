DOCKIT — Quote & Invoice Generator for Tradespeople
=====================================================

WHAT THIS IS
------------
A single static website. No database, no accounts, no server-side code.
Tradespeople open the page, fill in a form, watch a professional-looking
quote or invoice build itself on the right, then download it as a PDF
or hit "Email it" to open their mail app with everything ready to send.

Everything happens in the visitor's own browser. Nothing they type is
sent anywhere or stored on your server — which is also a nice thing to
tell customers ("your data never leaves your device").


HOW TO PUBLISH IT
------------------
This is plain HTML/CSS/JS, so it works on any standard web hosting —
cPanel, Netlify, GitHub Pages, anywhere you can upload files.

1. Upload the whole contents of this folder (index.html + the assets
   folder) to your hosting — e.g. via cPanel's File Manager, or FTP,
   into public_html/ (or a subfolder like public_html/dockit/ if you
   want it at yoursite.com/dockit).
2. Keep index.html and the assets/ folder in the same relative
   position to each other — don't separate them.
3. That's it. No build step, no npm install, no server config.

Everything the page needs (fonts, the logo) is already inside the
assets folder — it doesn't call out to any external CDN, so it'll
keep working even if a third-party service goes down.


HOW THE PDF EXPORT WORKS (AND WHY IT'S SHARP)
-----------------------------------------------
"Print / Save as PDF" uses the browser's own native print engine
(window.print()) rather than a screenshot-style library. A lot of
simple web PDF tools take a screenshot of the page and drop that
picture into a PDF — which looks fine until someone zooms in, at
which point it's just a blown-up photo and goes blurry.

This site instead hands the real page — real text, real fonts —
to the browser's own print pipeline, the same mechanism Word or
LibreOffice use to export PDFs. The text comes out as genuine vector
text: sharp at any zoom level, selectable, and searchable.

The trade-off: instead of an instant silent download, it opens the
browser's print dialog, where the person chooses "Save as PDF" (or
picks an actual printer, which also works). It's one extra click, but
it's what gets the quality right on a site with no backend.

One setting worth knowing: some browsers hide background colours
when printing unless "Background graphics" is switched on in the
dialog's settings — otherwise the navy header bar and shaded rows
would print as plain white. The page already sets the CSS that tells
the browser to keep them on; recent Chrome/Edge respect that
automatically, but on older browsers someone might need to tick that
box themselves the first time. The hint text under the buttons
mentions this.


THE ONE REAL LIMITATION — EMAIL
--------------------------------
Because this is a static site with no backend, it can't send emails
by itself, and no browser allows a webpage to auto-attach a file to an
email for security reasons. So "Email it" does the next best thing:

  1. Opens the print dialog so they save the PDF (same as above)
  2. Once that dialog closes, it opens their default mail app with
     the subject/body already written and the client's email in the
     "To" field
  3. They just attach the file they just saved and hit send

This matches how most simple invoicing tools handle it without a
backend. If you later want fully automatic sending, that needs a small
server component (e.g. PHP with PHPMailer, since you mentioned your
hosting supports PHP) — happy to help build that as a v2.


MONETIZATION — "REMOVE WATERMARK" PAYWALL
--------------------------------------------
The free version stamps a small "Made with DockIt" line at the bottom
of every exported quote/invoice. Paying once removes it, permanently,
for that browser. This is already built and wired up — you just need
to do the Stripe side of the setup (a few minutes, no code).

STEP 1 — Create the Payment Link in Stripe
  1. In your Stripe Dashboard, go to Payment links -> Create payment link.
  2. Add a one-time product, e.g. "DockIt — remove watermark", set
     your price (the site currently shows "\u20ac9" as a placeholder).
  3. Under "After payment", choose "Don't show confirmation page" ->
     "Redirect customers to your website", and enter your success page:
         https://YOURDOMAIN.com/success.html
     For the current Netlify site that is exactly:
         https://dock-it-pay.netlify.app/success.html

     IMPORTANT: point it at /success.html (a real page in this folder),
     NOT at the site root with ?dockit_unlocked=1 on the end. Netlify's
     drag-and-drop hosting 404s a bare query string on the root, but it
     always serves a real file like success.html correctly. The
     success page sets the "unlocked" flag and then sends the customer
     back into the app automatically. (The old ?dockit_unlocked=1
     method still works as a fallback if you host somewhere that
     supports it, but success.html is the reliable one for Netlify.)
  4. Save, then copy the generated link — it looks like
     https://buy.stripe.com/xxxxxxxxxxxx

STEP 2 — Tell the site about it
  Open assets/app.js and find the MONETIZATION block near the top:

      const MONETIZATION = {
        stripePaymentLinkUrl: "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
        priceLabel: "\u20ac9",
        unlockParam: "dockit_unlocked",
        storageKey: "dockit_watermark_removed"
      };

  Paste your real Payment Link into stripePaymentLinkUrl, and change
  priceLabel if you picked a different price (this is the only place
  the price is defined — it's what shows on the button). Leave
  unlockParam as "dockit_unlocked" unless you changed it in Step 1 too
  — the two need to match exactly.

  Until you paste a real link in, clicking the button shows a toast
  telling you it's not configured yet, rather than sending customers
  to a broken page.

THE TWO PLACES CUSTOMERS ARE ASKED TO BUY
  1. A small green "Remove watermark" banner that always sits in the
     form (quiet, always available).
  2. A popup that appears once, about 30 seconds into a session, for
     people who haven't paid. If they dismiss it ("Maybe later", the X,
     clicking outside it, or Escape) it won't show again for the rest
     of that visit — but can appear again on a fresh visit/new tab.
     People who've already paid never see it.
  To change the 30-second timing, edit POPUP_DELAY_MS near the bottom
  of assets/app.js (the value is in milliseconds, so 30000 = 30s).

HOW THE UNLOCK ACTUALLY WORKS
  Click "Remove watermark" -> opens your Stripe Payment Link in a new
  tab -> they pay -> Stripe redirects them back to your site with
  ?dockit_unlocked=1 in the URL -> the site notices that, remembers it
  in that browser's local storage, and removes the param from the
  address bar. From then on, that browser never sees the watermark
  again — including next time they visit, close the tab, etc.

BE AWARE — THIS IS NOT A REAL PAYWALL
  Worth understanding clearly before you rely on it: because this is
  a static site with no server, there's no way to cryptographically
  verify a payment actually happened. Anyone who opens their browser's
  developer console could unlock it for free, either by visiting
  yoursite.com/?dockit_unlocked=1 directly without paying, or by typing
  one line of JavaScript. There's no backend to check with Stripe
  first, so the site has to just trust the redirect.

  For a low-cost tool aimed at non-technical tradespeople, this is a
  common and generally accepted trade-off — it's the same model old
  shareware "unlock codes" used for decades, and most people simply
  won't go looking for the loophole. But it is a soft honesty system,
  not real payment enforcement, and you should decide if that's good
  enough for how much this matters to you.

  If you ever want it properly secured, the fix is a small server-side
  check — since your hosting supports PHP, that would mean a short PHP
  script that takes the Stripe checkout session ID from the redirect,
  asks Stripe's API "was this actually paid?" using a secret key that
  never leaves the server, and only then tells the page to unlock.
  That closes the loophole completely. Happy to build that with you
  whenever you're ready for it — it's a genuinely small addition, just
  one that needs a live PHP-capable server to test against, which is
  why it isn't built in from day one.


CUSTOMISING IT
--------------
Your logo is already wired in: it's inlined directly in the header of
index.html (white version, for the dark navy bar), with two more
copies saved in assets/logo/ for reuse elsewhere:

  assets/logo/dockit-logo-on-dark.svg   → white text, for dark backgrounds
  assets/logo/dockit-logo-on-light.svg  → black text, for white/light backgrounds
  assets/logo/favicon.svg               → icon only, used as the browser tab icon

Open assets/style.css — the colours, fonts and spacing are controlled
by the CSS variables at the very top of the file (:root block):

  --navy, --amber, --paper, etc.   → change the colour scheme
  --font-display / --font-body / --font-mono → change typography
                                       (swap in your own fonts.css
                                       @font-face rules if you want
                                       different typefaces)

Open assets/app.js to change:
  DEFAULT_NOTES              → the default T&Cs / payment terms text
  vatRate <option> values    → the VAT rate dropdown in index.html

Open index.html to change:
  <title>                    → browser tab title
  .brand-name / .brand-tag   → the "DockIt" name and tagline in the
                                 header — rename this to whatever you
                                 want to call the product
  The <select id="currency"> options → add more currencies if needed


WHAT'S DELIBERATELY LEFT OUT (v1 scope)
-----------------------------------------
Per your brief, this is a "fill it in fresh each time" tool: no
login, no saved history, no database. If down the line you want:
  - tradespeople to save their business profile so they don't
    re-type it every time
  - a history of past quotes/invoices
  - fully automatic emailing
  - your own branding/domain, analytics, etc.

...those are all realistic next steps, but each one means adding a
backend (even a lightweight one), so worth doing as a deliberate v2
rather than baking in now.


FILES
-----
index.html                        — the page structure
assets/style.css                  — all visual design
assets/app.js                     — all the logic (calculations,
                                     PDF export via native print,
                                     email flow)
assets/fonts.css + assets/fonts/  — self-hosted fonts (Inter, IBM
                                     Plex Sans, IBM Plex Mono)
_redirects                        — Netlify config file, no file
                                     extension, don't delete it. Fixes
                                     a Netlify quirk where a URL with
                                     a query string (like the one
                                     Stripe redirects to after payment,
                                     ?dockit_unlocked=1) 404s even
                                     though the plain URL works fine.
                                     This file tells Netlify to serve
                                     index.html for every path/query
                                     instead of 404ing. If you move
                                     hosting off Netlify (e.g. to
                                     cPanel), this specific file has no
                                     effect there and is safe to leave
                                     in or remove — cPanel/Apache
                                     hosting doesn't have this issue.

No PDF library needed any more — the export uses the browser's own
built-in print engine, so there's nothing extra to bundle.
