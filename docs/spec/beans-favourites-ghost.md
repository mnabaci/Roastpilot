# Beans, favourites and ghost

Pick a bean before preheat, or roast with no bean for a test or seasoning. The app suggests a
profile and a ghost roast from your favourites, and you confirm with one tap. A roast with no bean
changes no stock and shows "No bean" in History.

## Profiles

- Built-ins are read-only: Light · Steps and Light · Curve now, Medium and Dark once Light is tuned.
- Custom profiles: from scratch, by duplicating any profile, or from a favourite roast.
- Each custom profile records its source (a profile or a roast).

## Beans

- **Required:** name, origin, process (washed, natural, honey, other).
- **Optional:** variety, altitude (m), density (g/L), moisture (%), bean size (screen), decaf, supplier (picked from [your suppliers](#suppliers)), order link (this bean's page, a web address: Order again on the bean opens it in the browser), purchase date, notes. Density is the one to measure yourself: weigh a fixed volume of green beans.
- **Stock:** see [batch-and-stock.md](batch-and-stock.md).
- **Archive** a finished bean; its roasts stay in History.

## Suppliers

Who you buy from is kept once, with its website and contacts, and picked on each bean instead of typed again ([data-model.md](data-model.md#suppliers)).

- **Pick:** a bean's Supplier, in Edit and on Add bean, is a dropdown of your suppliers (None, then each by name with its site), with a search. Typing a name you don't have ends the list with Add supplier "<name>"; picking it is the whole step: the field shows the name with a New badge in the list and "New supplier · added when you save" under it, and Save adds the supplier with the bean. A name you have in another case is that supplier.
- **Read:** the Supplier tile shows the name, underlined with a small chevron, and its email · phone on the line under it (without contacts, the order link's site, as before); name and line are one button that opens the supplier's card (a Popover) under them: the name, which beans it supplies ("Supplies African Moon and Washed Eratoi"; three or more, "Supplies Guji and 3 more"), its website (opens in the browser: main opens the saved address, http or https only; the screen only names the supplier), email and phone, each with Copy (a tick for a moment: "Copied"), its notes, then Edit supplier. Without a website, email or phone it says "No website, email or phone yet" and offers Add details. Either opens the Suppliers dialog on that supplier; Save or Cancel goes back to the bean. Not opened: "Couldn't open Falcon's website · see Logs".
- **Keep them:** Beans "⋯" › Suppliers opens a Dialog, "Picked on each bean · their website and contacts kept here once": each supplier with its beans and site ("3 beans · falcon.coffee"), archived beans counted, then Add supplier (ghost, +). One opens in the same dialog, its name the title, with a back button (‹ Suppliers): Name, Website, Email, Phone, Notes; Delete (ghost, red text) at the left, Cancel and Save at the right. Save waits until something changed and every field checks out (a website starting https://, an email address); another supplier's name says "You have a supplier named Nordic" under Name. Delete asks once ("Delete Nordic? · Its website and contacts go too"); while beans name it, it stays there disabled with why, "Used by 3 beans · pick another supplier on them first".
- **No new tab:** suppliers belong to beans, so they live in the Beans screen's "⋯", not the top bar.

## Favourites

- A star toggle on any roast, separate from the 1–5 rating.
- Stars drive profile suggestions and the ghost choice.
- A bean's best favourite = starred, highest rating, then most recent.

## Profile suggestion

Before preheat, with Auto on, the app picks in this order, among the active roaster's profiles, and shows why in plain words:

1. Same bean: the profile of its best favourite.
2. New bean: best favourite of the most similar bean: same process and decaf or not, then closest density, then closest altitude, then same origin.
3. Then: best favourite of any bean with the same decaf or not.
4. Otherwise: the roaster's first built-in (Light · Steps), until Medium ships.

| Picked by               | Reason shown                                          |
| ----------------------- | ----------------------------------------------------- |
| The bean's own profile  | This bean's own profile                               |
| 1. Same bean            | Your best starred roast of this bean                  |
| 2. Most similar bean    | From a similar bean: Guji Natural (that bean's name)  |
| 3. Any bean, same decaf | Your best starred roast of another bean               |
| 4. Fallback             | The default · star a roast of this bean to improve it |

- On the Roast screen's setup card it is a labelled row under Batch: "Suggested profile" (label), the profile's name, "Use this profile" (secondary, 44 px) at its right, and the reason on its own muted line. The row is hidden while the suggested profile is already the one picked.

## A profile for a bean

- A bean can have its own profile. "Make a profile for this bean" duplicates the suggested one, names it after the bean and opens it in the editor; from then on it is that bean's first suggestion, ahead of its favourites. It is one step in main, all or nothing: if linking the copy to the bean fails, the copy is deleted again, so no unnamed profile is left behind; the bean shows "Couldn't make the profile · see Logs".
- Choosing another profile before a roast doesn't change the bean's own.

## Roast notes

- An ⓘ (InfoButton) beside Process, Species, Altitude, Screen size, Density, Moisture and Decaf, read and in Edit, says what that value means for roasting (`roast-notes.ts`): the first line what it is ("Natural: dried inside the whole fruit, so the bean carries more sugar."), then how it roasts and what to try ("Try easing the heat after yellowing and a shorter development, 15–20 %."). Two or three short lines, never more.
- Only for a value with something to say: none while a field is empty, for Other, or for Decaf No. It follows what you type in Edit.
- **Roasting cheat sheet:** every value's note on one page, a Dialog from Beans "⋯" › Roasting cheat sheet, or from the end of any field's ⓘ (Roasting cheat sheet, ghost, BookOpen), which opens it at that field's section. "What a bean's values often mean for roasting · starting points, not rules"; a row of section chips (Process, Species, Altitude, Density, Moisture, Screen size, Decaf) stays at the top as it scrolls and jumps to each. Each section is a bordered list, one row per value: its name and band ("High grown · 1,600 m and up") on the left, what it is (muted) and how it roasts on the right. The open bean's rows are marked "This bean" on `surface-hover`; from the Beans list with no bean open, none are. The same words as the ⓘ, from one table (`roast-notes.ts`).
- The same starting guesses as the hints (soft under 700 g/L, dense over 800, wet over 12 %), plus altitude (low under 1,200 m, high from 1,600), moisture (dry under 9 %) and screen size (small to 14, large from 17). Worded "try" and "often": general roasting knowledge, not measured on this roaster.

## Hints

- One line under the suggestion, from what the bean's record says. Only ever advice: the app never changes a profile from a bean's characteristics, and no formula calculates one.
- General roasting knowledge, not measured on this roaster, so worded "often" and "consider".

- Each hint first names why it speaks, from the bean's record, then the advice.

| Bean                  | Hint                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Natural or honey      | Natural process: these often brown faster · consider less heat late in the roast (Honey process: …) |
| Decaf                 | Decaf: often roasts fast and looks dark · judge by temperature                                      |
| Density below 700 g/L | Soft beans (650 g/L): these often run fast · consider less heat early                               |
| Density above 800 g/L | Dense beans (820 g/L): these often take heat slowly · consider more heat early                      |
| Moisture above 12%    | Moisture 12.5%: these often dry slowly · expect a longer drying phase                               |

At most two show, in this order. The density cut-offs are starting guesses; revisit them once there are starred roasts to compare.

## Favourite → step profile

- Steps come from the heat and fan changes that actually ran (merged to at most 6): each ends at the BT where it happened, in the time it took, with the RoR it ran at ±1 °C/min, its average heat and its fan. Development runs from first crack.
- A roast that never crossed the dry-end temperature, or has too little to go on, can't make one; the button says so.
- Charge temp, dry-end temp, development time and BT cap come from the run.
- The new profile belongs to the same roaster as the run.
- The result is a new custom profile; the roast itself is never changed.

## Favourite → curve profile

See [roast-control.md](roast-control.md#creating-a-curve-profile): the run's BT curve becomes the target, simplified to about 10 points.

## Taste → next roast

After cupping, say what the coffee tasted like; Roastpilot suggests one change for the next roast
of that bean, as a new profile you make with one click.

### Taste

- **Tags,** on History › Roast details, in this order: Sour, Grassy, Thin, Flat, Baked, Bitter, Roasty, Sweet and balanced. Tap to tick or untick; saved as you go, like the rating.
- **In your words** (with [AI helpers](ai-helpers.md) on): one line, "tart, a bit hay-like", and Read. Read only ticks tags, never unticks one you set; the words are kept with the roast. AI off, the field isn't there.
- Folded, Roast details' line shows the ticked tags after the rating.
- Any finished roast can be tasted, imported ones too.

### The suggestion

Worked out in `core` from the ticked tags and this roast's measured values and findings ([roast-report.md](roast-report.md)), against the profile the roast ran. Shares are judged as the report shows them, whole percentages. Auto drops at the development time or the BT cap, whichever comes first, so when the cap ended the roast (the report's cap-drop finding) a development change would do nothing: the cap moves instead. The first row that matches gives one change, or none with its reason. One change at a time, so the next cup tells you what it did.

| Tags                                                      | This roast                                          | Change                | Line shown                                                                 |
| --------------------------------------------------------- | --------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Sweet and balanced, nothing else                          | –                                                   | None; offers the star | "Sounds right · star it to roast it again"                                 |
| Both under (Sour, Grassy, Thin) and over (Bitter, Roasty) | –                                                   | None                  | "Mixed signals · change one thing at a time"                               |
| Bitter or Roasty                                          | The BT cap ended it before its development time     | BT cap −3 °C          | "Bitter or roasty · drop a little cooler"                                  |
| Bitter or Roasty                                          | Development 15 % of the roast or more               | Development −15 s     | "Bitter or roasty often means too much development"                        |
| Bitter or Roasty                                          | Development under 15 % (shorter would turn it sour) | BT cap −3 °C          | "Bitter or roasty · drop a little cooler"                                  |
| Sour, Grassy or Thin                                      | Development 20 % or more                            | None                  | "Development is already 22 % · check grind and brew first"                 |
| Sour, Grassy or Thin                                      | The BT cap ended it before its development time     | BT cap +3 °C          | "The BT cap dropped it before its development time · drop a little hotter" |
| Sour, Grassy or Thin                                      | Development under 20 %                              | Development +15 s     | "Sour, grassy or thin often means under-developed"                         |
| Flat or Baked                                             | The report found a stall or crash                   | None; points at it    | "Flat or baked often follows a stall · 6:12 · see Roast report"            |
| Flat or Baked                                             | Over 12:00, charge to drop                          | Charge temp +5 °C     | "Flat or baked often means a slow roast · 13:40 · more heat early"         |
| Flat or Baked                                             | 12:00 or less                                       | None                  | "Not a slow or stalled roast · check bean age and storage first"           |

- **Bounds:** a change that would leave the profile's limits (development 0:30–10:00, the BT cap under the roaster's limit and above charge, charge temp's range) is not made: "Development is at its 10:00 limit". Starting guesses, as the density hints: revisit them once there are tasted roasts to compare.
- **Needs the profile:** an Auto roast with its profile saved. A manual roast, or one without its profile, keeps its tags and says "Roast on Auto to get a suggestion".
- **Shown** under the tags: the change in numbers first ("Development 1:45 → 2:00"), the line under it, then **Make <bean> profile** (secondary). No suggestion, no button.

### Make the profile

- One step in main, all or nothing: a new custom profile, a copy of the profile the roast ran with the one change, on the same roaster, `source` the roast, named after the bean as "Make a profile for this bean" names it (no bean: the profile's name plus "· tasted"). It becomes the bean's own profile, so the next roast of the bean suggests it; the bean's earlier profile stays in Profiles.
- Toast: "Made Guji Natural 2 · Next roast of this bean uses it" (no bean: "· Uses it when you pick it"). A refusal is one line under the suggestion ("Nothing to change any more · the taste changed").
- The roast and its profile copy are never changed.

## Fill from a spec sheet

- **Fill details** (ghost, a sparkle icon, before Cancel) on a bean in Edit, and on Add bean, with [AI helpers](ai-helpers.md) on and a key for a provider that reads sheets. One button for every source: with a valid order link it is a menu (Fill details ▾): From the order page · shop.example (Globe), From a spec sheet… (FileText); without one it opens the spec sheet straight away.
- **From the order page:** main fetches the bean's order link (Chromium's own fetch, 15 s, up to 3 MB, a web page only) and reads its text like a pasted sheet: the page's title, its description, its product data (JSON-LD), then its words, without scripts, styles, menus and footer, up to 20,000 characters. Fill details waits, "Reading the page…"; then the same line as a sheet ("Filled 5 fields from the order page · check them, then Save"). Not opened: "Couldn't open the order page · check its link, or use a spec sheet"; too little text (a page built by script): "Nothing to read on that page · use a spec sheet instead"; in either case nothing is sent. Logs keep the page's site and size, never its text.
- **From a spec sheet:** a Dialog, "Fill from spec sheet", "Fills empty fields only · check them, then Save": Paste the sheet, Choose PDF… (ghost, at the left), then Cancel and Fill (primary, waiting for pasted text). A failed read says why in the dialog, which stays open with your text.
- **What it fills:** name (on Add bean), origin, process (washed, natural, honey or other), species, variety, altitude, density, moisture, screen size, decaf, supplier, and the sheet's tasting notes into Notes. A supplier you have is picked by its name, in any case, as you spell it. An altitude range ("1,800–2,000 m") fills its middle, 1900. A value the form would refuse is left out.
- **Only empty fields:** what you typed stays. Process and decaf have no empty state, so a sheet sets them only on a new bean, while still as the form started. One line under the header says what happened ("Filled 7 fields from the sheet · check them, then Save", or "… from the order page"); nothing is saved until you press Save.
- **A new supplier:** when the sheet names a supplier you don't have, a line under the fill line offers it with what the sheet gave: "New supplier Nordic Approach with its website and email from the sheet" (or "from the order page") and Add supplier (ghost, +), which adds it now with those details ("Added Nordic Approach to your suppliers"). Not taken, Save still adds it, by name only. A website without its scheme ("www.nordicapproach.no") is read as https; an email or website the form would refuse is left out.
- A filled record feeds the [profile suggestion](#profile-suggestion) and the [hints](#hints) as one typed by hand.
- Nothing found: "Nothing to fill from that sheet".

## Ghost layer

- **Default:** the bean's best favourite, else the profile's most recent favourite, else none.
- **Change or hide** it before or during the roast.
- **Drawn:** ghost temperature and RoR as faded lines, plus faded dry-end, FC and drop markers.
- **Delta readout:** "+3 °C vs ghost" and "0:12 ahead / behind" (when the ghost reached today's temperature).
- Reference only: it never steers the controller, which follows the profile.
- A favourite whose profile is gone, or that ran on Manual, can still be a ghost; suggestions skip it.
