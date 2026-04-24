class ProductUpdated extends HTMLElement {
  connectedCallback() {
    const productJsonEl = this.querySelector('[data-product-json]');
    if (!productJsonEl) {
      console.warn('product-updated: missing [data-product-json] script.');
      return;
    }

    this.product = JSON.parse(productJsonEl.textContent);
    this.sqftPerBox = parseFloat(this.dataset.sqftPerBox) || 10.24;
    this.unitType = this.dataset.unitType || 'box';

    const initialVariantId = parseInt(this.dataset.currentVariantId, 10);
    this.currentVariant =
      this.product.variants.find((v) => v.id === initialVariantId) || this.product.variants[0];

    this.bindEvents();
    this.updateAll();
    this.initImageZoom();
  }

  initImageZoom() {
    // Mobile: zoom button click
    this.querySelectorAll('.media-zoom-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.openPhotoswipe(parseInt(btn.dataset.index, 10) - 1));
    });

    // Desktop: clicking the image opens the lightbox
    this.querySelectorAll('.product-media-item .photoswipe__image').forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => this.openPhotoswipe(parseInt(img.dataset.index, 10) - 1));
    });
  }

  openPhotoswipe(index) {
    const images = [...this.querySelectorAll('.photoswipe__image')];
    const items = images.map((img) => ({
      src: img.dataset.photoswipeSrc || img.src,
      w: parseInt(img.dataset.photoswipeWidth, 10) || img.naturalWidth,
      h: parseInt(img.dataset.photoswipeHeight, 10) || img.naturalHeight,
      msrc: img.currentSrc || img.src,
      el: img,
    }));

    const pswpEl = document.querySelector('.pswp');
    if (!pswpEl || typeof PhotoSwipe === 'undefined' || typeof PhotoSwipeUI_Default === 'undefined') return;

    const gallery = new PhotoSwipe(pswpEl, PhotoSwipeUI_Default, items, {
      index,
      history: false,
      shareEl: false,
      captionEl: false,
      counterEl: false,
      preloaderEl: false,
      closeOnScroll: false,
      pinchToClose: false,
      allowPanToNext: true,
      tapToToggleControls: false,
      getThumbBoundsFn(i) {
        const thumb = items[i] && items[i].el;
        if (!thumb) return;
        const rect = thumb.getBoundingClientRect();
        return { x: rect.left, y: rect.top + window.pageYOffset, w: rect.width };
      },
    });
    gallery.init();
  }

  bindEvents() {
    this.addEventListener('click', (e) => {
      const optionBtn = e.target.closest('.buybox-color-swatch, .buybox-size-option');
      if (optionBtn && optionBtn.dataset.optionIndex !== undefined) {
        this.handleOptionClick(optionBtn);
        return;
      }

      // Sample button — adds the sample variant (quantity 1) to cart
      const sampleBtn = e.target.closest('[data-sample-btn]');
      if (sampleBtn) {
        e.preventDefault();
        this.handleSampleClick(sampleBtn);
      }
    });

    // Quantity changes from <quantity-input-updated>
    this.addEventListener('quantity:change', () => this.updatePrices());

    // Calculator changes from <sqft-calculator>
    this.addEventListener('calculator:change', (e) => {
      const qty = this.querySelector('quantity-input-updated');
      if (qty) qty.setValue(e.detail.boxes);
    });

    // Calculator open/close: "How much do I need?" opens, the X button closes
    const needLink = this.querySelector('.buybox-need-link');
    if (needLink) needLink.addEventListener('click', (e) => this.openCalculator(e));

    const closeBtn = this.querySelector('.buybox-calc-toggle');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCalculator());

    // Add to cart (form submission)
    const form = this.querySelector('[data-product-form]');
    if (form) form.addEventListener('submit', (e) => this.addToCart(e));

    // Wishlist
    const wishBtn = this.querySelector('[data-wishlist-btn]');
    if (wishBtn) {
      wishBtn.addEventListener('click', () => this.handleWishlistClick());
    }
  }

  handleOptionClick(button) {
    const optionIndex = parseInt(button.dataset.optionIndex, 10);
    const value = button.dataset.value;

    const nextOptions = [...this.currentVariant.options];
    nextOptions[optionIndex] = value;

    const newVariant = this.product.variants.find((v) =>
      v.options.every((opt, i) => opt === nextOptions[i])
    );
    if (!newVariant) return;

    this.currentVariant = newVariant;

    // Update active state for clicked group
    button.parentElement
      .querySelectorAll('[data-option-index]')
      .forEach((el) => el.classList.remove('is-active'));
    button.classList.add('is-active');

    this.updateAll();
    this.updateURL();
  }

  updateAll() {
    this.updatePrices();
    this.updateSku();
    this.updateMedia();
    this.updateAvailability();
    this.updateFormVariantId();
  }

  updatePrices() {
    const qty = this.getQuantity();
    const variantPrice = this.currentVariant.price;
    const pricePerSqft = variantPrice / this.sqftPerBox;
    const totalPrice = variantPrice * qty;

    this.setText('[data-price-sqft]', `${this.formatMoney(pricePerSqft)} per sq. ft.`);
    this.setText('[data-price-box]', `${this.formatMoney(variantPrice)} per ${this.unitType}`);
    this.setText('[data-total-price]', this.formatMoney(totalPrice));
    this.setText('[data-atc-price]', this.formatMoney(totalPrice));
  }

  updateSku() {
    const sku = this.currentVariant.sku;
    if (!sku) return;
    this.setText('[data-sku]', `SKU: ${sku}`);
  }

  updateMedia() {
    const img = this.currentVariant.featured_image;
    if (!img) return;
    const firstImg = this.querySelector('.product-media-item img');
    if (!firstImg) return;
    firstImg.src = this.appendImageWidth(img.src, 640);
    firstImg.alt = img.alt || '';
  }

  updateAvailability() {
    const atcBtn = this.querySelector('[data-add-to-cart]');
    if (!atcBtn) return;
    const label = atcBtn.querySelector('[data-atc-label]');
    if (this.currentVariant.available) {
      atcBtn.disabled = false;
      if (label) label.textContent = 'Add To Cart';
    } else {
      atcBtn.disabled = true;
      if (label) label.textContent = 'Sold Out';
    }
  }

  updateFormVariantId() {
    const variantInput = this.querySelector('[data-variant-id]');
    if (variantInput) variantInput.value = this.currentVariant.id;

    const wishBtn = this.querySelector('[data-wishlist-btn]');
    if (wishBtn) wishBtn.dataset.variantId = this.currentVariant.id;
  }

  updateURL() {
    if (!window.history.replaceState) return;
    const url = new URL(window.location);
    url.searchParams.set('variant', this.currentVariant.id);
    window.history.replaceState({}, '', url);
  }

  openCalculator(event) {
    const box = this.querySelector('.buybox-calc-box');
    if (!box) return;
    if (event) event.preventDefault();
    box.classList.add('is-open');
    // Scroll into view after the box is visible
    requestAnimationFrame(() => {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const firstInput = box.querySelector('input[type="number"]');
      if (firstInput) firstInput.focus();
    });
  }

  closeCalculator() {
    const box = this.querySelector('.buybox-calc-box');
    if (box) box.classList.remove('is-open');
  }

  async addToCart(event) {
    event.preventDefault();
    const atcBtn = this.querySelector('[data-add-to-cart]');
    if (!atcBtn || atcBtn.disabled) return;

    const label = atcBtn.querySelector('[data-atc-label]');
    await this.submitToCart({
      id: this.currentVariant.id,
      quantity: this.getQuantity(),
      buttons: [atcBtn],
      labels: label ? [label] : [],
      successText: 'Added!',
    });
  }

  async handleSampleClick(button) {
    const variantId = parseInt(button.dataset.sampleVariantId, 10);
    if (!variantId || button.disabled) return;

    // Sync state across both desktop + mobile sample buttons
    const allSampleBtns = this.querySelectorAll('[data-sample-btn]');
    const allSampleLabels = this.querySelectorAll('[data-sample-label]');

    await this.submitToCart({
      id: variantId,
      quantity: 1,
      buttons: allSampleBtns,
      labels: allSampleLabels,
      successText: 'Sample Added!',
    });
  }

  handleWishlistClick() {
    this.dispatchEvent(
      new CustomEvent('wishlist:add', {
        bubbles: true,
        detail: { product: this.product, variant: this.currentVariant },
      })
    );
  }

  async submitToCart({ id, quantity, buttons, labels, successText }) {
    const originalLabels = Array.from(labels).map((l) => l.innerHTML);

    buttons.forEach((b) => (b.disabled = true));
    labels.forEach((l) => (l.textContent = 'Adding...'));

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id, quantity }),
      });
      if (!response.ok) throw new Error('Add to cart failed');

      const item = await response.json();
      document.dispatchEvent(new CustomEvent('cart:item-added', { detail: { item } }));
      document.dispatchEvent(new CustomEvent('cart:updated'));

      // Notify the theme so it rebuilds the cart drawer and opens it
      document.dispatchEvent(new CustomEvent('ajaxProduct:added', { detail: { item } }));

      labels.forEach((l) => (l.textContent = successText));
      setTimeout(() => this.resetButtons(buttons, labels, originalLabels), 1500);
    } catch (error) {
      console.error('Add to cart error:', error);
      labels.forEach((l) => (l.textContent = 'Error - Try Again'));
      setTimeout(() => this.resetButtons(buttons, labels, originalLabels), 2000);
    }
  }

  resetButtons(buttons, labels, originalLabels) {
    labels.forEach((l, i) => (l.innerHTML = originalLabels[i]));
    buttons.forEach((b) => (b.disabled = false));
  }

  getQuantity() {
    const qtyComponent = this.querySelector('quantity-input-updated');
    if (!qtyComponent) return 1;
    if (typeof qtyComponent.getValue === 'function') return qtyComponent.getValue();
    // Fallback when custom element isn't upgraded yet (registration order issue)
    const valueEl = qtyComponent.querySelector('[data-qty-value]');
    return parseInt(valueEl?.textContent, 10) || 1;
  }

  setText(selector, text) {
    const el = this.querySelector(selector);
    if (el) el.textContent = text;
  }

  formatMoney(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  appendImageWidth(src, width) {
    if (!src) return src;
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}width=${width}`;
  }
}

customElements.define('product-updated', ProductUpdated);

/* ============================================================
   <quantity-input-updated> — +/- Quantity selector
   ============================================================ */
class QuantityInputUpdated extends HTMLElement {
  connectedCallback() {
    this.valueEl = this.querySelector('[data-qty-value]');
    this.hiddenInput = this.querySelector('[data-quantity-input]');
    this.minValue = parseInt(this.dataset.min, 10) || 1;

    const decrease = this.querySelector('.qty-decrease');
    const increase = this.querySelector('.qty-increase');

    if (decrease) decrease.addEventListener('click', () => this.setValue(this.getValue() - 1));
    if (increase) increase.addEventListener('click', () => this.setValue(this.getValue() + 1));
  }

  getValue() {
    return parseInt(this.valueEl.textContent, 10) || this.minValue;
  }

  setValue(val) {
    val = Math.max(this.minValue, parseInt(val, 10) || this.minValue);
    this.valueEl.textContent = val;
    if (this.hiddenInput) this.hiddenInput.value = val;
    this.dispatchEvent(
      new CustomEvent('quantity:change', { bubbles: true, detail: { value: val } })
    );
  }
}

customElements.define('quantity-input-updated', QuantityInputUpdated);

/* ============================================================
   <sqft-calculator> — Square footage calculator
   ============================================================ */
class SqftCalculator extends HTMLElement {
  connectedCallback() {
    this.sqftPerBox = parseFloat(this.dataset.sqftPerBox) || 10.24;
    this.unitType = this.dataset.unitType || 'box';

    this.sqftInput = this.querySelector('[data-calc-sqft]');
    this.boxesInput = this.querySelector('[data-calc-boxes]');
    this.calcBtn = this.querySelector('.buybox-calc-btn');
    this.overageCheckbox = this.querySelector('[data-calc-overage]');

    this.subtotalEl = this.querySelector('[data-calc-subtotal]');
    this.overageValueEl = this.querySelector('[data-calc-overage-value]');
    this.totalEl = this.querySelector('[data-calc-total]');
    this.boxesRequiredEl = this.querySelector('[data-calc-boxes-required]');
    this.sqftIncludedEl = this.querySelector('[data-calc-sqft-included]');

    this.calcBtn.addEventListener('click', () => this.calculate());
    this.overageCheckbox.addEventListener('change', () => this.calculate());

    [this.sqftInput, this.boxesInput].forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.calculate();
        }
      });
      // Clear the other field when typing in one (mutually exclusive)
      input.addEventListener('input', () => {
        if (input === this.sqftInput && input.value) this.boxesInput.value = '';
        if (input === this.boxesInput && input.value) this.sqftInput.value = '';
      });
    });
  }

  calculate() {
    let sqft = parseFloat(this.sqftInput.value) || 0;
    const boxes = parseFloat(this.boxesInput.value) || 0;

    if (boxes > 0 && sqft === 0) {
      sqft = boxes * this.sqftPerBox;
    }
    if (sqft <= 0) return;

    const subtotal = sqft;
    const overage = this.overageCheckbox.checked ? Math.round(sqft * 0.1) : 0;
    const total = subtotal + overage;
    const boxesRequired = Math.ceil(total / this.sqftPerBox);
    const sqftIncluded = (boxesRequired * this.sqftPerBox).toFixed(2);

    this.subtotalEl.textContent = `${this.fmt(subtotal)} sq. ft.`;
    this.overageValueEl.textContent = `${this.fmt(overage)} sq. ft.`;
    this.totalEl.textContent = `${this.fmt(total)} sq. ft.`;
    this.boxesRequiredEl.textContent = `${boxesRequired.toLocaleString('en-US')} @ ${this.sqftPerBox} sq.ft./${this.unitType}`;
    this.sqftIncludedEl.textContent = `${this.fmt(parseFloat(sqftIncluded))} sq.ft.`;

    this.dispatchEvent(
      new CustomEvent('calculator:change', {
        bubbles: true,
        detail: { boxes: boxesRequired, sqft: total },
      })
    );
  }

  fmt(n) {
    return Number.isInteger(n)
      ? n.toLocaleString('en-US')
      : parseFloat(n.toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

customElements.define('sqft-calculator', SqftCalculator);

/* ============================================================
   <quote-popup> — Request a Quote modal
   ============================================================
   - Wraps a native <dialog>.
   - Opens via any element with [data-quote-trigger] anywhere on the page.
   - Closes via [data-quote-close], Esc key, or backdrop click.
   - Submits the form via AJAX to Shopify's contact endpoint.
*/
class QuotePopup extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.form = this.querySelector('[data-quote-form]');
    this.successEl = this.querySelector('[data-quote-success]');
    this.errorEl = this.querySelector('[data-quote-error]');
    if (!this.dialog) return;

    // Open from any [data-quote-trigger] on the page
    this._onTriggerClick = (e) => {
      const trigger = e.target.closest('[data-quote-trigger]');
      if (!trigger) return;
      e.preventDefault();
      this.open();
    };
    document.addEventListener('click', this._onTriggerClick);

    // Close button
    const closeBtn = this.querySelector('[data-quote-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Backdrop click closes (clicking the dialog itself, not its inner content)
    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) this.close();
    });

    // Form submit
    if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  disconnectedCallback() {
    if (this._onTriggerClick) document.removeEventListener('click', this._onTriggerClick);
  }

  open() {
    this.resetMessages();
    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      // Fallback for browsers without <dialog> support
      this.dialog.setAttribute('open', '');
    }
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (typeof this.dialog.close === 'function') {
      this.dialog.close();
    } else {
      this.dialog.removeAttribute('open');
    }
    document.body.style.overflow = '';
  }

  resetMessages() {
    if (this.successEl) this.successEl.hidden = true;
    if (this.errorEl) this.errorEl.hidden = true;
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.resetMessages();

    const submitBtn = this.form.querySelector('[type="submit"]');
    const submitLabel = submitBtn.querySelector('[data-submit-label]');
    const originalText = submitLabel ? submitLabel.textContent : '';

    submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Sending...';

    try {
      const formData = new FormData(this.form);
      const response = await fetch('/contact#contact_form', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'text/html' },
      });

      if (!response.ok) throw new Error('Submission failed');

      // Success: reset form and show success state
      this.form.reset();
      if (this.successEl) this.successEl.hidden = false;
      if (submitLabel) submitLabel.textContent = originalText;
      submitBtn.disabled = false;

      // Auto-close after a moment so the user sees the success message
      setTimeout(() => this.close(), 2500);
    } catch (err) {
      console.error('Quote submission error:', err);
      if (this.errorEl) this.errorEl.hidden = false;
      if (submitLabel) submitLabel.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
}

customElements.define('quote-popup', QuotePopup);
