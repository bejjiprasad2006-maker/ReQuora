# ShopSphere stakeholder brief

ShopSphere is a single-merchant e-commerce platform for physical products.
Shoppers can browse and search products and variants.
Shoppers can maintain a cart and see recalculated totals.
The server validates discounts and shipping charges.
Checkout reserves stock without overselling the last unit.
Customers pay using a hosted payment provider.
Signed payment callbacks update orders exactly once.
Customers can see only their own orders and tracking.
Warehouse staff can pack and ship paid orders.
Support staff can approve returns and initiate refunds.
Refund retries must not refund more than the paid amount.
Administrators can manage products and stock with role checks.
Order and refund state changes are recorded in an audit trail.
Customer data access is restricted by role and purpose.
Search needs an agreed measurable response target.
Operations needs tested recovery and monitoring.
The product owner is available throughout delivery. Promotions change frequently and releases should be frequent with automated security testing. The provider API is known, but retry and concurrency behaviour needs validation. Scope excludes lending, multi-vendor settlements and storing raw card numbers. Jurisdiction, retention, recovery targets and return windows need confirmation.
