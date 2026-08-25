# STOŽER — PRODUCT & ARCHITECTURE BRIEF

## 1. Šta gradimo

STOŽER je jednostavan, moderan i profesionalan SaaS softver za upravljanje sportskim klubovima.

Početno tržište je Srbija, ali proizvod od prvog dana mora biti projektovan globalno.

Prvo podržavamo:

- Football / Fudbal
- Basketball / Košarka

Kasnije treba da možemo bez velikog menjanja arhitekture dodati:

- volleyball
- handball
- futsal
- hockey
- martial arts
- athletics
- swimming
- druge sportove

STOŽER mora biti:

- multi-tenant
- multi-club
- multi-sport
- multi-country
- multi-language
- multi-currency
- freemium SaaS
- responsive web application / PWA

Ne pravimo native Android aplikaciju u V1.

Ista aplikacija mora kvalitetno raditi na:

- desktop računaru
- laptopu
- Android telefonu
- iPhone telefonu
- tabletu

---

# 2. Šta STOŽER nije

STOŽER nije:

- Football Manager
- detaljna sportska analitika
- sistem za crtanje treninga
- drill library
- full accounting software
- payroll/tax software
- društvena mreža
- parent social app
- komplikovani ERP

STOŽER je:

**operativni sistem sportskog kluba.**

Njegov cilj je da predsednik, direktor i trener za nekoliko sekundi znaju:

- šta se danas dešava
- koji treninzi postoje
- koje utakmice postoje
- gde se trenira
- ko je došao na trening
- ko je platio članarinu
- ko duguje
- kome ističe registracija
- kome ističe ugovor
- kome ističe lekarski
- kome ističe trenerska licenca
- koliko košta omladinska škola
- koliko košta prvi tim
- koje obaveze klub ima prema sponzorima
- šta zahteva pažnju

---

# 3. Osnovna product filozofija

Najvažnije:

**Složena logika ispod haube, maksimalno jednostavan interfejs.**

Korisnik ne treba da oseća složenost sistema.

Ako prosečan trener ili predsednik sportskog kluba ne može bez obuke da razume ekran, UI nije dovoljno dobar.

Najvažnije UX pravilo:

**Nikada ne traži od korisnika podatak koji sistem već zna.**

Primer:

Ako trener iz U15 selekcije kreira trening:

sistem već zna:

- klub
- sport
- selekciju
- trenera

Korisnik treba samo da unese ono što nedostaje:

- datum
- vreme
- trajanje
- teren

Drugo pravilo:

**Ako korisnik mora da razmišlja gde se nešto nalazi, navigacija nije dovoljno dobra.**

Treće:

Pre dodavanja funkcije pitati:

**Da li će ovo ljudi u stvarnom sportskom klubu redovno koristiti?**

Ako neće, ne dodavati bez jasnog razloga.

---

# 4. Tehnologija

Preferirani stack:

Frontend/full-stack:

- Next.js
- TypeScript
- React

UI:

- Tailwind CSS
- shadcn/ui ili sličan kvalitetan component system

Database:

- PostgreSQL

Backend/Auth:

- Supabase

File storage:

- Supabase Storage

Authorization/security:

- PostgreSQL Row Level Security

Hosting:

- Vercel

Charts:

- Recharts ili slično jednostavno React rešenje

PWA:

- isti Next.js projekat

Ne uvoditi:

- microservices
- Kubernetes
- komplikovanu event arhitekturu
- nepotrebne servise
- overengineering

V1 treba da bude modularni monolit.

---

# 5. Multi-tenant model

Svaki sportski klub je posebna organizacija.

Glavni entitet:

`organization`

Primer:

STOŽER

- FK Radnički
- KK Metalac
- FC Example
- Basketball Academy Example

Svaki podatak koji pripada klubu mora biti vezan za:

`organization_id`

Klub A nikada ne sme da vidi podatke kluba B.

Ovo mora biti obezbeđeno i u bazi preko RLS-a, ne samo u UI-u.

Jedan korisnik može pripadati jednom ili više klubova.

Primer:

isti trener može raditi u dva kluba koristeći jedan login.

Zato odvojiti:

`users`

od:

`organization_memberships`

---

# 6. Freemium model

STOŽER treba da omogućava svakome da besplatno napravi klub.

Ne želimo potpuno zatvoren B2B sistem.

Free korisnik treba da vidi kako Stožer radi i da oseti njegovu vrednost.

Ali Free mora biti dovoljno ograničen da ozbiljan klub ima jasan razlog da pređe na plaćeni paket.

Planovi:

- FREE
- CLUB
- PRO

Granice planova ne hardkodovati.

Napraviti sistem entitlements/limits koji se podešava kroz Stožer Super Admin.

Primer limita:

