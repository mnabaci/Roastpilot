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
- **Optional:** variety, altitude (m), density (g/L), moisture (%), bean size (screen), decaf, supplier, order link (a web address: Order again on the bean opens it in the browser), purchase date, notes. Density is the one to measure yourself: weigh a fixed volume of green beans.
- **Stock:** see [batch-and-stock.md](batch-and-stock.md).
- **Archive** a finished bean; its roasts stay in History.

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

Worked out in `core` from the ticked tags and this roast's measured values ([roast-report.md](roast-report.md)), against the profile the roast ran. The first row that matches gives one change, or none with its reason. One change at a time, so the next cup tells you what it did.

| Tags                                                      | This roast                          | Change                | Line shown                                                         |
| --------------------------------------------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------------ |
| Sweet and balanced, nothing else                          | –                                   | None; offers the star | "Sounds right · star it to roast it again"                         |
| Both under (Sour, Grassy, Thin) and over (Bitter, Roasty) | –                                   | None                  | "Mixed signals · change one thing at a time"                       |
| Bitter or Roasty                                          | Development 1:00 or more            | Development −15 s     | "Bitter or roasty often means too much development"                |
| Bitter or Roasty                                          | Development under 1:00              | BT cap −3 °C          | "Bitter or roasty · drop a little cooler"                          |
| Sour, Grassy or Thin                                      | Development under 20 % of the roast | Development +15 s     | "Sour or grassy often means under-developed"                       |
| Sour, Grassy or Thin                                      | Development 20 % or more            | None                  | "Development is already 22 % · check grind and brew first"         |
| Flat or Baked                                             | The report found a stall or crash   | None; points at it    | "Flat or baked often follows a stall · see Roast report"           |
| Flat or Baked                                             | No stall or crash                   | Charge temp +5 °C     | "Flat or baked often means a slow roast · 13:40 · more heat early" |

- **Bounds:** a change that would leave the profile's limits (development 0:30–10:00, the BT cap under the roaster's limit and above charge, charge temp's range) is not made: "Development is at its 10:00 limit". Starting guesses, as the density hints: revisit them once there are tasted roasts to compare.
- **Needs the profile:** an Auto roast with its profile saved. A manual roast, or one without its profile, keeps its tags and says "Roast on Auto to get a suggestion".
- **Shown** under the tags: the change in numbers first ("Development 1:45 → 2:00"), the line under it, then **Make <bean> profile** (secondary). No suggestion, no button.

### Make the profile

- One step in main, all or nothing: a new custom profile, a copy of the profile the roast ran with the one change, on the same roaster, `source` the roast, named after the bean as "Make a profile for this bean" names it (no bean: the profile's name plus "· tasted"). It becomes the bean's own profile, so the next roast of the bean suggests it; the bean's earlier profile stays in Profiles.
- Toast: "Made Guji Natural 2 · Next roast of this bean uses it" (no bean: "· Uses it when you pick it"). A refusal is one line under the suggestion ("Nothing to change any more · the taste changed").
- The roast and its profile copy are never changed.

## Fill from a spec sheet

- **Fill from spec sheet** (ghost button, before Cancel) on a bean in Edit, and on Add bean, with [AI helpers](ai-helpers.md) on and a Claude key. A Dialog, "Fills empty fields only · check them, then Save": Paste the sheet, Choose PDF… (ghost, at the left), then Cancel and Fill (primary, waiting for pasted text). A failed read says why in the dialog, which stays open with your text.
- **What it fills:** name (on Add bean), origin, process (washed, natural, honey or other), species, variety, altitude, density, moisture, screen size, decaf, supplier, and the sheet's tasting notes into Notes. An altitude range ("1,800–2,000 m") fills its middle, 1900. A value the form would refuse is left out.
- **Only empty fields:** what you typed stays. Process and decaf have no empty state, so a sheet sets them only on a new bean, while still as the form started. One line under the header says what happened ("Filled 7 fields from the sheet · check them, then Save"); nothing is saved until you press Save.
- A filled record feeds the [profile suggestion](#profile-suggestion) and the [hints](#hints) as one typed by hand.
- Nothing found: "Nothing to fill from that sheet".

## Ghost layer

- **Default:** the bean's best favourite, else the profile's most recent favourite, else none.
- **Change or hide** it before or during the roast.
- **Drawn:** ghost temperature and RoR as faded lines, plus faded dry-end, FC and drop markers.
- **Delta readout:** "+3 °C vs ghost" and "0:12 ahead / behind" (when the ghost reached today's temperature).
- Reference only: it never steers the controller, which follows the profile.
- A favourite whose profile is gone, or that ran on Manual, can still be a ghost; suggestions skip it.
