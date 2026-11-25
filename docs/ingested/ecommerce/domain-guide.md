# E-commerce requirements guide

Source kind: project-authored design guidance, version 1, 2026-11-18. This is not a regulation or an external standard.

Catalogue: describe products, variants, prices, visibility, search, filters and stock availability. Distinguish merchant, administrator, warehouse operator, support agent and shopper permissions.

Cart and checkout: recompute prices, discounts, tax and delivery charges on the server. Specify coupon validity, currency, rounding and cart expiry as business decisions. Reserve inventory atomically and release it on timeout or cancellation. Concurrent attempts to buy the last unit must not oversell it.

Payments: use a hosted payment provider unless another approach is explicitly required. Authenticate callbacks, verify amount, currency and order identity, tolerate retries and out-of-order events, and enforce idempotent transitions. A browser return page alone must not mark an order paid. Hosted checkout does not establish PCI scope or compliance by itself.

Orders: define allowed states, fulfilment, cancellations, shipment tracking and notifications. Authorise each order lookup against its owner or permitted operations role.

Returns and refunds: distinguish request approval from actual provider settlement. Prevent repeated refunds exceeding the paid amount; record decisions and reconciliation discrepancies. Return windows, fees and legal obligations need stakeholder and jurisdiction review.

Non-functional requirements: ask for measurable load, latency, recovery, availability, accessibility and retention targets. Unknown numbers are assumptions, not stakeholder facts. Include observability, backups, least privilege, abuse prevention and incident response where relevant.