- broj timova
- broj igrača
- broj staff naloga
- storage
- dostupni moduli
- izveštaji
- export
- advanced notifications
- itd.

---

# 7. FREE plan

Početna ideja:

- 1 klub
- 1 sport
- 1 selekcija
- do 20 igrača
- do 2 staff korisnika
- basic player profiles
- osnovni kalendar
- tereni
- utakmice
- osnovni dashboard
- logo
- klupske boje

Premium funkcije ne treba potpuno sakriti.

Prikazati ih sa:

🔒

Klik na zaključanu premium funkciju treba da pokaže:

- šta funkcija radi
- kako izgleda
- koju korist donosi
- Upgrade CTA

Ali veoma važna razlika:

Ako korisnik nema permission da vidi osetljive podatke, taj modul se uopšte ne prikazuje.

Dakle:

`subscription locked` ≠ `permission denied`

Premium funkcije mogu biti vidljive zaključane.

Osetljive funkcije bez dozvole moraju biti potpuno skrivene.

---

# 8. Trial

Novi klub može dobiti npr. 14 dana CLUB funkcionalnosti.

Trajanje triala mora biti konfigurabilno.

Trial ne mora zahtevati karticu.

Kada trial istekne:

- podaci se NE brišu
- premium podaci ostaju
- funkcije postaju zaključane

Primer:

tokom triala napravi:

- U15
- U17
- U19
- Seniori

Free dozvoljava jedan tim.

Nakon triala:

U15 ✅

U17 🔒  
U19 🔒  
Seniori 🔒

Upgrade ponovo otključava postojeće podatke.

---

# 9. Neaktivni Free klubovi

Besplatni klubovi koji se dugo ne koriste ne treba da zauvek ostanu u sistemu.

Predvideti configurable inactivity retention.

Početni predlog:

12 meseci bez aktivnosti.

Pre brisanja slati upozorenja, npr:

- 90 dana pre
- 30 dana pre
- 7 dana pre
- 1 dan pre

Statusi:

- active
- inactive
- scheduled_for_deletion
- archived
- deleted

Korisnik mora moći da:

- zadrži klub loginom/reaktivacijom
- exportuje svoje podatke

Predvideti soft-delete/recovery period pre hard delete.

Paid klubovi ne smeju automatski biti tretirani isto kao Free klubovi.

Expired paid klub može prvo preći u:

`read_only`

ili drugi downgrade režim.

---

# 10. Subscription/licenca

Ne koristimo klasične license key kodove.

Licenca pripada organization-u.

Subscription podržava:

- monthly
- 6 months
- yearly

Godišnja licenca će verovatno biti glavni komercijalni model.

Statusi mogu uključivati:

- free
- trial
- active_paid
- expired
- read_only
- inactive
- archived

Super Admin mora moći ručno:

- aktivirati plan
- produžiti plan
- promeniti plan
- pokrenuti trial
- završiti trial
- staviti organization u read-only
- arhivirati

Kasnije može doći online billing.

V1 ne zavisi od online payment providera.

---

# 11. Globalna arhitektura

Nikada ne pretpostavljati:

- Srbiju
- RSD
- srpski jezik
- COMET
- evropski format datuma
- fudbal

Organization mora imati:

- country
- locale
- timezone
- default currency
- language

Početno podržati:

- sr-Latn
- en

Arhitektura mora omogućavati:

- sr-Cyrl
- de
- es
- it
- fr
- druge jezike

Nikada ne praviti:

`amount_rsd`

nego:

`amount`
`currency`

UI stringove od početka napraviti kroz i18n sistem.

---

# 12. Sport abstraction

Sport je konfiguracija.

Prvo:

- football
- basketball

Kasnije se sportovi dodaju bez promene centralnog data modela.

Ne praviti ceo sistem hardkodovan za fudbal.

Team može imati:

- first_team
- youth
- academy
- other

Terminologija se može prilagođavati sportu.

---

# 13. Sportski ID igrača

Ne praviti jednu kolonu:

`comet_id`

Napraviti generički sistem:

`athlete_identifiers`

Primer:

Type:
FSS COMET

Value:
12345678

Drugi primer:

Type:
KSS Registration

Value:
98765

Kasnije:

FA ID
FIGC ID
FIBA ID
custom federation ID

Igrač može imati više identifikatora.

---

# 14. COMET

COMET nije dependency za V1.

STOŽER mora potpuno raditi bez COMET-a.

Arhitektura treba da omogući buduće integracije:

Club → Integrations

Na primer:

- COMET
- federation system
- payment provider
- messaging provider

Za integracije koristiti adapter pristup.

Ne vezivati core domain direktno za COMET modele.

---

# 15. Glavne uloge

Ne praviti 20 rigidnih user role enum-a.

Osnovne poslovne uloge:

## Club President / Owner

