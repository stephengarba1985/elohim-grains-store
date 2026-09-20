# Mobile retail performance acceptance criteria

The highest-priority journey is Homepage → Shop → Product → Cart → Checkout → Payment → Orders. Changes to these pages must be checked on a mid-range Android profile and a throttled mobile connection before release.

## Acceptance checks

- First content is visible promptly; no full-screen blocking spinner on the retail journey.
- Product and category images reserve their display space, load lazily below the fold, and use responsive AVIF/WebP delivery where Next.js can optimise them.
- The homepage hero and product detail image are the only high-priority retail images.
- Cart, checkout, payment and orders stay network-controlled; do not cache authenticated financial or payment data for an apparent offline success.
- Layout shift is avoided when images and loading states resolve.

## Test procedure

In Chrome DevTools, use a mobile viewport (360px wide), a mid-tier Android CPU profile, and Fast 3G or a similarly constrained network. Test each route above as both a cold load and a repeat load. Confirm that taps on product, add-to-cart, quantity, checkout and payment controls remain responsive and that no image causes the page to jump.

Record Lighthouse Mobile results for the retail pages when deploying a substantial UI or asset change. Treat a regression in LCP, INP or CLS as a release issue before optimising less frequently used administrative screens.
