// adding the convert script to head
if (typeof _conv_host == 'undefined') {
  window['_conv_prevent_bodyhide'] = true
  window['_conv_page_type'] = 'order_confirmation'

  const isInjected = Array.prototype.slice
    .apply(document.getElementsByTagName('script'))
    .some((el) =>
      el.src.includes(
        'cdn-4.convertexperiments.com/v1/js/10042572-10049736.js'
      )
    )
  if (!isInjected) {
    let _conv_track = document.createElement('script')
    _conv_track.src =
      '//cdn-4.convertexperiments.com/v1/js/10042572-10049736.js'
    document.getElementsByTagName('head')[0].appendChild(_conv_track)
  }
}

const currency_to_report = 'USD'

// doing logic to submit track conversions
if (Shopify?.Checkout?.step === 'thank_you') {
  console.log('%cConvert: We are on the thank you page', 'color: lightgreen')

  const revenue_goal_id = localStorage.getItem('convert_revenue_goal')

  fetch('https://cdn.shopify.com/s/javascripts/currencies.js')
    .then((res) => res.text())
    .then((jsCode) => {
      try {
        const jsContext = {} // provide custom context for JS code (i.e. "this" inside JS refers to jsContext instead of window)
        const Currency = Function(
          `"use strict"; ${jsCode} return Currency;`
        ).call(jsContext)

        console.log('%cConvert: Multicurrency method', 'color: lightgreen')
        if (revenue_goal_id) {
          console.log('%cConvert: We have revenue goal', 'color: lightgreen')
          
          window['_conv_q'] = window['_conv_q'] || [];
          window['_conv_q'].push({
            what: 'pushRevenue',
            params: {
              goalId: revenue_goal_id,
              transactionId: Shopify?.checkout?.token,
              amount: parseFloat(
                Currency.convert(
                  Shopify?.checkout?.subtotal_price,
                  Shopify?.Checkout?.currency,
                  currency_to_report
                )
              ),
              productsCount: Shopify?.checkout?.line_items?.reduce(
                (acc, item) => {
                  return acc + item.quantity
                },
                0
              )
            }
          })
        }
      } catch (error) {
        console.error(
          '%cConvert: Error in multicurrency conversion',
          'color: deeppink',
          error
        )
      }
    })
}
