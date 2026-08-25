# STOŽER — Agent Instructions

## 1. Project source of truth

`STOZER-BRIEF.md` je glavni product source of truth.

Pre bilo kakve:
- arhitektonske odluke
- izmene poslovne logike
- nove funkcije
- baze podataka
- permissions sistema

prvo pročitati relevantne delove `STOZER-BRIEF.md`.

Ne menjati product logiku bez razloga.

Ako implementation zahteva odstupanje:
1. objasni problem
2. predloži jednostavnije rešenje
3. ne menjaj behavior bez jasnog razloga

---

## 2. Development workflow

Koristi GSD kao glavni workflow za razvoj projekta.

Za svaki ozbiljniji task:

1. proveri trenutno stanje projekta
2. pročitaj relevantni GSD phase/context
3. napravi plan
4. implementiraj najmanju smislenu celinu
5. testiraj
6. proveri permissions/security
7. proveri mobile UX
8. dokumentuj važnu odluku

Ne prelazi direktno iz ideje u veliki implementation.

---

## 3. Keep Stožer simple

STOŽER mora biti maksimalno jednostavan za krajnjeg korisnika.

Pre dodavanja bilo koje funkcije pitaj:

- Da li je ovo traženo u briefu?
- Da li će realan sportski klub ovo redovno koristiti?
- Može li workflow biti kraći?
- Može li korisnik imati manje klikova?
- Da li sistem već zna podatak koji tražimo od korisnika?

Ne dodavati speculative features.

Posebno ne dodavati bez eksplicitnog zahteva:

- detaljne trening planove
- drill library
- advanced sports analytics
- kompleksan player development
- full accounting
- payroll tax sistem
- komplikovan project management
- nepotrebne AI funkcije

---

## 4. Skills

Koristi instalirane skillove samo kada su relevantni.

### Database / Supabase
Koristi:
- Supabase skills
- Supabase PostgreSQL best practices

za:
- schema design
- Auth
- RLS
- migrations
- storage
- security
- indexing
- query performance

### React / Next.js
Koristi:
- React best practices
- Composition patterns

za:
- component architecture
- server/client boundaries
- performance
- reusable UI
- održiv frontend

### UI / UX
Koristi:
- frontend-design
- web-design-guidelines

za:
- layout
- hierarchy
- forms
- accessibility
- responsive behavior
- UX review
- visual consistency

### Marketing
Koristi relevantne marketing skillove za:
- pricing
- onboarding
- signup
- paywalls
- copywriting
- CRO
- product positioning

Ne koristiti marketing skillove za core engineering taskove.

---

## 5. Architecture principles

STOŽER je:

- multi-tenant
- multi-club
- multi-sport
- multi-country
- multi-language
- multi-currency
- freemium SaaS

Ne praviti arhitekturu koja pretpostavlja:

- Srbiju kao jedinu državu
- RSD kao jedinu valutu
- fudbal kao jedini sport
- COMET kao jedini registration system
- jedan klub po korisniku

Svaki organization-owned zapis mora biti jasno tenant scoped.

Koristi `organization_id` dosledno.

---

## 6. Security

Security nije samo UI problem.

Authorization mora biti sproveden:
- server-side
- database-side
- kroz RLS gde je primenljivo

Nikada se ne oslanjati samo na sakrivanje dugmeta.

Posebno zaštititi:

- podatke maloletnika
- ugovore
- plate
- bonuse
- finansije
- medicinske dokumente
- privatne fajlove
- registracione podatke

First-team salary informacije se nikada ne smeju vratiti korisniku bez odgovarajućeg permission-a.

---

## 7. Financial correctness

Finansijska logika je kritična.

Ne koristiti destructive delete za važne finansijske podatke.

Koristiti:
- transactions
- audit log
- reversal/correction
- idempotency gde je potrebno

Membership payment se po defaultu alocira na najstarije otvoreno dugovanje.

Payment allocation mora imati automated tests.

