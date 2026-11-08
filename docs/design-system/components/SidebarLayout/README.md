# SidebarLayout

The frame of every list-and-detail screen (History, Beans, Profiles, Roasters, Settings): a sidebar on the left, the open item on the right.

## Anatomy

- **Sidebar**: `sidebar` (256px) wide, fixed; `space-6` padding on the top, left and bottom, none on the right. The screen title (`title`) on top, with the list's own actions beside it as a "⋯" Menu (History: Export CSV, Import from Artisan), then filters if any, `space-3` above the list (a NavList, or RoastList on History). The list scrolls inside the sidebar; the title stays.
- **Content**: fills the rest, `space-6` padding, scrolls on its own. A screen with nothing open shows a one-line hint here.
- No divider: the content's own cards separate the two.

## Rules

- Both sides scroll separately, so a long list never moves the open item and the top bar never scrolls.
- Same width and spacing on every screen; a screen never sets its own sidebar width.
- At 960 × 640 the content keeps at least 600px; nothing scrolls sideways.
- The Roast screen's controls panel is not a sidebar.
