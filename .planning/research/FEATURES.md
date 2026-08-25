# Features Research: STOZER

## Summary

The sports club management software market is $6.8B+ and growing 13.5% annually, dominated by US platforms (TeamSnap, SportsEngine, LeagueApps) that charge $500–$9,000/year and are designed for the American market. Existing solutions universally fail at: payment reconciliation (especially bank transfer matching), multi-sport club management, and localization for European/Balkan markets. STOŽER's strongest positioning is as a simple, affordable, localized alternative that solves the "fragmented data" pain point — the #1 complaint across all platforms.

---

## Table Stakes (must have or users leave)

### Club & Organization Management
- **Multi-club/multi-tenant structure**: One organization managing multiple teams across age groups and sports | complexity: moderate | depends: organization model
- **Club profile**: Name, logo, colors, contact info, address | complexity: simple | depends: none
- **Team management**: Create teams by age category, assign coaches, define season | complexity: moderate | depends: club model
- **Staff roles and permissions**: President, coach, admin, finance — different views per role | complexity: moderate | depends: team model
- **Basic user management**: Admin invites coaches, parents register players | complexity: moderate | depends: auth system

### Player & Roster Management
- **Player profiles**: Name, DOB, photo, contact, medical info, guardian info | complexity: simple | depends: none
- **Roster assignment**: Assign players to one or more teams per season | complexity: moderate | depends: team model
- **Age category management**: U-8, U-10, U-12, U-14, U-16, U-19, senior, etc. | complexity: simple | depends: team model
- **Player registration to club**: Seasonal registration with status tracking | complexity: moderate | depends: roster model

### Scheduling & Calendar
- **Practice scheduling**: Recurring training sessions with time/location | complexity: moderate | depends: team + venue model
- **Game/match scheduling**: Opponent, date, time, venue, competition | complexity: moderate | depends: team + venue model
- **Calendar view**: Weekly/monthly view per team or per club | complexity: moderate | depends: scheduling model
- **Schedule sharing**: Export to Google/Apple calendar, shareable links | complexity: moderate | depends: calendar model
- **Conflict detection**: Prevent double-booking venues or coaches | complexity: moderate | depends: venue + schedule model

### Communication
- **Team messaging**: Coach ↔ parents chat per team | complexity: moderate | depends: team model
- **Announcements**: Club-wide or team-wide push notifications | complexity: moderate | depends: team model
- **SMS/email notifications**: Critical updates (schedule changes, cancellations) | complexity: moderate | depends: communication service

### Payments & Fees
- **Membership fee definition**: Define fee amounts per team/season/age category | complexity: moderate | depends: team model
- **Invoice generation**: Create invoices for players/families | complexity: moderate | depends: payment + player model
- **Payment status tracking**: Paid/partial/overdue per player | complexity: moderate | depends: invoice model
- **Basic bank statement import**: CSV upload of bank transactions for matching | complexity: moderate | depends: invoice model
- **Payment overview dashboard**: Who paid, who owes, total collected | complexity: simple | depends: payment model

### Attendance
- **Training attendance**: Coach marks present/absent/excused per session | complexity: moderate | depends: schedule + roster model
- **Attendance history per player**: View attendance patterns over time | complexity: simple | depends: attendance model
- **Quick attendance**: Mobile-friendly one-tap attendance taking | complexity: moderate | depends: attendance model

### Venues & Facilities
- **Venue management**: Name, address, type (indoor/outdoor), capacity | complexity: simple | depends: none
- **Field/court definitions**: Multiple fields per venue with details | complexity: moderate | depends: venue model
- **Venue scheduling**: Which team trains where and when | complexity: moderate | depends: venue + schedule model

### Documents & Files
- **Document upload**: Player medical certificates, licenses, contracts | complexity: moderate | depends: player model
- **Document expiry tracking**: Alert when medical/license expires | complexity: moderate | depends: document model
- **Basic document storage**: Secure file storage per player | complexity: moderate | depends: storage service

### Dashboard & Reporting
- **Overview dashboard**: Today's activities, pending items, alerts | complexity: moderate | depends: all models
- **Basic financial summary**: Total collected, total owed, by period | complexity: simple | depends: payment model
- **Attendance summary**: Per team, per player | complexity: simple | depends: attendance model

---

## Differentiators (competitive advantage)