Posebno testirati:

- exact payment
- partial payment
- payment preko više meseci
- overpayment
- duplicate import
- reversal
- reallocation

---

## 8. Database changes

Schema promene raditi kroz migrations.

Ne praviti ručne neponovljive izmene baze.

Za svaku novu tabelu ili veću izmenu proveriti:

- foreign keys
- unique constraints
- indexes
- tenant isolation
- RLS
- audit requirements
- delete behavior

Ne praviti dva različita modela za isti koncept bez razloga.

---

## 9. UI principles

Vizuelni pravac:

- clean
- technical
- premium
- minimalist
- sports-oriented without clichés
- extremely readable

Koristi:
- whitespace
- jasnu tipografsku hijerarhiju
- jednostavne tabele
- jasne status indikatore
- grafikone samo gde pomažu
- contextual actions

Izbegavati:
- generičan AI dashboard izgled
- nepotrebne gradijente
- previše cards
- nepotrebne animacije
- flashy gaming izgled
- previše klupskih boja

Klupske boje koristiti kao accent.

---

## 10. UX rules

Najvažnije UX pravilo:

**Ne pitaj korisnika za podatak koji sistem već zna.**

Primer:

Ako se trening kreira iz selekcije:
- organization je poznat
- team je poznat
- sport je poznat
- često je i coach poznat

Tražiti samo nedostajuće podatke.

Drugo pravilo:

**Najčešća akcija treba da bude najlakša.**

Primer:

Coach attendance mora biti moguć za manje od jednog minuta.

---

## 11. Role-based simplicity

Ne prikazivati svima sve.

President:
- ceo klub

Youth Director:
- omladinska škola

Coach:
- njegove selekcije

Admin/Finance:
- samo dozvoljeni administrativni/finansijski moduli

Permission-restricted funkcije ne prikazivati kao premium locked feature.

One treba da budu potpuno skrivene.

---

## 12. Mobile

Coach workflow mora biti odličan na telefonu.

Posebno optimizovati:

- današnji trening
- attendance
- članarine
- sledeću utakmicu
- quick actions

Ne praviti desktop-only workflow.

---

## 13. Testing

Pre nego što task smatraš završenim pokreni relevantno:

- typecheck
- lint
- unit tests
- integration tests gde je potrebno
- build

Za tenant/security izmene:
- testirati da Organization A ne može pristupiti Organization B podacima

Za permissions:
- testirati unauthorized access server-side

Za financial logic:
- koristiti automated tests

---

## 14. Git discipline

Pravi fokusirane izmene.

Ne menjati nevezane fajlove bez razloga.

Ne raditi velike refactore usput.

Nikada ne commitovati:
- secrets
- API keys
- `.env`
- credentials

Preferirati male koherentne checkpoint-e.

---

## 15. Documentation

Ako se promeni važna arhitektonska ili poslovna odluka:
- ažurirati odgovarajuću dokumentaciju

`STOZER-BRIEF.md` ne prepravljati neobavezno.

Bitne tehničke odluke kasnije čuvati u:
- `docs/`
- GSD planning artefaktima
- ADR dokumentima ako bude potrebno

---

## 16. V1 discipline

V1 mora ostati fokusiran.

Ne implementirati bez posebne odluke:

- native Android
- COMET integration
- online payment processing
- QR payments
- WhatsApp/SMS
- advanced scouting
- full accounting
- advanced match stats
- detailed player development
- custom white-label domains
- AI chatbot

Arhitektura sme da ostavi prostor za kasnije.

---

## 17. Before implementation

Pre većeg feature implementation-a proveri:

1. da li postoji odgovarajući GSD plan
2. da li je database model jasan
3. da li su permissions jasni
4. da li je tenant isolation jasna
5. da li je mobile flow jasan
6. da li postoji jednostavnije rešenje

Ako nešto nije jasno, prvo razjasni arhitekturu umesto da nagađaš.