Vidi ceo klub.

## Youth Director

Vidi celu omladinsku školu.

## Coach

Vidi samo timove/selekcije koje vodi.

## Administration / Finance

Dodatne permissions za:

- sekretara
- administraciju
- finansije
- osobu zaduženu za registracije
- drugo ovlašćeno osoblje

Jedan user može imati više permissions.

Koristiti RBAC + permissions.

Primer permissions:

- view_team
- edit_team
- view_athletes
- edit_athletes
- manage_attendance
- view_youth_finance
- manage_youth_finance
- view_first_team_finance
- manage_first_team_finance
- manage_documents
- manage_sponsors
- manage_staff
- view_reports
- manage_club_settings
- manage_registrations
- manage_contracts

---

# 16. Roditelji

Roditelji u V1 NEMAJU Stožer account.

Roditelj/staratelj postoji kao kontakt povezan sa maloletnim igračem.

Podaci:

- name
- relationship
- phone
- email
- preferred contact method

Kasnije može postojati read-only Parent Portal.

Nemoj projektovati bazu tako da je to kasnije nemoguće.

---

# 17. Desktop navigacija — predsednik kluba

Glavna navigacija:

1. Početna
2. Timovi
3. Ljudi
4. Kalendar
5. Finansije
6. Dokumenta
7. Izveštaji
8. Klub

Globalno:

- Search
- Notifications
- Quick Add
- User Menu

---

# 18. Navigacija — Youth Director

Prikazati samo relevantno:

1. Početna
2. Omladinska škola
3. Kalendar
4. Dokumenta
5. Izveštaji

Unutar Omladinske škole:

- Pregled
- Selekcije
- Igrači
- Članarine
- Troškovi

---

# 19. Navigacija — Coach

Maksimalno jednostavno.

Na telefonu:

- Danas
- Tim
- Kalendar
- Više

Unutar Tim:

- Igrači
- Treninzi
- Utakmice
- Prisustvo
- Članarine

Coach ne treba da vidi kompleksnost upravljanja klubom.

---

# 20. Dashboard / Početna

Dashboard nije samo zbir brojeva.

Njegov posao je:

**da korisniku kaže šta danas treba da zna i šta zahteva pažnju.**

Sekcije:

## Danas

- treninzi
- utakmice
- sastanci
- događaji
- zauzeti tereni

## Zahteva pažnju

Rules-based informacije:

- registracija igrača ističe
- ugovor igrača ističe
- lekarski ističe
- trenerska licenca ističe
- članarina nije plaćena
- ugovor sponzora ističe
- sponsor obligation kasni
- konflikt terena
- task kasni

Konceptualno ovo može biti:

**Stožer noticed**

Ne koristiti AI ako obična business rule/query logika rešava problem.

## KPI

Primer:

- aktivni igrači
- broj selekcija
- treneri
- prosečno prisustvo
- članarine naplaćeno
- članarine dugovanja
- dokumenti pred istekom

## Grafikoni

Koristiti gde stvarno pomažu:

- attendance trend
- membership collection trend
- players by team
- academy finance trend
- first-team costs
- document expiration distribution

Ne zatrpavati dashboard.

---

# 21. Timovi / Selekcije

Prikaz svih selekcija.

Primer:

- Seniori
- U19
- U17
- U15
- U13
- U11

Kartica/red može imati:

- name
- coach
- player count
- next training
- next match
- attendance %
- membership payment %

Klik na tim:

- Pregled
- Igrači
- Treneri
- Treninzi
- Utakmice
- Prisustvo
- Članarine ako je youth selekcija

---

# 22. Igrač

Igrač je trajni profil kroz više sezona.

Ne praviti novog igrača svake godine.

Koristiti istoriju team membership-a.

Osnovni podaci:

- photo
- first name
- last name
- date of birth
- nationality
- current team
- position
- jersey number
- equipment size
- club join date
- status

Veličina opreme je obavezna opcija.

Početno:

- XS
- S
- M
- L
- XL
- XXL
- custom

Kasnije se može razdvojiti:

- jersey
- shorts
- tracksuit

---

# 23. Registracija igrača

Registracija i ugovor NISU isto.

Athlete → Registration:

- federation/system
- registration identifier
- registered for this club YES/NO
- registration status
- registration start
- registration expiration
- registration document
- history

Vizuelni status:

GREEN:
REGISTERED

YELLOW:
EXPIRING SOON

RED:
EXPIRED / NOT REGISTERED

Expiration warning threshold configurable.

---

# 24. Ugovor igrača

Posebna sekcija.

Najvažnija za prvi tim.

Fields:

- amateur / professional
- contract start
- contract end
- contract file
- annexes
- loan
- termination
- notes

Contract expiration mora generisati upozorenje.

---

# 25. Plata igrača

