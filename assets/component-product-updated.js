class ProductMediaCarousel extends HTMLElement {
  connectedCallback() {
    this.viewport = this.querySelector('[data-carousel-viewport]');
    this.slides = [...this.querySelectorAll('[data-carousel-slide]')];
    if (!this.viewport || this.slides.length === 0) return;
    this.prevBtn = this.querySelector('[data-carousel-prev]');
    this.nextBtn = this.querySelector('[data-carousel-next]');
    this.thumb = this.querySelector('[data-carousel-thumb]');
    this.index = 0;
    this.loop = this.slides.length > 1;

    if (this.thumb) this.thumb.style.width = `${100 / this.slides.length}%`;
    if (this.loop) this.buildLoop();
    this.cells = [...this.viewport.children];
    this.cellIndex = this.cells.map((cell) => {
      if (cell === this.cloneOfLast) return this.slides.length - 1;
      if (cell === this.cloneOfFirst) return 0;
      return this.slides.indexOf(cell);
    });
    if (this.loop) this.jumpTo(this.slides[0], 'auto');

    if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.goTo(this.index - 1));
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.goTo(this.index + 1));
    // Sync only once scrolling stops. Per-frame syncing makes the counter
    // flicker: an arrow click sets the target index immediately, but for the
    // first half of the smooth scroll the nearest slide is still the old one,
    // so the number bounces target -> previous -> target on every move.
    this._onScroll = () => {
      clearTimeout(this._settleTimer);
      this._settleTimer = setTimeout(() => this.onScrollSettled(), 120);
    };
    this.viewport.addEventListener('scroll', this._onScroll, { passive: true });
    this.viewport.addEventListener('pointerdown', () => {
      this._pointerScrollLeft = this.viewport.scrollLeft;
    });
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.jumpTo(this.slides[this.index], 'auto'), 150);
    };
    window.addEventListener('resize', this._onResize);

    this.setActive(0);
  }

  disconnectedCallback() {
    if (this.viewport && this._onScroll) {
      this.viewport.removeEventListener('scroll', this._onScroll);
    }
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    clearTimeout(this._settleTimer);
    clearTimeout(this._resizeTimer);
  }

  buildLoop() {
    this.cloneOfFirst = this.cloneSlide(this.slides[0]);
    this.cloneOfLast = this.cloneSlide(this.slides[this.slides.length - 1]);
    this.viewport.append(this.cloneOfFirst);
    this.viewport.prepend(this.cloneOfLast);
  }

  cloneSlide(slide) {
    const clone = slide.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('data-carousel-slide');
    clone.dataset.carouselClone = '';
    clone.querySelectorAll('[data-pswp-item]').forEach((img) => {
      delete img.dataset.pswpItem;
    });
    return clone;
  }

  wasSwipe() {
    if (this._pointerScrollLeft == null || !this.viewport) return false;
    return Math.abs(this.viewport.scrollLeft - this._pointerScrollLeft) > 8;
  }

  // offsetLeft is rounded to whole pixels, but slides are 100% of a viewport
  // whose width is routinely fractional. On every other slide that rounding put
  // the scroll half a pixel past the slide start, which showed as a sliver of
  // the next image at the edge. Measuring against the scrollport keeps the
  // sub-pixel value so the active slide fills the frame exactly.
  contentOrigin() {
    return this.viewport.getBoundingClientRect().left - this.viewport.scrollLeft;
  }

  scrollTargetFor(cell, origin) {
    const base = origin == null ? this.contentOrigin() : origin;
    return cell.getBoundingClientRect().left - base;
  }

  jumpTo(cell, behavior) {
    if (!cell) return;
    const left = this.scrollTargetFor(cell);
    if (behavior === 'smooth') {
      this.viewport.scrollTo({ left, behavior: 'smooth' });
    } else {
      this.viewport.scrollLeft = left;
    }
  }

  goTo(index, behavior = 'smooth') {
    const total = this.slides.length;
    if (total === 0) return;

    if (!this.loop) {
      const target = Math.max(0, Math.min(index, total - 1));
      this.jumpTo(this.slides[target], behavior);
      this.setActive(target);
      return;
    }

    if (index < 0) {
      this.jumpTo(this.cloneOfLast, behavior);
      this.setActive(total - 1);
    } else if (index >= total) {
      this.jumpTo(this.cloneOfFirst, behavior);
      this.setActive(0);
    } else {
      this.jumpTo(this.slides[index], behavior);
      this.setActive(index);
    }
  }

  goToMedia(mediaId, behavior) {
    if (!this.slides) return;
    const target = this.slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId));
    if (target === -1) return;
    this.goTo(target, behavior);
  }

  nearestCell() {
    const { scrollLeft } = this.viewport;
    const origin = this.contentOrigin();
    let nearest = 0;
    let shortest = Infinity;
    this.cells.forEach((cell, i) => {
      const distance = Math.abs(this.scrollTargetFor(cell, origin) - scrollLeft);
      if (distance < shortest) {
        shortest = distance;
        nearest = i;
      }
    });
    return nearest;
  }

  onScrollSettled() {
    // Normalize first: scrollLeft is applied synchronously, so the nearest cell
    // read straight after is the real slide rather than the clone.
    this.normalizeLoop();
    const real = this.cellIndex[this.nearestCell()];
    if (real >= 0) this.setActive(real);
  }

  normalizeLoop() {
    if (!this.loop) return;
    const cell = this.cells[this.nearestCell()];
    if (cell === this.cloneOfLast) {
      this.jumpTo(this.slides[this.slides.length - 1], 'auto');
    } else if (cell === this.cloneOfFirst) {
      this.jumpTo(this.slides[0], 'auto');
    }
  }

  setActive(index) {
    this.index = index;
    if (this.thumb) this.thumb.style.transform = `translateX(${index * 100}%)`;
    if (!this.loop) {
      if (this.prevBtn) this.prevBtn.disabled = index === 0;
      if (this.nextBtn) this.nextBtn.disabled = index === this.slides.length - 1;
    }
  }
}
customElements.define('product-media-carousel', ProductMediaCarousel);

