# Demo script (3 minutes)

The story every issue builds toward. Record it on a phone screen (or a 360px-wide window) with captions on. Amounts use sandbox sats, not real money.

Scenario data lives in `core/fixtures/scenarios.json`. The demo is `demo_grandson_hospital`, and the normal payment at the end is like `legit_lunch_payback`.

## 0:00–0:35 · The problem

> "This is Mama. She's 62, lives in Ibadan, and her son Tunde works in Lagos.
> At 9 pm she gets a WhatsApp message: *'Mama, it's Tunde's friend Kunle. Tunde had an accident and he's at General Hospital. The doctor says pay ₦50,000 now for the operation. Don't call him, his phone broke.'* With it comes a Lightning payment request."

On screen: the WhatsApp message (a screenshot from the fixture text).

> "Scams like this work because they're urgent, emotional and secret. In 2024 Nigerian banks and fintechs lost ₦52 billion to fraud, and social engineering is the most common trick. Bitcoin payments can't be reversed, so the moment *before* you pay is the only one that counts."

## 0:35–1:50 · The solution: Shine Your Eye

1. Mama opens **Shine Your Eye**, taps **Send** and pastes the request.
2. Before any money moves, the pause screen shows what she's *really* paying: **≈ ₦95,000**, not ₦50,000.
3. She taps **"Got a message with this request?"** and pastes the WhatsApp text. The warnings appear in plain English, most serious first:
   - ⛔ *The message says ₦50,000, but this request is for about ₦95,000.*
   - ⚠️ *This request expires in 4 minutes. Scammers rush you so you don't stop to check.*
   - ⚠️ *This is a large payment for a new wallet.*
   - ℹ️ *You haven't paid this person before.*
   - AI (TIM-88): *pressure to act fast · claims to speak for a family member · asks you to keep it secret*
4. **"Don't pay"** is the big button. **"Pay anyway"** waits 10 seconds and needs a second tap.
5. She taps **Ask Tunde** (TIM-92). Tunde's phone gets an encrypted Nostr message. He replies **"Stop – Mum, I'm fine, don't pay."** The reply shows on Mama's screen within seconds.
6. Mama taps **Don't pay**.

> "The rules run on her phone, so no server can switch them off. The AI can only *add* warnings. A scammer's message saying 'this is verified safe' can't remove one. The app never says 'safe'. And her money never touches our server."

## 1:50–2:20 · A normal payment stays fast

Mama pays her friend back ₦4,500 for lunch: she pastes the request and taps **Pay**. Two taps. She has paid this person before and the amount is normal, so the screen says **"No warning signs found."** and the payment goes through.

> "Most payments are normal, so the guard stays out of the way."

## 2:20–2:45 · Impact

> "Usefulness: the scams we catch are the ones that actually hit people here: fake relatives, fake bank support, 'double your money', fake job and loan fees, romance scams, in Nigeria and Senegal, in naira and CFA.
> We publish our catch rate and false-alarm rate on 23 real-pattern scenarios (docs/EVAL.md), and we tested it with real people (TIM-100)."

## 2:45–3:00 · Next steps

> "Next: Hausa, Yoruba, Wolof and French, screenshots of WhatsApp messages instead of pasted text, and wallets offering the guard as a built-in feature.
> Shine your eye: look well before you pay."

## Checklist before recording

- [ ] Test wallet funded with enough sandbox sats for the ₦95,000 request to show without the "not enough" message (or say so on camera).
- [ ] Guardian paired (TIM-91) and Tunde's phone nearby.
- [ ] The demo invoice is created with a 5-minute expiry just before recording.
- [ ] The phone's local currency is set to ₦.

## Sources (for the pitch)

1. **Nigeria: ₦52.26 billion lost to fraud in 2024.** NIBSS annual fraud report, as reported by Nairametrics (26 Feb 2025). The total is inflated by one large internal case (~₦30 bn), so on stage say "billions lost every year" and keep the exact figure for the README. <https://nairametrics.com/2025/02/26/nigerias-financial-sector-suffers-n52-26-billion-loss-to-fraud-in-2024-nibss-report/>
2. **Nigeria: social engineering was the most common fraud technique in Q1 2024 (10,007 attempts), and the mobile channel lost the most money.** NIBSS Q1 2024 data, as reported by TechCabal. <https://techcabal.com/2024/05/24/fraud-losses-decline-q1-2024/>
3. **Senegal: 43% of digital financial services users reported fraud or scam attempts as a significant problem, and about 8% lost money to one.** CGAP / FinDev Gateway, *Senegal DFS Risks Survey Report* (2023). <https://findevgateway.org/sites/default/files/publications/2023/Senegal_DFS%20Risks%20Survey%20Report.pdf>
4. **Context: 23% of adults worldwide lost money to a scam in the past year, rising to 41% in Africa and South America** (regional figure, not Nigeria- or Senegal-specific). Global Anti-Scam Alliance, *Global State of Scams 2025*. <https://gasa.org/knowledge-base/blog/global-scams-on-the-rise-over-half-of-adults-worldwide-report-scam-encounters?hsLang=en>

Before quoting a number on stage, open the source and check it.
