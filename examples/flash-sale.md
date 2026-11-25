# Flash-sale checkout module

Design the checkout and inventory module for an existing physical-goods store. Existing catalogue and authentication modules are integrations, not new work. Stock is shared across website and warehouse sales. During a sale, simultaneous shoppers may attempt to purchase the last unit. Reserve stock atomically, define reservation expiry, release reservations after failed or cancelled payments, and reconcile uncertain provider outcomes.

Use hosted checkout. Verify payment signatures, order identity, amount and currency. Handle duplicate and out-of-order callbacks without duplicate orders. A browser redirect alone must not establish payment success. Administrators need to inspect failed reservations and reconciliation discrepancies without accessing raw card data.

Promotions change frequently; the product owner can review increments. Releases should run automated race, replay and payment-contract tests. Existing warehouse API behaviour is poorly documented and must be explored with a prototype. Traffic, expiry, retry and recovery targets are unresolved. Identify assumptions and clarification questions. Do not add lending or marketplace settlements.
