# Aquarium-app

Twee apps in één map:

- **index.html**: de app voor de kinderen. Ze loggen in met hun eigen account, zien wat er vandaag moet gebeuren, vinken af (met een animatie van de goudvis) en vullen de waterwaardes in.
- **beheer.html**: jouw beheerpagina. Hier zie je wie wat gedaan en gemeten heeft, pas je taken, tijden en het ritme aan, beheer je de gezinsleden en zet je je eigen meldingen aan.

De gegevens staan in Supabase. Herinneringen gaan via web push. Alle tabellen beginnen met `aq_`.

Naast deze map heb je **aquarium-geheimen.txt** gekregen, met de sleutels voor de meldingen. Die zet je **niet** in GitHub.

---

## 1. Database aanmaken

1. Open je Supabase-project en ga naar **SQL Editor**.
2. Plak de inhoud van `supabase/schema.sql` en klik op **Run**.
   Je kunt dit later nog een keer draaien: bestaande gegevens blijven staan.

## 2. Jouw eigen account (beheer)

1. Ga naar **Authentication > Users > Add user > Create new user**. Vul je Gmail-adres en een wachtwoord in en vink **Auto Confirm User** aan.
2. Ga naar **SQL Editor** en voer dit uit, met je eigen e-mailadres (in kleine letters) en naam:
   ```sql
   insert into aq_members (email, name, role) values ('jouw@gmail.com', 'Egbert', 'beheer');
   ```
3. Zet bij **Authentication > Sign In / Providers** de optie **Allow new users to sign up** uit. Dan kan niemand anders zelf een account maken.

De kinderen voeg je later toe vanuit de beheerpagina (stap 8).

## 3. Sleutels voor meldingen

Die heb ik al voor je gemaakt: ze staan in **aquarium-geheimen.txt**. De openbare sleutel staat al in `js/config.js`.

## 4. Edge Functions

Er zijn twee functies. Maak ze aan via **Edge Functions > Deploy a new function > Via Editor**: geef de naam op, plak de code en klik op deploy.

| Naam | Code | Verify JWT |
|---|---|---|
| `aq-reminders` | `supabase/functions/aq-reminders/index.ts` | **uit** |
| `aq-members` | `supabase/functions/aq-members/index.ts` | **aan** |

- **aq-reminders** stuurt elke 15 minuten de herinneringen.
- **aq-members** laat jou vanuit het beheer accounts voor de kinderen maken.

Zet daarna bij **Edge Functions > Secrets** de vijf waarden uit **aquarium-geheimen.txt**:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`: vul hier je eigen Gmail-adres in
- `CRON_SECRET`
- `APP_URL`: vul hier je eigen GitHub Pages-adres in

## 5. Elke 15 minuten laten controleren

Ga naar **Database > Extensions** en zet `pg_cron` en `pg_net` aan. Kopieer daarna het SQL-blok uit **aquarium-geheimen.txt**, vervang `JOUWPROJECT` door je project-ID en draai het in de **SQL Editor**.

## 6. App koppelen

Vul in `js/config.js` de `SUPABASE_URL` en `SUPABASE_ANON_KEY` in. Die vind je bij **Project Settings > API**. De VAPID-sleutel staat er al in.

## 7. Op GitHub Pages zetten

1. Maak een nieuwe repository, bijvoorbeeld `aquarium`.
2. Upload alle bestanden en mappen uit deze map. **aquarium-geheimen.txt** hoort hier niet bij.
3. Ga naar **Settings > Pages**, kies **Deploy from a branch**, branch `main`, map `/ (root)`.
4. Na een minuutje staat de app op `https://jouwnaam.github.io/aquarium/`.

## 8. Gezinsleden toevoegen

1. Open `.../aquarium/beheer.html` en log in.
2. Ga naar **Gezin > Gezinslid toevoegen**. Vul naam, e-mail en wachtwoord in en kies de rol **Kind**.
   Heeft een kind geen eigen e-mail? Gebruik dan je eigen Gmail met een plusje, zoals `jouwnaam+jayden@gmail.com` en `jouwnaam+kaitlyn@gmail.com`. Gmail ziet dat als hetzelfde adres, maar voor de app zijn het aparte accounts.
3. Bij **Aanpassen** kun je later een nieuw wachtwoord instellen, als iemand het vergeten is.