### Payment Reconciliation (KILLER FEATURE)
- **Bank transfer matching**: Upload bank statement CSV, auto-match transactions to invoices by amount/reference | complexity: complex | depends: invoice + payment model
- **Partial payment allocation**: Handle when one bank transfer covers multiple invoices (siblings, mixed purposes) | complexity: complex | depends: reconciliation engine
- **Unmatched transaction detection**: Flag bank transactions with no matching invoice | complexity: moderate | depends: reconciliation engine
- **Family account aggregation**: One parent paying for multiple children — system groups and allocates correctly | complexity: complex | depends: family + reconciliation model
- **Reconciliation audit trail**: Full log of who matched what and when | complexity: moderate | depends: reconciliation model
- **Why this wins**: Every competitor's users complain about reconciliation. TeamSnap doesn't handle prorated billing. SportsEngine's financial module is universally panned ("a joke"). No tool handles bank transfer matching well — most assume online payment processing. In Serbia, most youth clubs still collect via bank transfer, making this the #1 pain point.

### Multi-Sport Club Support
- **Sport-specific team types**: Football teams vs basketball teams in same club | complexity: moderate | depends: multi-sport model
- **Sport-specific age categories**: Different age group structures per sport | complexity: moderate | depends: sport model
- **Shared club resources**: Venues, staff, financial accounts shared across sports | complexity: moderate | depends: multi-sport model
- **Why this wins**: Most clubs in Serbia run both football and basketball. Existing tools treat each sport independently. TeamSnap, SportsEngine don't natively handle multi-sport clubs well — they assume one club = one sport.

### Serbian/Balkan Localization
- **Serbian language (Cyrillic + Latin)**: Full UI in both scripts | complexity: moderate | depends: i18n framework
- **Serbian payment methods**: Support for bank transfer (standard in Serbia), domestic payment rails | complexity: moderate | depends: payment service
- **RSD currency support**: Native handling of Serbian dinar | complexity: simple | depends: currency model
- **COMET/KSS awareness**: Knowledge of federation registration cycles, even if not integrating in V1 | complexity: simple | depends: none
- **Fiscal compliance basics**: Generate invoices/receipts that work for Serbian accounting | complexity: moderate | depends: finance model
- **Why this wins**: Zero competition. No sports club management tool exists in Serbian language. COMET handles federation-level operations (transfers, licenses) but NOT internal club management. There is a massive vacuum between "COMET for federation stuff" and "WhatsApp/Excel for club operations."

### Smart Onboarding & Data Import
- **Excel import**: Import existing player/staff data from spreadsheets | complexity: moderate | depends: import engine
- **Club setup wizard**: Guided setup for new clubs in <10 minutes | complexity: moderate | depends: onboarding model
- **Season templates**: Pre-built season structures (fall/spring or full-year) | complexity: simple | depends: season model
- **Why this wins**: SportsEngine's #1 complaint is steep learning curve. TeamSnap's setup is better but still complex for non-tech-savvy club administrators.

### Real-Time Operations View
- **"What's happening today" dashboard**: Today's training, games, pending items, alerts | complexity: moderate | depends: all models
- **Coach mobile quick actions**: Take attendance, post update, check schedule in <3 taps | complexity: moderate | depends: mobile UX
- **Status indicators**: Color-coded payment, registration, document status | complexity: simple | depends: status model
- **Why this wins**: TeamSnap and SportsEngine bury this information in navigation. The brief's vision of "president opens the app and instantly knows what's going on" is not achieved by any existing tool.

### Banking-First Reconciliation (Balkan Specific)
- **Reference number matching**: Serbian bank transfers include reference numbers — use them for auto-matching | complexity: moderate | depends: reconciliation engine
- **Payment purpose parsing**: Parse payment purpose field from Serbian bank statements | complexity: moderate | depends: reconciliation engine
- **Bulk import from domestic banks**: Support CSV formats from major Serbian banks (Raiffeisen, Intesa, etc.) | complexity: moderate | depends: bank integrations
- **Why this wins**: Western tools assume Stripe/card payments. In Serbia, 90%+ of youth club payments are via bank transfer. This is a completely underserved use case.

---

## Anti-features (deliberately not building)

### Features that add complexity without proportional value
- **Live streaming**: TeamSnap ONE includes free livestreaming — sounds impressive but almost no youth club needs this. Adds massive complexity for zero value in V1.
- **Video analysis/recording tools**: The Futures App offers slow-motion annotation and side-by-side comparison. This is a separate product category, not a club management feature.
- **Practice plans and drill libraries**: TeamSnap offers "drills from pro leagues." Valuable as content, but NOT as a management tool. Coaches don't need a software feature for this — they need YouTube or a PDF.
- **Advanced sports analytics/performance tracking**: Heat maps, sprint tracking, shooting percentages. This is sports science, not club administration. Completely out of scope.
- **Player development pathways/talent tracking**: Jackrabbit's standout feature is skill tracking. This is youth academy territory — too complex and premature for V1.
- **Website builder**: TeamSnap, SportsEngine, TeamLinkt all offer website builders. A club website is a marketing function, not a management function. Don't build this.
- **Apparel/merchandise e-commerce**: TeamLinkt includes apparel sales. This is a separate business function.
- **Tournament bracket management**: TeamSnap ONE, SportsEngine both offer this. It's a competition management tool, not a club management tool.
- **Background checks**: TeamSnap offers volunteer background checks. This is an insurance/legal function, not a core management feature.
- **Social media integration**: Sharing to Facebook, Instagram. Don't become a social media tool.