Opcija uglavnom za prvi tim.

Veoma osetljiva.

Samo korisnici sa eksplicitnim permission mogu da je vide.

Fields:

- base salary
- currency
- payment period
- valid from
- valid until

Period može biti:

- monthly
- annual
- custom

---

# 26. Bonusi

Igrač može imati više bonusa.

Fields:

- bonus type
- description
- amount
- currency

Primer:

- win bonus
- appearance bonus
- goal bonus
- custom

Ne praviti payroll/tax calculation.

Stožer vodi evidenciju.

---

# 27. Athlete Documents

Primer:

- registration
- contract
- medical
- insurance
- identity document if required
- federation document
- custom

Document metadata:

- type
- filename
- storage path
- issued_at
- expires_at
- notes

Expiration alerts.

---

# 28. Athlete Notes

Ne praviti napredni Player Development sistem u V1.

Samo interne beleške:

- author
- date
- note
- optional tag

Primer:

`Potential for older team`

Kasnije se može razviti poseban development module.

---

# 29. Staff

Staff profil:

- name
- photo
- contact
- title
- teams
- start/end
- license
- license number
- license expiration
- documents
- notes

Podržati:

- coach
- assistant
- goalkeeper coach
- strength coach
- doctor
- physiotherapist
- director
- secretary
- custom

UI treba da pokazuje samo ono što klub koristi.

---

# 30. Trening

Trening mora biti ekstremno jednostavan.

Fields:

- date
- start time
- duration
- venue
- team
- coach
- optional note

NE radimo:

- vežbe
- warmup plan
- taktiku
- drill library
- detailed training methodology

Coach workflow:

Danas → Trening → Prisustvo.

---

# 31. Prisustvo

Za svakog igrača:

- present
- absent
- excused
- late
- unavailable

Coach mora moći da završi attendance cele selekcije za manje od jednog minuta.

Reporting:

- attendance %
- attendance trend
- player attendance history

---

# 32. Utakmice

Bez komplikovanih sportskih statistika.

Fields:

- team
- competition
- opponent
- home/away
- date
- time
- venue
- result
- selected players
- optional note

Kasnije opciono:

- scorers

NE praviti u V1 kao obavezu:

- minutes played
- assists
- shots
- duels
- advanced statistics

---

# 33. Kalendar

Unified club calendar.

Event types:

- training
- match
- tournament
- meeting
- club event
- deadline
- task

Filters:

- team
- venue
- coach
- event type

---

# 34. Tereni / Venues

Klub sam kreira terene/dvorane.

Fields:

- name
- short description
- address
- location
- venue type

Primer:

Name:
Pomoćni teren

Description:
Veštačka trava iza glavnog stadiona.

Sistem treba da detektuje konflikt:

dve selekcije koriste isti teren u isto vreme.

---

# 35. FINANSIJE — kritična odluka

Finansije omladinske škole i finansije prvog tima su potpuno različiti domeni.

NE praviti jedan generički finance ekran za sve.

Backend može deliti primitive gde ima smisla, ali UX i permissions moraju biti jasno razdvojeni.

---

# 36. Omladinska škola — finansije

Youth igrači:

- plaćaju članarinu
- mogu plaćati prevoz
- mogu plaćati turnire
- mogu plaćati opremu
- uglavnom nemaju platu

Youth Finance Dashboard:

- expected memberships
- collected
- outstanding
- % collected
- number unpaid
- youth expenses

Grafikoni:

- članarine po mesecima
- naplata po selekcijama
- dugovanja

Youth Director vidi celu omladinsku školu.

Coach vidi samo svoju selekciju.

Club President vidi celu omladinsku školu.

---

# 37. Članarine

Svaka youth selekcija može imati:

- membership amount
- currency
- billing frequency
- due day

Sistem automatski kreira mesečna zaduženja.

Primer:

U15

3000 RSD

due day: 10

Support:

- paid
- partial
- unpaid
- waived
- discounted

Individualni igrač može imati:

- custom amount
- percentage discount
- temporary exemption
- full exemption

---

# 38. Club Athlete ID / Poziv na broj

OBAVEZNO.

Svaki igrač dobija stabilan jedinstveni broj unutar kluba.

Primer:

10427

Field:

`club_athlete_id`

Za članarine se isti broj koristi kao:

**payment reference / poziv na broj**

Roditelj koristi isti broj svakog meseca.

Ne menja se prema mesecu.

---

# 39. Payment allocation pravilo

Najvažnije finansijsko pravilo omladinske škole:

**Svaka naredna uplata sa payment reference brojem igrača knjiži se na najstariju neplaćenu članarinu.**

FIFO:

oldest unpaid charge first.

Primer:

Maj 3000 unpaid  
Jun 3000 unpaid  
Jul 3000 unpaid

Uplata 3000:

Maj PAID

Sledeća uplata 3000:

Jun PAID

Uplata 6000:

zatvara dve najstarije obaveze.

Uplata 4500:

Maj 3000 PAID  
Jun 1500 PARTIAL

Ako ostane višak bez otvorenih zaduženja:

kreirati athlete credit/balance.

Ovlašćeni finance user kasnije može ručno reallocate ako postoji poseban razlog.

Sve promene auditovati.

Ova logika mora imati automated tests.

---

# 40. Bank statement import

Ne zavisiti od API-ja banke.

V1 treba da podrži upload bank statement fajla.

Početno:

- CSV
- XLSX

Arhitektura parsera treba kasnije da omogući:

- XML
- MT940
- bank-specific formats

Workflow:

1. user uploaduje izvod
2. sistem parsira transakcije
3. pokušava match
4. automatski knjiži sigurna poklapanja
5. predlaže nejasna
6. ostavlja unmatched

Matching priority:

1. payment reference / club athlete ID
2. amount
3. payer identity
4. previous confirmed payer mapping

Statusi:

- Auto matched
- Suggested
- Unmatched

Ako payment reference odgovara athlete ID-u:

to je primarni source of truth.

---

# 41. Payer Mapping

Ako user jednom potvrdi:

Milan Petrović → Petar Petrović

sistem može zapamtiti vezu.

Sledeća uplata istog uplatioca dobija veći confidence.

Ne koristiti AI nagađanje kao jedini razlog za automatsko finansijsko knjiženje.

---

# 42. Gotovina

Coach može za svoju selekciju evidentirati gotovinsku uplatu.

Workflow:

Team → Memberships → Player → Record Payment

Fields:

- amount
- date
- payment method
- note

Payment method:

- cash
- bank
- other

Sistem automatski beleži:

- user koji je evidentirao
- timestamp

Coach NE SME:

- da trajno obriše uplatu
- da menja bankarski import
- da menja cenu članarine
- da oslobodi igrača članarine
- da vidi tuđe selekcije

Ako je uplata pogrešna:

koristiti reversal/correction.

Audit trail mora ostati.

---

# 43. Coach membership screen

Coach → Team → Članarine.

Primer:

19 / 23 paid

83%

Collected:

57,000 / 69,000

Po defaultu prvo prikazati:

**Needs attention**

odnosno:

- unpaid
- partial

Coach actions:

- record cash payment
- view payment history
- remind/contact guardian

Ne zatrpavati ga svim plaćenim igračima.

---

# 44. Obaveštenja roditeljima

Roditelj nema account u V1.

Notification architecture mora biti provider-independent.

Početno može biti email.

Kasnije:

- SMS
- WhatsApp
- Viber
- push
- parent portal

Ne vezivati business logic za jedan messaging provider.

---

# 45. Prvi tim — finansije

Potpuno odvojeno od omladinske škole.

First team uglavnom nema članarine.

First Team Finance prati:

- player salaries
- staff salaries
- bonuses
- match expenses
- travel
- accommodation
- venue/stadium costs
- other operational expenses

Dashboard:

- player salaries this month
- staff salaries
- bonuses
- travel
- other expenses
- total first team cost

Charts:

- monthly costs
- salary trend
- bonus trend
- travel expenses

---

# 46. First Team permissions

Plata i bonusi su osetljivi.

User mora imati:

`view_first_team_finance`

za pregled.

Za menjanje:

`manage_first_team_finance`

Youth Director nema ovaj pristup.

Coach nema pristup osim ako nije posebno ovlašćen.

Ako nema permission:

modul se uopšte ne prikazuje.

---

# 47. Troškovi utakmica / gostovanja

Game/event može imati expenses:

- transport
- venue/court rental
- referees/fees
- accommodation
- food
- tournament fee
- other

Za youth može postojati:

`athlete contribution`

Primer:

15 igrača × 1500 RSD.

Sistem prati:

- koliko svaki igrač treba da plati
- koliko je ukupno prikupljeno
- ko nije platio

Ovo je odvojeno od mesečne članarine.

---

# 48. Sponzori

Club-level modul.

Sponsor fields:

- name
- logo
- contact
- contract start
- contract end
- contract value
- currency
- contract file
- notes

Sponsor obligations:

- description
- due date
- status

Primer:

- logo on jersey
- stadium advertisement
- social media posts
- tickets
- event appearance
- custom

Status:

- pending
- completed
- overdue

Alerts:

- sponsor contract expiring
- sponsor obligation overdue

---

# 49. Dokumenta kluba

Club Documents.

Klub sam pravi strukturu/foldere.

Primer:

- federation
- contracts
- legal
- sponsors
- administration
- finance
- custom

Files mogu biti:

- PDF
- DOCX
- XLSX
- PNG
- JPG
- drugo

