# Web security evidence notes

Source kind: project-authored paraphrases of official sources, checked 2026-11-18. These notes are guidance, not proof that a system meets a standard. Validate applicability and the full source before adopting controls.

## OWASP ASVS
Source: https://owasp.org/www-project-application-security-verification-standard/

ASVS provides a framework of application security verification requirements. It can inform a project's security acceptance criteria and verification plan. Select the applicable requirements and assurance level with a security reviewer; merely citing ASVS does not demonstrate verification.

## OWASP transaction authorisation
Source: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html

Transaction authorisation should enforce server-side checks and preserve the integrity of significant transaction data. Bind authorisation to the intended operation and prevent changes from bypassing the authorisation flow. E-commerce order totals and payment state transitions therefore need explicit integrity tests; this is a project design inference from the guidance.

## PCI SSC e-commerce guidance
Source: https://listings.pcisecuritystandards.org/pdfs/best_practices_securing_ecommerce.pdf
Publication: April 2017; historical supplemental guidance, not the current normative standard.

The guide describes redirect and hosted payment integrations. Passing card entry to a payment provider changes the payment flow but does not independently establish the merchant's compliance obligations. Determine current applicable PCI requirements and assessment scope with the provider and an authorised assessor before a production baseline.