### Features existing tools have but nobody uses
- **"Track anything"**: TeamSnap's feature to track arbitrary data points. Sounds flexible, actually unusable.
- **QR code check-in/out**: Jersey Watch's standout feature. Solves a problem that doesn't exist in European youth sports.
- **Parent portal as separate app**: Most tools have a separate parent-facing app. This fragments the experience. One app, different views.
- **Custom website templates**: SportsEngine's responsive website builder. Clubs use Instagram for public presence, not custom websites.
- **Detailed referee management**: COMET handles this at federation level. Club-level referee management is a non-starter for youth clubs.

### Features that would make STOŽER too complex
- **Full accounting module**: Don't compete with QuickBooks. Handle club-level financials, not company-level accounting.
- **Payroll management**: Staff salaries are handled by the club's accountant, not club management software.
- **Sponsorship CRM**: Don't become a sales tool. Track sponsor payments, not sponsor relationships.
- **Advanced reporting with custom queries**: Power users love this, but 90% of clubs need 5 pre-built reports max.
- **Multi-language in V1**: Build the i18n framework, but only ship Serbian in V1. Don't waste engineering on translations yet.
- **Multi-currency in V1**: Support RSD natively, add others when there's demand.
- **API access for third-party integrations**: V1 is about simplicity, not extensibility. Build the core well first.
- **Offline mode**: PWA capabilities should handle slow networks, but full offline-first is a massive engineering investment for edge cases.

---

## Youth Membership Payment Patterns

### Billing Models (from research)

**Dominant patterns in European youth sports:**

1. **Seasonal flat fee** (most common): One-time payment at season start (Sep or Jan), typically 300–600€/season for competitive clubs. Simple to administer but creates cash flow gaps.

2. **Monthly subscription**: Fixed monthly amount (25–60€/month), continuous billing. Growing in popularity because it's easier for families to budget. Creates predictable cash flow but requires recurring billing infrastructure.

3. **Annual fee + per-activity extras**: Base membership (50–150€) covers admin/insurance, then separate charges for tournaments, camps, equipment. Common in UK/European clubs.

4. **Pay-as-you-play**: Per-session fee (5–15€). Simple but unpredictable income. Rare for committed clubs.

5. **Tiered pricing**: Different fees for recreational vs competitive programs. Competitive players pay more because they use more facility time and enter competitions.

### Payment Methods (Serbian market)

- **Bank transfer (dominant)**: 90%+ of payments in Serbian youth clubs are via bank transfer to club account. This is the #1 reconciliation pain point.
- **Cash**: Still common for small clubs, creates tracking nightmare. Should be supported but discouraged.
- **Card/online payments**: Rare in Serbian youth sports. Growing but not primary. Stripe integration for future, not V1 priority.
- **SEPA Direct Debit**: Common in Western Europe, not standard in Serbia.

### Payment Tracking Pain Points

1. **Family payments spanning multiple children**: Parent pays 15,000 RSD for two children — system must split across two invoices.
2. **Mixed-purpose payments**: One transfer covers membership + tournament fee + kit. Must decompose.
3. **Missing reference numbers**: Serbian bank transfers often lack reference numbers. Must match by amount + payer name.
4. **Timing mismatches**: Invoice created in system day before payment arrives in bank. Date mismatch causes confusion.
5. **Partial payments**: Family pays 5,000 of a 10,000 obligation. Must track remaining balance.
6. **Refund handling**: Cancellation mid-season requires partial refund. Must track both the original payment and the refund.
7. **Season transitions**: Player moves from U-14 to U-16 mid-season. Fee structure may change.
8. **Sibling discounts**: 10-20% discount for additional children. Must apply correctly.

### Bank Reconciliation Workflow

The treasurer's monthly process:
1. Download bank statement (CSV/PDF from online banking)
2. Open club records (currently Excel)
3. Match each bank transaction to an invoice/player
4. Flag unmatched transactions
5. Investigate discrepancies
6. Record verified closing balance
7. Lock reconciled period

**Current pain**: This takes 4-8 hours per month for a club with 100+ players. Most clubs skip it or do it poorly.