---

# 50. Club Templates

Template-i su PRIVATNA biblioteka svakog kluba.

Klub sam uploaduje dokumente koje često koristi.

Primer:

- saglasnost roditelja
- prijava
- opravdanje
- memorandum
- zahtev
- putni nalog
- ugovor
- formular

Features:

- folders
- favorites
- download
- rename
- replace
- delete according to permissions

Najčešće korišćeni template-i mogu biti dostupni sa Dashboarda kao:

**Quick Documents**

---

# 51. Brand Kit

Club → Identity.

Čuvati:

- logo PNG
- logo SVG
- logo PDF
- primary color
- secondary color

Stožer mora automatski koristiti:

- grb kluba
- primarnu accent boju
- sekundarnu accent boju

Ali core UI ostaje neutralan.

Ne bojiti ceo proizvod bojama kluba.

Klupske boje su accents.

Cilj je da klub ima osećaj:

**„Ovo je naš sistem.“**

---

# 52. Obaveze / Tasks

Ne praviti project management platformu.

Jednostavan task:

- title
- assignee
- due date
- status
- optional note

Status:

- open
- completed

Kasnije eventualno:

- waiting

Overdue task ide na Dashboard → Requires Attention.

---

# 53. Izveštaji

Reports su važan paid feature.

Podržati:

- Club Overview
- Players
- Registrations
- Contracts
- Attendance
- Youth Memberships
- Youth Expenses
- First Team Costs
- Sponsors
- Expiring Documents

Filters:

- season
- date range
- team
- category

Exports:

- PDF
- XLSX

Koristiti grafikone tamo gde olakšavaju razumevanje.

---

# 54. Search

Globalna search funkcija.

Početno traži:

- athletes
- staff
- teams
- sponsors
- documents

Search mora poštovati:

- organization
- permissions

---

# 55. Quick Add

Globalno + dugme.

Prikazati prema permissions:

- Athlete
- Training
- Match
- Payment
- Document
- Task

Contextual quick actions su poželjne.

---

# 56. Notifications

Notification center.

Primer:

- registration expiring
- contract expiring
- medical expiring
- coach license expiring
- unpaid membership
- venue conflict
- sponsor contract expiring
- sponsor obligation overdue
- task overdue
- trial ending
- subscription ending

Support read/unread.

---

# 57. Sezone

Organization ima sportske sezone.

Primer:

2026/27

Season rollover mora biti jednostavan.

`Start New Season`

Opcije:

- copy teams
- copy staff
- retain permanent athlete profiles
- move athletes between teams

Primer:

U15 → U17

Ne kreirati novog sportistu.

Koristiti history/membership tabelu.

---

# 58. Import igrača

Obavezno.

Klub sa 300 igrača ne sme ručno unositi 300 igrača.

Podržati:

- CSV
- XLSX

Workflow:

1. upload
2. column mapping
3. preview
4. validation
5. import

Primer mapping-a:

- First Name
- Last Name
- Date of Birth
- Team
- Jersey Number
- Equipment Size
- Registration ID
- Club Athlete ID

Kasnije staff import.

---

# 59. Predloženi database domains

Ne koristiti slepo ako postoji bolji model, ali sačuvati business logiku.

Core:

- users
- organizations
- organization_branding
- organization_settings
- subscriptions
- plans
- plan_entitlements
- organization_memberships
- roles
- permissions
- role_permissions

Sport:

- sports
- seasons
- teams
- team_staff

People:

- athletes
- athlete_identifiers
- athlete_team_memberships
- guardians
- staff
- staff_team_memberships

Registration/contracts:

- athlete_registrations
- athlete_contracts
- athlete_contract_documents
- athlete_compensation
- athlete_bonuses
- staff_licenses

Activity:

- venues
- events
- trainings
- attendance
- games
- game_rosters

Youth finance:

- membership_schemes
- membership_charges
- payments
- payment_allocations
- payer_mappings
- bank_statement_imports
- bank_statement_rows
- athlete_contributions

First team finance:

- first_team_salary_records
- first_team_bonus_records
- operational_expenses

Sponsors:

- sponsors
- sponsor_contracts
- sponsor_obligations

Documents:

- documents
- document_folders
- club_templates
- template_folders
- brand_assets

Tasks:

- tasks

System:

- notifications
- audit_log
- integration_connections
- integration_sync_logs
- imports

Predložiti poboljšanja i normalizaciju kada je potrebno.

---

# 60. Audit Log

Važne administrativne i finansijske promene moraju imati istoriju.

Logovati:

- payment created
- payment imported
- payment reversed
- payment reallocated
- membership waived
- membership amount changed
- registration changed
- contract changed
- salary changed
- bonus changed
- sensitive document deleted
- permissions changed

Fields:

- organization_id
- actor_user_id
- action
- entity_type
- entity_id
- old_value where appropriate
- new_value where appropriate
- timestamp

---

# 61. Security

Posebno zaštititi:

- podatke maloletnika
- finansijske podatke
- ugovore
- plate
- bonuse
- medicinske dokumente
- lične podatke

Koristiti:

- Supabase Auth
- RLS
- server-side permission checks
- private storage
- signed URLs where needed

Nikada se ne oslanjati samo na:

`display: none`

ili sakriveno dugme.

Security mora postojati u backend/database sloju.

---

# 62. File Storage

Fajlove ne čuvati kao binary u PostgreSQL.

Database čuva metadata.

Supabase Storage čuva fajl.

Storage mora biti organization scoped.

Koncept:

`/{organization_id}/athletes/...`

`/{organization_id}/club-documents/...`

`/{organization_id}/templates/...`

`/{organization_id}/branding/...`

---

# 63. UI Design

Vizuelni pravac:

- clean
- tech
- sports
- premium
- minimalist
- professional
- extremely readable

Sportski karakter bez klišea.

Ne želimo:

- generičan AI dashboard
- gomilu gradienta
- previše rounded kartica
- flashy gaming izgled
- nepotrebne animacije
- agresivne klupske boje

Koristiti:

- dosta whitespace-a
- jasnu tipografsku hijerarhiju
- velike KPI brojeve
- čiste tabele
- jednostavne grafikone
- diskretne cards
- jasne status colors
- jedan glavni CTA po ekranu

Primary club color:

accent.

Secondary club color:

secondary accent.

Neutralna baza UI-a.

---

# 64. Mobile UX

Coach workflow je mobile-first.

Coach treba da može:

- otvori današnji trening
- evidentira prisustvo
- vidi ko duguje članarinu
- evidentira keš
- vidi sledeću utakmicu

bez desktop računara.

Attendance za normalnu selekciju mora biti moguć za manje od jednog minuta.

---

# 65. Grafikoni

Koristiti samo gde stvarno pomažu.

Dobri primeri:

- attendance over time
- membership collections
- unpaid membership trend
- athletes by team
- youth finance
- first team cost trend
- expiring documents

Ne praviti chart samo zato što biblioteka to omogućava.

---

# 66. Empty States

Prazan ekran mora pomoći korisniku.

Loše:

`No data`

Dobro:

`Još nemate igrače.`

CTA:

`Dodaj prvog igrača`

Ako nema treninga:

`Zakaži prvi trening`

Ako je premium funkcija zaključana:

prikaži benefit + preview + Upgrade.

---

# 67. Onboarding

Create Club flow mora biti veoma kratak.

Početno pitati samo:

1. Club Name
2. Sport
3. Country
4. Language
5. Currency
6. Timezone suggestion
7. Logo
8. Primary Color
9. Secondary Color
10. First Team/Selection
11. Add or Import Players

Ne tražiti 40 podataka prvog dana.

---

# 68. STOŽER SUPER ADMIN

Poseban admin prostor za vlasnika SaaS-a.

Dashboard:

- total organizations
- free organizations
- trials
- paid organizations
- inactive
- new signups
- active users
- storage usage
- subscription metrics

Organizations:

- name
- country
- sport
- plan
- status
- created
- last activity
- athlete count
- user count
- storage usage

Subscriptions:

- plan
- start
- end
- trial
- extend
- downgrade
- cancel
- read-only

Plans:

Super Admin može podešavati:

- prices
- billing period
- athlete limit
- team limit
- staff limit
- storage
- feature entitlements
- trial duration

Inactive clubs:

- warning
- scheduled deletion
- archive
- delete

Predvideti budući bezbedan support-access sistem.

---

# 69. Šta NE raditi u V1

Ne implementirati:

- advanced player development scoring
- complex scouting
- drill library
- training workout builder
- advanced match statistics
- mandatory minutes played
- social network
- parent app
- native Android
- complete accounting
- payroll taxes
- AI chatbot
- COMET integration
- QR payment system
- online payments
- WhatsApp integration
- SMS integration
- white-label custom domains
- microservices

Arhitektura može ostaviti prostor za kasnije.

---

# 70. Engineering Principles

Koristiti:

- TypeScript strict
- clear domain naming
- schema validation
- reusable components
- server-side authorization
- database migrations
- foreign keys
- unique constraints
- proper indexes
- RLS
- transactions za finansijske operacije

Finansijske operacije moraju biti atomic.

Nikada ne dozvoliti da jedan payment bude allocated dva puta.

---

# 71. Critical Membership Payment Algorithm

Ovo je critical business rule.

Incoming payment:

1. identify organization
2. parse payment reference
3. find athlete by `club_athlete_id`
4. find oldest unpaid/partial membership charge
5. allocate payment
6. if money remains, continue to next oldest charge
7. if partial payment, mark charge partial
8. if all debts are covered and money remains, store athlete credit
9. create audit log

Sve mora biti jedna database transaction.

Primer:

Charges:

May = 3000 unpaid  
June = 3000 unpaid  
July = 3000 unpaid

Incoming:

4500

Result:

May = 3000 PAID  
June = 1500 PARTIAL  
July = 3000 UNPAID

Ovo mora imati automated tests.

Test cases:

- exact payment
- partial payment
- payment covering multiple months
- overpayment
- duplicate import
- reversal
- reallocation

---

# 72. Product cilj

Krajnji Stožer može imati veoma ozbiljnu arhitekturu i mnogo podataka.

Ali korisnik mora imati osećaj da je proizvod jednostavan.

Idealni korisnici su ljudi koji danas koriste:

- papir
- Excel
- WhatsApp
- bankarski izvod
- foldere na računaru

Njima Stožer mora odmah biti razumljiv.

Idealna reakcija:

**„Aha, jasno mi je.“**

Ne:

**„Gde se ovde šta nalazi?“**

---

# 73. Prvi zadatak za coding agenta

NE IMPLEMENTIRAJ CEO PROIZVOD ODMAH.

Prvo pročitaj ovaj dokument u celosti.

Zatim isporuči:

## A. System Architecture

Objasni:

- application architecture
- module boundaries
- multi-tenant model
- auth model
- authorization model
- subscription/entitlement model
- storage model
- import architecture
- integration architecture

## B. Database ERD

Prikaži glavne tabele i veze.

Posebno proveri:

- organization isolation
- season history
- athlete history
- team memberships
- registration history
- contracts
- payment allocation
- finance separation
- roles/permissions

## C. Route Tree

Desktop i mobile routes.

## D. Permission Matrix

Za:

- Club President
- Youth Director
- Coach
- Administration/Finance

## E. Free / Club / Pro Matrix

Predloži raspodelu funkcija.

Ne zaključavati još konačne komercijalne cene.

## F. Critical Workflows

Detaljno opiši flow:

1. Create club
2. Import players
3. Create team
4. Create training
5. Record attendance
6. Generate monthly membership charges
7. Import bank statement
8. Match payment using athlete payment reference
9. Allocate payment to oldest unpaid membership
10. Record cash payment
11. Add player registration
12. Add player contract
13. Add salary
14. Add bonuses
15. Expiring registration alert
16. Add sponsor
17. Add sponsor obligation
18. Upload club template
19. Season rollover

## G. Security / RLS Plan

Objasni konkretno:

- kako Club A nikada ne vidi Club B
- kako Coach vidi samo svoje selekcije
- kako Youth Director vidi celu omladinsku školu
- kako first-team salaries ostaju skrivene bez permission-a
- kako se čuvaju privatni fajlovi
- kako se sprečava tenant leakage

## H. Implementation Roadmap

Podeli razvoj na jasne faze.

Preferirati manje faze koje se mogu:

- planirati
- implementirati
- testirati
- verifikovati

Preporučeni princip:

foundation pre features.

Ne počinjati UI stranice dok nisu definisani:

- tenancy
- auth
- permissions
- database fundamentals

---

# 74. Nakon odobrenja arhitekture

Tek nakon što odobrimo architecture/ERD/permissions/roadmap:

1. initialize Next.js project
2. configure TypeScript
3. configure UI system
4. configure Supabase
5. create migrations
6. create RLS
7. implement authentication
8. implement organization onboarding
9. implement organization switching
10. implement app shell/navigation
11. implement teams
12. implement athletes
13. implement staff
14. implement venues/calendar
15. implement trainings
16. implement attendance
17. implement registrations/contracts
18. implement youth membership system
19. implement bank statement import
20. implement first-team finance
21. implement sponsors
22. implement documents/templates
23. implement reports
24. implement subscription locking
25. implement notifications
26. implement PWA

Posle svakog modula:

- typecheck
- lint
- tests
- security review
- tenant isolation review
- mobile UX review

---

# 75. Final instruction

STOZER-BRIEF.md je product source of truth.

Ne menjati poslovnu logiku bez razloga.

Ako tehnička odluka iz briefa nije dobra:

1. objasni problem
2. predloži jednostavnije i robusnije rešenje
3. sačekaj odobrenje ako promena utiče na product behavior

Nemoj overengineerovati.

Nemoj dodavati funkcije samo zato što su tehnički zanimljive.

Prioriteti su:

1. jednostavnost
2. bezbednost
3. preglednost
4. pouzdanost
5. brzina korišćenja
6. skalabilna arhitektura
7. lep i moderan UX

Prvo napravi architecture proposal.

Nemoj još implementirati ceo proizvod.