class ProductUpdated extends HTMLElement {
  connectedCallback() {
    const productJsonEl = this.querySelector('[data-product-json]');
    if (!productJsonEl) {
      console.warn('product-updated: missing [data-product-json] script.');
      return;
    }

    this.product = JSON.parse(productJsonEl.textContent);
    this.sqftPerBox = parseFloat(this.dataset.sqftPerBox) || 10.24;
    this.unitType = this.dataset.unitType || '';
    this.shipsFreeVariants = new Set(
      (this.dataset.shipsFreeVariants || '')
        .split(',')
        .filter(Boolean)
        .map((id) => parseInt(id, 10))
    );

    const initialVariantId = parseInt(this.dataset.currentVariantId, 10);
    this.currentVariant =
      this.product.variants.find((v) => v.id === initialVariantId) || this.product.variants[0];

    this.bindEvents();
    this.updateAll();
    this.initImageZoom();
    this.initMasonry();
  }

  disconnectedCallback() {
    if (this._masonryResizeObserver) this._masonryResizeObserver.disconnect();
  }

  initMasonry() {
    this.masonryGrid = this.querySelector('.product-media-grid--masonry');
    if (!this.masonryGrid) return;
    const relayout = () => this.layoutMasonry();

    this.masonryGrid.querySelectorAll('img').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', relayout, { once: true });
      img.addEventListener('error', relayout, { once: true });
    });

    if (typeof ResizeObserver === 'function') {
      this._masonryWidth = null;
      this._masonryResizeObserver = new ResizeObserver((entries) => {
        const width = entries[0].contentRect.width;
        if (width === this._masonryWidth) return;
        this._masonryWidth = width;
        relayout();
      });
      this._masonryResizeObserver.observe(this.masonryGrid);
    } else {
      window.addEventListener('resize', relayout);
    }

    relayout();
  }

  layoutMasonry() {
    const grid = this.masonryGrid;
    if (!grid) return;
    const styles = window.getComputedStyle(grid);
    if (styles.display !== 'grid') return;

    const rowHeight = parseFloat(styles.gridAutoRows) || 8;
    const rowGap = parseFloat(styles.rowGap) || 0;
    const gutter = parseFloat(styles.columnGap) || 0;
    const items = [...grid.querySelectorAll('.product-media-item')];
    const spans = items.map((item) => {
      if (!item.offsetParent) return null;
      const height = item.getBoundingClientRect().height + gutter;
      return Math.max(1, Math.round(height / (rowHeight + rowGap)));
    });

    items.forEach((item, i) => {
      item.style.gridRowEnd = spans[i] === null ? '' : `span ${spans[i]}`;
    });
  }

  initImageZoom() {
    this.querySelectorAll('.media-zoom-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.openPhotoswipe(parseInt(btn.dataset.index, 10) - 1));
    });
    this.querySelectorAll('.photoswipe__image').forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        const carousel = img.closest('product-media-carousel');
        if (carousel && typeof carousel.wasSwipe === 'function' && carousel.wasSwipe()) return;
        this.openPhotoswipe(parseInt(img.dataset.mediaIndex, 10) - 1);
      });
    });
  }

  visibleThumbFor(mediaIndex) {
    const candidates = [...this.querySelectorAll(`[data-media-index="${mediaIndex}"]`)];
    const onScreen = candidates.find((el) => {
      if (!el.offsetParent) return false;
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
      );
    });
    return onScreen || candidates[0];
  }

  openPhotoswipe(index) {
    const images = [...this.querySelectorAll('[data-pswp-item]')];
    const items = images.map((img) => ({
      src: img.dataset.photoswipeSrc || img.src,
      w: parseInt(img.dataset.photoswipeWidth, 10) || img.naturalWidth,
      h: parseInt(img.dataset.photoswipeHeight, 10) || img.naturalHeight,
      msrc: img.currentSrc || img.src,
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
      getThumbBoundsFn: (i) => {
        const thumb = this.visibleThumbFor(i + 1);
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

      const showMoreMedia = e.target.closest('[data-show-more-media]');
      if (showMoreMedia) {
        this.toggleExpanded(showMoreMedia, '.product-media-grid');
        return;
      }

      const showMoreSwatches = e.target.closest('[data-show-more-swatches]');
      if (showMoreSwatches) {
        this.toggleExpanded(showMoreSwatches, '.buybox-color-swatches');
        return;
      }
      const sampleBtn = e.target.closest('[data-sample-btn]');
      if (sampleBtn) {
        e.preventDefault();
        this.handleSampleClick(sampleBtn);
      }
    });

    this.addEventListener('quantity:change', () => this.updatePrices());

    this.addEventListener('calculator:change', (e) => {
      const qty = this.querySelector('quantity-input-updated');
      if (qty) qty.setValue(e.detail.boxes);
    });

    const needLink = this.querySelector('.buybox-need-link:not(#grout-form-modal-btn)');
    if (needLink) needLink.addEventListener('click', (e) => this.openCalculator(e));

    const closeBtn = this.querySelector('.buybox-calc-toggle');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCalculator());

    const form = this.querySelector('[data-product-form]');
    if (form) form.addEventListener('submit', (e) => this.addToCart(e));

    const wishBtn = this.querySelector('[data-wishlist-btn]');
    if (wishBtn) {
      wishBtn.addEventListener('click', () => this.handleWishlistClick());
    }
  }

  toggleExpanded(button, containerSelector) {
    const container = this.querySelector(containerSelector);
    if (!container) return;
    const expanded = container.classList.toggle('is-expanded');
    const moreText = button.querySelector('[data-more-text]');
    const lessText = button.querySelector('[data-less-text]');
    if (moreText) moreText.hidden = expanded;
    if (lessText) lessText.hidden = !expanded;

    if (containerSelector === '.product-media-grid') {
      this.layoutMasonry();
      if (!expanded) {
        const wrapper = this.querySelector('.updated-product-media-wrapper');
        if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
    this.updateShipping();
  }

  updateShipping() {
    const showFree = this.shipsFreeVariants.has(this.currentVariant.id);
    this.querySelectorAll('[data-shipping-slot]').forEach((slot) => {
      const freeEl = slot.querySelector('.buybox-shipping-free');
      if (freeEl) freeEl.style.display = showFree ? '' : 'none';
    });
  }

  updatePrices() {
    const qty = this.getQuantity();
    const variantPrice = this.currentVariant.price;
    const pricePerSqft = variantPrice / this.sqftPerBox;
    const totalPrice = variantPrice * qty;

    this.setText('[data-price-sqft]', `${this.formatMoney(pricePerSqft)} per sq. ft.`);
    let unitLabel = '';
    if (this.unitType === 'each') unitLabel = 'each';
    else if (this.unitType) unitLabel = `per ${this.unitType}`;
    const priceBoxText = unitLabel
      ? `${this.formatMoney(variantPrice)} ${unitLabel}`
      : this.formatMoney(variantPrice);
    this.setText('[data-price-box]', priceBoxText);
    this.setText('[data-total-price]', this.formatMoney(totalPrice));
  }

  updateSku() {
    const sku = this.currentVariant.sku;
    if (!sku) return;
    this.setText('[data-sku]', `SKU: ${sku}`);
  }

  updateMedia() {
    const carousel = this.querySelector('product-media-carousel');
    if (!carousel || typeof carousel.goToMedia !== 'function') return;
    const behavior = this._mediaSynced ? 'smooth' : 'auto';
    this._mediaSynced = true;

    const media = this.currentVariant.featured_media;
    if (media && media.id) {
      carousel.goToMedia(media.id, behavior);
      return;
    }
    const image = this.currentVariant.featured_image;
    if (image && image.position) carousel.goTo(image.position - 1, behavior);
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
    const allSampleBtns = this.querySelectorAll('[data-sample-btn]');
    const allSampleLabels = this.querySelectorAll('[data-sample-label]');

    await this.submitToCart({
      id: variantId,
      quantity: 1,
      buttons: allSampleBtns,
      labels: allSampleLabels,
      successText: 'Sample Added!',
      errorText: 'Sample Limit Reached',
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

  async submitToCart({ id, quantity, buttons, labels, successText, errorText = 'Error - Try Again' }) {
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
      document.dispatchEvent(new CustomEvent('ajaxProduct:added', { detail: { item } }));

      labels.forEach((l) => (l.textContent = successText));
      setTimeout(() => this.resetButtons(buttons, labels, originalLabels), 1500);
    } catch (error) {
      console.error('Add to cart error:', error);
      labels.forEach((l) => (l.textContent = errorText));
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
    if (this.valueEl) {
      this.valueEl.addEventListener('input', () => this.dispatchChange(this.getValue()));
      this.valueEl.addEventListener('change', () => this.setValue(this.valueEl.value));
    }
  }

  getValue() {
    const raw = this.valueEl.value !== undefined ? this.valueEl.value : this.valueEl.textContent;
    return parseInt(raw, 10) || this.minValue;
  }

  setValue(val) {
    val = Math.max(this.minValue, parseInt(val, 10) || this.minValue);
    if (this.valueEl.value !== undefined) {
      this.valueEl.value = val;
    } else {
      this.valueEl.textContent = val;
    }
    if (this.hiddenInput) this.hiddenInput.value = val;
    this.dispatchChange(val);
  }

  dispatchChange(val) {
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
    this.unitType = this.dataset.unitType || '';
    this.unitNoun = this.unitType && this.unitType !== 'each' ? this.unitType : 'unit';

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
    this.boxesRequiredEl.textContent = `${boxesRequired.toLocaleString('en-US')} @ ${this.sqftPerBox} sq.ft./${this.unitNoun}`;
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
   <tilesview-popup> — TilesView visualizer modal
   ============================================================*/
class TilesviewPopup extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.iframe = this.querySelector('.tilesview-popup__iframe');
    if (!this.dialog) return;

    this._onTriggerClick = (e) => {
      const trigger = e.target.closest('[data-tilesview-trigger]');
      if (!trigger) return;
      e.preventDefault();
      this.open();
    };
    document.addEventListener('click', this._onTriggerClick);

    const closeBtn = this.querySelector('[data-tilesview-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) this.close();
    });
  }

  disconnectedCallback() {
    if (this._onTriggerClick) document.removeEventListener('click', this._onTriggerClick);
  }

  open() {
    if (this.iframe && !this.iframe.src && this.iframe.dataset.src) {
      this.iframe.src = this.iframe.dataset.src;
    }
    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
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
}
customElements.define('tilesview-popup', TilesviewPopup);

/* ============================================================
   <quote-popup> — Request a Quote modal
   ============================================================*/
class QuotePopup extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.form = this.querySelector('[data-quote-form]');
    this.successEl = this.querySelector('[data-quote-success]');
    this.errorEl = this.querySelector('[data-quote-error]');
    if (!this.dialog) return;
    this._onTriggerClick = (e) => {
      const trigger = e.target.closest('[data-quote-trigger]');
      if (!trigger) return;
      e.preventDefault();
      this.open();
    };
    document.addEventListener('click', this._onTriggerClick);
    const closeBtn = this.querySelector('[data-quote-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (e) => {
      const rect = this.dialog.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) this.close();
    });
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
      const response = await fetch('/contact', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'text/html' },
      });

      if (!response.ok) throw new Error('Submission failed');
      if (!response.url.includes('contact_posted=true')) {
        throw new Error('Contact form rejected the submission');
      }

      this.form.reset();
      if (this.successEl) this.successEl.hidden = false;
      if (submitLabel) submitLabel.textContent = originalText;
      submitBtn.disabled = false;

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