**STOŽER opportunity**: If STOŽER can reduce this to 30 minutes with smart auto-matching, it becomes the primary reason clubs adopt the platform. Payment reconciliation is the "razor blade" — clubs will adopt STOŽER specifically for this, then stay for everything else.

---

## Sports-Specific Considerations

### Football (Fudbal) in Serbia

**Federation**: Fudbalski savez Srbije (FSS)
**Registration system**: COMET (by Analyticom)
- Player registration with club is via COMET, not club software
- COMET handles transfers, licenses, referee assignments
- Clubs must register players before season — this is federation-level, not club-level
- COMET has mobile app for matchday operations (lineups, events)

**Season structure**:
- Primary season: August–May (autumn/spring)
- Youth competitions: Often split into half-seasons
- Multiple age categories: Predpioniri, Pioniri, Kadeti, Omladinci, Juniori, Seniori
- Some youth leagues play futsal in winter

**Team age categories**:
- U-8, U-10, U-12, U-14, U-16, U-19, Senior
- Some clubs have women's teams at each age level
- Some clubs have both football and futsal teams

**Key differences from basketball**:
- Outdoor field management (grass, artificial turf)
- Larger squad sizes (18-25 players per team)
- Longer season (9 months vs 6)
- Weather-dependent scheduling
- Travel for away games often longer

### Basketball (Košarka) in Serbia

**Federation**: Košarkaški savez Srbije (KSS)
**Registration system**: KSS PlayerBase + lige.kss.rs
- Player registration via regional basketball associations
- Transfer system similar to COMET but simpler
- Different registration periods and requirements than football

**Season structure**:
- Primary season: September–May
- Summer camps: June–August
- Youth leagues often run September–June
- Indoor sport = less weather disruption

**Team age categories**:
- Mini basket (U-8/U-10)
- Mlađi pioniri (U-12)
- Pioniri (U-14)
- Kadeti (U-16)
- Juniori (U-19)
- Seniori
- Women's categories at each level

**Key differences from football**:
- Indoor venue management (halls, gyms)
- Multiple games per week possible (shorter travel)
- Smaller squads (10-15 players per team)
- Shorter game duration
- More frequent practice sessions
- Venue booking is more complex (shared gym time)

### Cross-Sport Considerations for STOŽER

- **Shared players**: Some youth athletes play both football and basketball (especially at young ages). STOŽER should handle this.
- **Shared venues**: Some clubs use the same facilities for both sports.
- **Shared staff**: Coaches may work with multiple age groups or even multiple sports.
- **Different federation requirements**: Football and basketball have different registration deadlines, documentation, and rules. STOŽER should be aware but not enforce federation rules in V1.
- **Season alignment**: Both sports run similar seasons (Sep–May), so calendar management can be unified.
- **Competition formats**: Football = league + cup. Basketball = league + cup + sometimes tournaments. Both use round-robin and knockout formats.

---

## Competitor Summary

| Platform | Strengths | Weaknesses | Pricing |
|----------|-----------|------------|---------|
| **TeamSnap** | Best mobile UX, large user base, practice plans | Expensive ($200-9000/yr), no bank reconciliation, US-centric, no multi-sport | Custom/contact sales |
| **SportsEngine** | League admin, registration, NBC Sports backing | Buggy app, terrible support, financial module is "a joke", intrusive ads | $15-299+/mo |
| **LeagueApps** | Strong registration + payment processing | Transaction fees, US-focused, limited outside US | Per-registration + monthly |
| **COMET** | Federation-standard, comprehensive football operations | Federation-level only, NOT club management, complex UI | Federation-funded |
| **Waresport** | Free tier, variable pricing, modern UX | US-only, new/unproven, no bank reconciliation | $0 + 1.5-2% transaction fee |
| **SportMember** | Good payment automation, European focus | Limited multi-sport, basic scheduling | Free + low transaction fees |
| **SportEasy** | Simple mobile UX, freemium model | Limited features, no financial reconciliation | Free + €9-49/mo |

---

## Sources

- TeamSnap features and pricing: teamsnap.com, spotsaas.com, toolradar.com
- SportsEngine reviews: capterra.com, complaintsboard.com, g2.com, softwareadvice.com
- COMET documentation: analyticom.de, kb.analyticom.de, comet.fss.rs
- Market data: researchandmarkets.com, businessresearchinsights.com, marketintelo.com
- Payment patterns: qourtx.com, vantasports.ai, waresport.com, withcentro.com
- Reconciliation: vantasports.ai, clublogix.com, clubtreasurer.com, moneyminder.com
- Basketball software: playhq.com, thefuturesapp.com, kss.rs
- Feature bloat: featurebloat.com, userguiding.com
- Club management comparison: gitnux.org, classforkids.com, qourtx.com
