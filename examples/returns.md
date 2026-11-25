# Returns and refunds module

Analyse only the returns/refunds extension of an existing store. The catalogue, checkout and delivery systems already exist. A shopper requests a return for their own delivered order. Support verifies eligibility against a merchant-approved policy, records a reason and approves or rejects the request. Warehouse staff confirm returned items. Finance operations initiates provider refunds and reconciles their final status.

Role checks must separate shopper request, support approval, warehouse confirmation and refund execution. Duplicate requests and repeated provider callbacks must not issue duplicate refunds. Partial refunds must never exceed the captured amount cumulatively. Preserve a traceable order, return, approval and refund history without exposing payment credentials.

The scope is stable and the merchant requires formal acceptance evidence at each baseline. A legacy order system has limited change windows. Stakeholders can attend scheduled acceptance reviews but are not continuously available. The return window, exceptions, refund timing commitments and retention periods need authorised confirmation. Compare suitable SDLC options rather than assuming frequent deployment is required.
