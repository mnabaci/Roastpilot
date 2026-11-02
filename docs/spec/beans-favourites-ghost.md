# Beans, favourites and ghost

Pick a bean before preheat. The app suggests a profile and a ghost roast from your favourites,
and you confirm with one tap.

## Profiles

- Light, Medium and Dark are built in and read-only.
- Custom profiles: from scratch, by duplicating any profile, or from a favourite roast.
- Each custom profile records its source (a profile or a roast).

## Beans

- **Required:** name, origin, process (washed, natural, honey, other).
- **Optional:** variety, altitude (m), supplier, purchase date, notes.
- **Stock:** see [batch-and-stock.md](batch-and-stock.md).
- **Archive** a finished bean; its roasts stay in History.

## Favourites

- A star toggle on any roast, separate from the 1–5 rating.
- Stars drive profile suggestions and the ghost choice.
- A bean's best favourite = starred, highest rating, then most recent.

## Profile suggestion

Before preheat the app picks in this order and shows why, e.g. "Your favourite roast of this bean, Oct 29":

1. Same bean: the profile of its best favourite.
2. New bean: best favourite of beans with the same process and origin.
3. Then: same process only.
4. Otherwise: Medium.

## Favourite → step profile

- Phases come from the heat and fan changes that actually ran (merged to at most 6), each triggered at the BT where it happened.
- Reference points come from the run's BT curve, simplified to about 8 points.
- Charge temp, dry-end temp, development time and BT cap come from the run.
- The new profile belongs to the same roaster as the run.
- The result is a new custom profile; the roast itself is never changed.

## Favourite → curve profile

See [roast-control.md](roast-control.md#creating-a-curve-profile): the run's BT curve becomes the target, simplified to about 10 points.

## Ghost layer

- **Default:** the bean's best favourite, else the profile's most recent favourite, else none.
- **Change or hide** it before or during the roast.
- **Drawn:** ghost temperature and RoR as faded lines, plus faded dry-end, FC and drop markers.
- **Delta readout:** "+3 °C vs ghost" and "0:12 ahead / behind" (when the ghost reached today's temperature).
- Reference only: it never steers the controller, which follows the profile.
