/* ============================================================
   Product reviews — company-reviews fallback

   Yotpo hydrates its widgets client-side, so "does this product have any
   reviews?" can't always be answered in Liquid: the count metafield only
   exists once Yotpo has synced the product. When the section renders without
   it (data-reviews-count-known="false"), the count is read from Yotpo's public
   widget API and the product widget is swapped for the company one if the
   product has none.

   Anything short of a confirmed zero leaves the product widget alone — Yotpo's
   own empty state is a safer default than hiding real reviews.
   ============================================================*/
(function () {
  var HIDDEN_CLASS = 'product-reviews__pane--hidden';
  var API_HOST = 'https://api-cdn.yotpo.com';

  function showCompanyReviews(root) {
    var productPane = root.querySelector('[data-reviews-product]');
    var companyPane = root.querySelector('[data-reviews-company]');
    if (!companyPane) return;

    companyPane.classList.remove(HIDDEN_CLASS);

    /* 'below' keeps Yotpo's empty state — and its "Write a review" button. */
    if (productPane && root.dataset.fallbackMode !== 'below') {
      productPane.classList.add(HIDDEN_CLASS);
    }
  }

  function resolveReviewCount(root) {
    var appKey = root.dataset.yotpoAppKey;
    var productId = root.dataset.productId;
    if (!appKey || !productId) return;

    var url =
      API_HOST +
      '/v1/widget/' +
      encodeURIComponent(appKey) +
      '/products/' +
      encodeURIComponent(productId) +
      '/reviews.json';

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Yotpo request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var bottomline = data && data.response && data.response.bottomline;
        if (!bottomline) return;

        var total = Number(bottomline.total_review);
        if (total === 0) showCompanyReviews(root);
      })
      .catch(function () {
        /* Leave the product widget in place. */
      });
  }

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-product-reviews]');

    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.reviewsResolved === 'true') return;
      root.dataset.reviewsResolved = 'true';

      /* Liquid already knows the answer — the panes are rendered correctly. */
      if (root.dataset.reviewsCountKnown === 'true') return;

      /* Nothing to fall back to. */
      if (!root.querySelector('[data-reviews-company]')) return;

      resolveReviewCount(root);
    });
  }

  init();

  /* Theme editor re-renders the section without re-running this file. */
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();
