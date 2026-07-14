(function () {
  "use strict";

  /* ---------------------------------------------------------
     Defaults & constants
     --------------------------------------------------------- */
  const CURRENCY_SYMBOL = { EUR: "\u20AC", GBP: "\u00A3" };
  const CURRENCY_LOCALE = { EUR: "en-IE", GBP: "en-GB" };

  const DEFAULT_NOTES = {
    quote:
      "This quotation is valid for 30 days from the date of issue.\n" +
      "Price includes materials and labour unless stated otherwise.\n" +
      "A deposit may be requested before work begins, with the balance due on completion.\n" +
      "Any work outside this quotation will be agreed separately before proceeding.",
    invoice:
      "Payment is due within 14 days of the invoice date.\n" +
      "Please use the invoice number as your payment reference.\n" +
      "A late payment charge may apply to overdue balances."
  };

  /* ---------------------------------------------------------
     Monetization — watermark removal via Stripe Payment Link
     ---------------------------------------------------------
     EDIT THESE TWO VALUES once you've set up your Stripe Payment
     Link (see README.txt for the exact Stripe dashboard steps):
     --------------------------------------------------------- */
  const MONETIZATION = {
    // Paste your real Stripe Payment Link URL here (starts with
    // https://buy.stripe.com/...). Leave the placeholder in and the
    // button will politely tell you it's not configured yet, rather
    // than sending customers to a broken link.
    stripePaymentLinkUrl: "https://buy.stripe.com/fZucN5bP63ms657bTP6g801",
    priceLabel: "\u20AC9",
    // Must match the redirect URL you set in Stripe's "After payment"
    // settings, e.g. https://yourdomain.com/?dockit_unlocked=1
    unlockParam: "dockit_unlocked",
    storageKey: "dockit_watermark_removed"
  };

  let itemSeq = 0;
  let logoDataUrl = "";
  let docType = "quote"; // 'quote' | 'invoice'
  let notesTouchedByUser = false; // once user edits notes manually, stop auto-swapping defaults

  /* ---------------------------------------------------------
     Element refs
     --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  const el = {
    doctypeSwitch: $("doctypeSwitch"),
    itemsRows: $("itemsRows"),
    addItemBtn: $("addItemBtn"),

    logoDrop: $("logoDrop"),
    logoInput: $("logoInput"),
    logoDropEmpty: $("logoDropEmpty"),
    logoDropFilled: $("logoDropFilled"),
    logoPreview: $("logoPreview"),
    logoRemove: $("logoRemove"),

    bizName: $("bizName"),
    bizPhone: $("bizPhone"),
    bizAddress: $("bizAddress"),
    bizEmail: $("bizEmail"),
    currency: $("currency"),

    vatRegistered: $("vatRegistered"),
    vatFieldsRow: $("vatFieldsRow"),
    bizVat: $("bizVat"),
    vatRate: $("vatRate"),
    vatCustomField: $("vatCustomField"),
    vatCustom: $("vatCustom"),

    clientName: $("clientName"),
    clientAddress: $("clientAddress"),
    clientEmail: $("clientEmail"),

    docNumberLabel: $("docNumberLabel"),
    docNumber: $("docNumber"),
    dateIssued: $("dateIssued"),
    dateSecondaryLabel: $("dateSecondaryLabel"),
    dateSecondary: $("dateSecondary"),

    bankSection: $("bankSection"),
    bankName: $("bankName"),
    bankIban: $("bankIban"),
    bankBic: $("bankBic"),

    notesLabel: $("notesLabel"),
    notes: $("notes"),

    emailBtn: $("emailBtn"),
    downloadBtn: $("downloadBtn"),

    mobileTabs: $("mobileTabs"),
    panelForm: $("panelForm"),
    panelPreview: $("panelPreview"),

    toast: $("toast"),

    // preview / doc targets
    docLogoSlot: $("docLogoSlot"),
    docLogoImg: $("docLogoImg"),
    docBizName: $("docBizName"),
    docBizAddress: $("docBizAddress"),
    docBizMeta: $("docBizMeta"),
    docDocType: $("docDocType"),
    docMetaNumber: $("docMetaNumber"),
    docMetaDate: $("docMetaDate"),
    docMetaSecondaryLabel: $("docMetaSecondaryLabel"),
    docMetaSecondary: $("docMetaSecondary"),
    docToEyebrow: $("docToEyebrow"),
    docClientName: $("docClientName"),
    docClientAddress: $("docClientAddress"),
    docItemsBody: $("docItemsBody"),
    docSubtotal: $("docSubtotal"),
    docVatRow: $("docVatRow"),
    docVatLabel: $("docVatLabel"),
    docVat: $("docVat"),
    docTotalLabel: $("docTotalLabel"),
    docTotal: $("docTotal"),
    docBank: $("docBank"),
    docBankLines: $("docBankLines"),
    docNotesEyebrow: $("docNotesEyebrow"),
    docNotesBody: $("docNotesBody"),
    docFooter: $("docFooter"),
    docWatermark: $("docWatermark"),
    doc: $("doc"),

    upsellBanner: $("upsellBanner"),
    upsellPrice: $("upsellPrice"),
    removeWatermarkBtn: $("removeWatermarkBtn"),

    upsellModal: $("upsellModal"),
    upsellModalBackdrop: $("upsellModalBackdrop"),
    upsellModalClose: $("upsellModalClose"),
    upsellModalBuy: $("upsellModalBuy"),
    upsellModalLater: $("upsellModalLater"),
    upsellModalPrice: $("upsellModalPrice")
  };

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  function fmtMoney(amount) {
    const cur = el.currency.value;
    const n = isFinite(amount) ? amount : 0;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE[cur] || "en-IE", {
        style: "currency",
        currency: cur
      }).format(n);
    } catch (e) {
      return (CURRENCY_SYMBOL[cur] || "") + n.toFixed(2);
    }
  }

  function fmtDate(dateStr) {
    if (!dateStr) return "\u2014";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return "\u2014";
    return d.toLocaleDateString("en-IE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function addDaysISO(base, days) {
    const d = base ? new Date(base + "T00:00:00") : new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2600);
  }

  function generateDocNumber(type) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 90) + 10);
    const prefix = type === "invoice" ? "INV" : "Q";
    return `${prefix}-${y}${m}${dd}-${rand}`;
  }

  /* ---------------------------------------------------------
     Line items
     --------------------------------------------------------- */
  function addItemRow(prefill) {
    itemSeq += 1;
    const id = "item-" + itemSeq;
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.id = id;
    row.innerHTML = `
      <input type="text" class="item-desc" placeholder="Describe the work or materials" value="${prefill && prefill.desc ? escapeAttr(prefill.desc) : ""}" />
      <input type="number" class="item-qty" min="0" step="1" value="${prefill && prefill.qty != null ? prefill.qty : 1}" />
      <input type="number" class="item-price" min="0" step="0.01" value="${prefill && prefill.price != null ? prefill.price : ""}" placeholder="0.00" />
      <span class="item-total">${fmtMoney(0)}</span>
      <button type="button" class="item-remove" title="Remove item">&times;</button>
    `;
    el.itemsRows.appendChild(row);

    row.querySelector(".item-desc").addEventListener("input", renderAll);
    row.querySelector(".item-qty").addEventListener("input", renderAll);
    row.querySelector(".item-price").addEventListener("input", renderAll);
    row.querySelector(".item-remove").addEventListener("click", () => {
      row.remove();
      renderAll();
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getItems() {
    return Array.from(el.itemsRows.querySelectorAll(".item-row")).map((row) => {
      const desc = row.querySelector(".item-desc").value.trim();
      const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
      const price = parseFloat(row.querySelector(".item-price").value) || 0;
      return { desc, qty, price, total: qty * price, rowEl: row };
    });
  }

  /* ---------------------------------------------------------
     VAT
     --------------------------------------------------------- */
  function getVatRate() {
    if (!el.vatRegistered.checked) return 0;
    const sel = el.vatRate.value;
    if (sel === "custom") return parseFloat(el.vatCustom.value) || 0;
    return parseFloat(sel) || 0;
  }

  /* ---------------------------------------------------------
     Doc type toggle
     --------------------------------------------------------- */
  function setDocType(type) {
    docType = type;
    el.doctypeSwitch.dataset.active = type;
    el.doctypeSwitch.querySelectorAll(".dt-btn").forEach((b) => {
      b.classList.toggle("current", b.dataset.type === type);
    });

    const isInvoice = type === "invoice";
    el.docNumberLabel.textContent = isInvoice ? "Invoice number" : "Quote number";
    el.dateSecondaryLabel.textContent = isInvoice ? "Due date" : "Valid until";
    el.notesLabel.textContent = isInvoice ? "Payment terms" : "Terms & conditions";
    el.bankSection.hidden = !isInvoice;

    // Regenerate doc number to match the new prefix, keep if user already customised heavily? Simplest: regenerate.
    el.docNumber.value = generateDocNumber(type);

    // Swap notes default unless the user has typed their own custom text
    if (!notesTouchedByUser) {
      el.notes.value = DEFAULT_NOTES[type];
    }

    renderAll();
  }

  /* ---------------------------------------------------------
     Master render
     --------------------------------------------------------- */
  function renderAll() {
    const isInvoice = docType === "invoice";
    const items = getItems();

    // update per-row totals
    items.forEach((it) => {
      it.rowEl.querySelector(".item-total").textContent = fmtMoney(it.total);
    });

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const vatRate = getVatRate();
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    // Header / business
    el.docBizName.textContent = el.bizName.value.trim() || "Your Business Name";
    el.docBizAddress.textContent = el.bizAddress.value.trim() || "Business address";
    const metaParts = [];
    if (el.vatRegistered.checked && el.bizVat.value.trim()) metaParts.push(`<b>VAT</b> ${escapeHtml(el.bizVat.value.trim())}`);
    if (el.bizPhone.value.trim()) metaParts.push(`<b>Phone</b> ${escapeHtml(el.bizPhone.value.trim())}`);
    if (el.bizEmail.value.trim()) metaParts.push(`<b>Email</b> ${escapeHtml(el.bizEmail.value.trim())}`);
    el.docBizMeta.innerHTML = metaParts.join(" &nbsp;\u00B7&nbsp; ");

    // Logo
    if (logoDataUrl) {
      el.docLogoSlot.hidden = false;
      el.docLogoImg.src = logoDataUrl;
    } else {
      el.docLogoSlot.hidden = true;
    }

    // Doc type / meta
    el.docDocType.textContent = isInvoice ? "INVOICE" : "QUOTATION";
    el.docMetaNumber.textContent = el.docNumber.value || "\u2014";
    el.docMetaDate.textContent = fmtDate(el.dateIssued.value);
    el.docMetaSecondaryLabel.textContent = isInvoice ? "Due date" : "Valid until";
    el.docMetaSecondary.textContent = fmtDate(el.dateSecondary.value);

    // Client / to
    el.docToEyebrow.textContent = isInvoice ? "INVOICE FOR" : "QUOTATION FOR";
    el.docClientName.textContent = el.clientName.value.trim() || "Client name";
    el.docClientAddress.textContent = el.clientAddress.value.trim() || "Client address";

    // Items table
    el.docItemsBody.innerHTML = items
      .map(
        (it) => `
      <tr>
        <td class="col-desc">${escapeHtml(it.desc) || "&nbsp;"}</td>
        <td class="col-qty">${it.qty || 0}</td>
        <td class="col-price">${fmtMoney(it.price)}</td>
        <td class="col-total">${fmtMoney(it.total)}</td>
      </tr>`
      )
      .join("") || `<tr><td class="col-desc" colspan="4" style="color:#9aa3ab;">Add line items on the left \u2014 they'll appear here.</td></tr>`;

    // Summary
    el.docSubtotal.textContent = fmtMoney(subtotal);
    if (vatRate > 0) {
      el.docVatRow.hidden = false;
      el.docVatLabel.textContent = `VAT @ ${vatRate % 1 === 0 ? vatRate : vatRate}%`;
      el.docVat.textContent = fmtMoney(vat);
    } else {
      el.docVatRow.hidden = true;
    }
    el.docTotalLabel.textContent = isInvoice ? "Total due" : "Total (incl. VAT)";
    el.docTotal.textContent = fmtMoney(total);

    // Bank details (invoice only)
    if (isInvoice && (el.bankName.value.trim() || el.bankIban.value.trim() || el.bankBic.value.trim())) {
      el.docBank.hidden = false;
      const lines = [];
      if (el.bankName.value.trim()) lines.push(`<div>Account name: <b>${escapeHtml(el.bankName.value.trim())}</b></div>`);
      if (el.bankIban.value.trim()) lines.push(`<div>IBAN: <b>${escapeHtml(el.bankIban.value.trim())}</b></div>`);
      if (el.bankBic.value.trim()) lines.push(`<div>BIC: <b>${escapeHtml(el.bankBic.value.trim())}</b></div>`);
      el.docBankLines.innerHTML = lines.join("");
    } else {
      el.docBank.hidden = true;
    }

    // Notes
    el.docNotesEyebrow.textContent = isInvoice ? "Payment Terms" : "Terms & Conditions";
    el.docNotesBody.textContent = el.notes.value;

    // Footer
    const footerParts = [el.bizName.value.trim() || "Your Business Name"];
    if (el.bizPhone.value.trim()) footerParts.push(el.bizPhone.value.trim());
    if (el.bizEmail.value.trim()) footerParts.push(el.bizEmail.value.trim());
    el.docFooter.textContent = footerParts.join("  \u00B7  ");
  }

  /* ---------------------------------------------------------
     Logo upload
     --------------------------------------------------------- */
  el.logoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Logo is a bit large \u2014 try an image under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = reader.result;
      el.logoPreview.src = logoDataUrl;
      el.logoDropEmpty.hidden = true;
      el.logoDropFilled.hidden = false;
      renderAll();
    };
    reader.readAsDataURL(file);
  });
  el.logoRemove.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    logoDataUrl = "";
    el.logoInput.value = "";
    el.logoDropEmpty.hidden = false;
    el.logoDropFilled.hidden = true;
    renderAll();
  });
  // simple drag & drop support
  ["dragover", "dragleave", "drop"].forEach((evt) => {
    el.logoDrop.addEventListener(evt, (e) => e.preventDefault());
  });
  el.logoDrop.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      el.logoInput.files = e.dataTransfer.files;
      el.logoInput.dispatchEvent(new Event("change"));
    }
  });

  /* ---------------------------------------------------------
     Wire up simple inputs -> re-render
     --------------------------------------------------------- */
  [
    "bizName", "bizPhone", "bizAddress", "bizEmail", "currency",
    "bizVat", "clientName", "clientAddress", "clientEmail",
    "docNumber", "dateIssued", "dateSecondary",
    "bankName", "bankIban", "bankBic"
  ].forEach((id) => el[id].addEventListener("input", renderAll));

  el.notes.addEventListener("input", () => {
    notesTouchedByUser = true;
    renderAll();
  });

  el.vatRegistered.addEventListener("change", () => {
    el.vatFieldsRow.style.display = el.vatRegistered.checked ? "" : "none";
    renderAll();
  });
  el.vatRate.addEventListener("change", () => {
    el.vatCustomField.hidden = el.vatRate.value !== "custom";
    renderAll();
  });
  el.vatCustom.addEventListener("input", renderAll);

  el.doctypeSwitch.querySelectorAll(".dt-btn").forEach((btn) => {
    btn.addEventListener("click", () => setDocType(btn.dataset.type));
  });

  el.addItemBtn.addEventListener("click", () => addItemRow());

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      el.dateSecondary.value = addDaysISO(el.dateIssued.value, parseInt(chip.dataset.days, 10));
      renderAll();
    });
  });

  /* ---------------------------------------------------------
     Mobile tabs
     --------------------------------------------------------- */
  el.mobileTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.mobileTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const showForm = btn.dataset.tab === "form";
      el.panelForm.classList.toggle("active", showForm);
      el.panelPreview.classList.toggle("active", !showForm);
    });
  });

  /* ---------------------------------------------------------
     Export: Print / Save as PDF / Email
     ---------------------------------------------------------
     We deliberately use the browser's own native print-to-PDF
     (window.print) rather than a screenshot-based library like
     html2canvas. A screenshot library rasterises the page into a
     picture and drops that picture into a PDF, so the text turns
     blurry the moment someone zooms in. Printing natively lets the
     browser lay the text out as real, vector text — the same way a
     Word or LibreOffice export works — so it stays sharp at any
     zoom level and stays selectable/searchable in the PDF.
     --------------------------------------------------------- */
  const ORIGINAL_TITLE = document.title;

  function setPrintTitle() {
    // Browsers use document.title to suggest a filename in the
    // "Save as PDF" dialog, so we set it just before printing.
    const type = docType === "invoice" ? "Invoice" : "Quote";
    const client = (el.clientName.value.trim() || "Client").replace(/[^\w\-]+/g, "_");
    const num = (el.docNumber.value.trim() || "").replace(/[^\w\-]+/g, "_");
    document.title = `${type}_${client}${num ? "_" + num : ""}`;
  }

  function restorePrintTitle() {
    document.title = ORIGINAL_TITLE;
  }

  el.downloadBtn.addEventListener("click", () => {
    if (!getItems().length) {
      showToast("Add at least one line item first");
      return;
    }
    setPrintTitle();
    window.addEventListener("afterprint", restorePrintTitle, { once: true });
    window.print();
  });

  el.emailBtn.addEventListener("click", () => {
    if (!getItems().length) {
      showToast("Add at least one line item first");
      return;
    }
    const typeLabel = docType === "invoice" ? "invoice" : "quotation";
    const biz = el.bizName.value.trim() || "us";
    const subject = `${docType === "invoice" ? "Invoice" : "Quote"} ${el.docNumber.value || ""} from ${biz}`.trim();
    const body =
      `Hi ${el.clientName.value.trim() || "there"},\n\n` +
      `Please find attached your ${typeLabel} ${el.docNumber.value || ""} from ${biz}.\n\n` +
      `The PDF has just saved to your device \u2014 please attach it to this email before sending.\n\n` +
      `Thanks,\n${biz}`;
    const to = el.clientEmail.value.trim();
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    function afterPrint() {
      window.removeEventListener("afterprint", afterPrint);
      restorePrintTitle();
      setTimeout(() => {
        window.location.href = mailto;
      }, 350);
    }

    showToast('Choose "Save as PDF", then your email app will open\u2026');
    setPrintTitle();
    window.addEventListener("afterprint", afterPrint);
    window.print();
  });

  /* ---------------------------------------------------------
     Monetization: watermark removal
     ---------------------------------------------------------
     How this works end-to-end:
     1. Person clicks "Remove watermark" -> opens your Stripe
        Payment Link in a new tab.
     2. They pay. Stripe's "After payment" redirect (which you
        configure in the Stripe dashboard, see README.txt) sends
        them back to this site with ?dockit_unlocked=1 in the URL.
     3. On load, we see that param, remember it in this browser's
        localStorage, and strip the param back out of the URL.
     4. From then on, this browser never shows the watermark again.

     Honest limitation: this is a static site with no server, so
     there is no way to cryptographically verify a payment actually
     happened. Someone technical could open dev tools and either
     visit yoursite.com/?dockit_unlocked=1 directly, or run
     localStorage.setItem('dockit_watermark_removed','true')
     themselves, without paying. For a low-cost tool aimed at
     non-technical tradespeople this is a common, accepted trade-off
     (the same way old shareware "unlock codes" worked) — but it is
     not a real paywall. If that risk ever matters to you, the fix is
     a small server-side check (a few lines of PHP, since your
     hosting supports it) that verifies the Stripe session before
     unlocking. README.txt has notes on this too.
     --------------------------------------------------------- */
  function isUnlocked() {
    try {
      return window.localStorage.getItem(MONETIZATION.storageKey) === "true";
    } catch (e) {
      return false; // storage unavailable (e.g. private browsing) -> fail safe to "show watermark"
    }
  }

  function checkUnlockFromUrl() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    if (params.get(MONETIZATION.unlockParam) === "1") {
      try {
        window.localStorage.setItem(MONETIZATION.storageKey, "true");
      } catch (e) {
        /* ignore — worst case they see the watermark despite paying, and can contact you */
      }
      params.delete(MONETIZATION.unlockParam);
      const rest = params.toString();
      const cleanUrl = window.location.pathname + (rest ? "?" + rest : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  }

  function applyUnlockState() {
    const unlocked = isUnlocked();
    el.docWatermark.hidden = unlocked;
    el.upsellBanner.hidden = unlocked;
  }

  function goToStripe() {
    if (!MONETIZATION.stripePaymentLinkUrl || MONETIZATION.stripePaymentLinkUrl.indexOf("REPLACE_WITH") !== -1) {
      showToast("Payment link isn't set up yet \u2014 add it in assets/app.js");
      return;
    }
    window.open(MONETIZATION.stripePaymentLinkUrl, "_blank", "noopener");
  }

  el.removeWatermarkBtn.addEventListener("click", goToStripe);

  /* ---------------------------------------------------------
     Timed upsell popup
     ---------------------------------------------------------
     Appears once, ~30s into a session, only for people who
     haven't already paid. "Maybe later" / close / backdrop all
     dismiss it, and a sessionStorage flag stops it coming back
     for the rest of that visit (it can show again on a fresh
     visit / new tab, which is the once-per-session behaviour).
     --------------------------------------------------------- */
  const POPUP_DELAY_MS = 30000;
  const POPUP_SESSION_KEY = "dockit_popup_dismissed_session";
  let popupTimer = null;

  function popupDismissedThisSession() {
    try {
      return window.sessionStorage.getItem(POPUP_SESSION_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function markPopupDismissed() {
    try {
      window.sessionStorage.setItem(POPUP_SESSION_KEY, "true");
    } catch (e) { /* ignore */ }
  }

  function openPopup() {
    // Never show to someone who already paid, or who dismissed it this session.
    if (isUnlocked() || popupDismissedThisSession()) return;
    el.upsellModal.hidden = false;
    document.addEventListener("keydown", onPopupKeydown);
  }

  function closePopup() {
    el.upsellModal.hidden = true;
    markPopupDismissed();
    document.removeEventListener("keydown", onPopupKeydown);
  }

  function onPopupKeydown(e) {
    if (e.key === "Escape") closePopup();
  }

  function schedulePopup() {
    if (isUnlocked() || popupDismissedThisSession()) return;
    if (popupTimer) clearTimeout(popupTimer);
    popupTimer = setTimeout(openPopup, POPUP_DELAY_MS);
  }

  el.upsellModalClose.addEventListener("click", closePopup);
  el.upsellModalLater.addEventListener("click", closePopup);
  el.upsellModalBackdrop.addEventListener("click", closePopup);
  el.upsellModalBuy.addEventListener("click", () => {
    goToStripe();
    closePopup(); // they've been sent to checkout; don't re-nag this session
  });

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */
  function init() {
    el.dateIssued.value = todayISO();
    el.dateSecondary.value = addDaysISO(el.dateIssued.value, 30);
    el.docNumber.value = generateDocNumber("quote");
    el.notes.value = DEFAULT_NOTES.quote;
    el.vatFieldsRow.style.display = "";
    el.upsellPrice.textContent = MONETIZATION.priceLabel;
    el.upsellModalPrice.textContent = MONETIZATION.priceLabel;

    addItemRow();
    addItemRow();

    checkUnlockFromUrl();
    applyUnlockState();
    schedulePopup();

    setDocType("quote");
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