## 9. Op de telefoons zetten

- **Android**: open de link in Chrome, log in, tik op **App installeren** en daarna op **Meldingen aanzetten**.
- **iPhone**: open de link in Safari, tik op **Deel > Zet op beginscherm**, open de app vanaf het beginscherm, log in en tik op **Meldingen aanzetten**. Meldingen werken op een iPhone alleen als de app op het beginscherm staat.
- **Jij**: open `beheer.html`, ga naar **Instellingen**, installeer de beheer-app en zet je meldingen aan.

De app onthoudt wie er is ingelogd. Delen twee kinderen een telefoon of tablet? Dan logt de een uit bij **Uitleg > Uitloggen** en de ander in.

---

## Wie ziet wat

| | Kind | Beheer |
|---|---|---|
| Afvinken, metingen invullen | ✓ | ✓ |
| Vandaag per ongeluk afgevinkt? Ongedaan maken | ✓ | ✓ |
| Taken, tijden en ritme aanpassen | | ✓ |
| Metingen en logboek wissen | | ✓ |
| Gezinsleden beheren | | ✓ |

Zonder in te loggen ziet niemand iets. In het beheer zie je overal wie iets gedaan heeft:
- het overzicht van vandaag,
- het rooster van 14 dagen (met de eerste letter van de naam),
- het logboek,
- de metingen,
- het aantal afgevinkte taken per persoon.

## Hoe de meldingen werken

| Wanneer | Naar wie |
|---|---|
| Op het meldingstijdstip van een taak, als die vandaag moet en nog niet is gedaan | alle kinderen ("Hoi Jayden, je aquarium roept!") |
| Op de tweede herinnering (standaard 19:30) als er nog iets openstaat | kinderen en jij |
| Onderhoud dat te laat is | jij |
| Een meting met een rode waarde | jij |

## Taak verschuiven

Bij **Taken > Aanpassen** kies je bij onderhoud een nieuwe datum. Daarna kies je een van deze twee:

- **Alleen deze keer verschuiven**: deze ene keer valt op de nieuwe datum, daarna gaat het verder in het oude ritme.
- **Nieuw ritme vanaf deze datum**: vanaf nu wordt alles vanaf de nieuwe datum doorgerekend.

## Later iets aanpassen aan de bestanden?

Verhoog in `sw.js` het versienummer (bijvoorbeeld `aquarium-v5` → `aquarium-v6`). Dan halen de telefoons de nieuwe versie op.

---

## Een nieuwe versie uitbrengen

De app laat zelf zien als er een nieuwe versie op GitHub staat. Onderin verschijnt dan **Nieuwe versie beschikbaar** met de knoppen **Bijwerken** en **Later**.

Kiest iemand **Later**, dan blijft hij op de oude versie en komt de vraag terug bij elke keer dat de app geopend wordt, tot hij op **Bijwerken** tikt.

Zo breng je een update uit:

1. Pas je bestanden aan.
2. Verhoog het versienummer op **twee** plekken, met hetzelfde nummer:
   - `sw.js`, bovenaan: `const VERSIE = "2.1";`
   - `versie.json`: `"versie": "2.1"`, en zet bij `"nieuw"` in één zin wat er veranderd is.
3. Upload de bestanden naar GitHub.

Binnen een half uur, of zodra de app weer geopend wordt, krijgen Jayden en Kaitlyn de melding. Het huidige versienummer staat onderaan, bij **Uitloggen**.

Vergeet je het versienummer te verhogen? Dan krijgt niemand de nieuwe versie te zien: de app blijft de bestanden van de vorige versie gebruiken.

---

## Bewoners tellen

Bij **Even kijken en tellen** telt Jayden de dieren met een + en −. De app vergelijkt dat met de lijst van wat erin zit. Mist er een, dan krijgt hij eerst een seintje om nog eens te kijken. Daarna wordt de telling opgeslagen. In het beheer zie je onder **Overzicht** de laatste telling, met wat er niet gezien is.

De lijst vul je in de app in (tabblad **Onderhoud**) of in het beheer (**Lijst aanpassen**).

**Eenmalig nodig:** draai `supabase/bewoners.sql` in de **SQL Editor** van Supabase. Zolang je dat niet gedaan hebt, werkt de app gewoon zoals eerst, zonder tellen.
