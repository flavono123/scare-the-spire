# Weekly Patch 48: Creative AI

- **Date**: 2018-11-02
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2407631646373420834)

## Content

Happy Halloween (yesterday)!

This week we mainly worked on the final content which is now being tested in the beta branch! However, various fixes and improvements while working on this has carried over as well.

### Final Content
It's currently being tested in the [beta branch.](https://steamcommunity.com/games/646570/announcements/detail/1462971926900801868) It's on track to make it into the main branch this month (November)!

### Beta Art!
When implementing cards throughout the development of Slay the Spire we drew and received a lot of placeholder art before our talented artists gave us finalized artwork. We've decided to share this artwork in the game but there's a problem: Not all of our cards have placeholder art.



We need your help to fill in the missing art or the beta art feature may not make it into the full release :(.

To help us resolve this crisis, please take a look at this [secret document which indicate what cards are missing beta art.](https://docs.google.com/spreadsheets/d/1Oa5Ev8ivQiQlORiVeLhmUpwh3Ajnx-1tFgjJRzyDBLY/edit#gid=0)

For contributions, we need a 500 x 380 PNG image that match a card template based on the card's type (templates below). Anything outside of the template will be removed. Note: Status and Curse cards utilize the Skill template.


*Attack template*


*Skill/Status/Curse template*


*Power template*

**Submission Guidelines**
Though we encourage any kind of art, please keep in mind that suggestions may be rejected for the following reasons:

- Suggestive or offensive content.
- Too little effort.
- Too much effort, you're making us look bad.
- Too many submissions from a single person (let other people have fun, too!)
- There's already art for that card, we can only have one slot. Sorry :(.
- The art is not related to the card at all.
- It's too late (noooo).
Once your submission is ready, either post the image and tag us @Developers at our [Discord server,](https://discord.gg/SlayTheSpire) or email us at support@megacrit.com. We cannot accept submissions through Twitter as the image will be severely compressed.

### Community Fan Art

*The characters cosplaying each other by [/u/Dragonclaude](https://www.reddit.com/user/dragonclaude/posts/)*


*The Silent by [@nick_jeez](https://www.instagram.com/nick_jeez/)*


*Deca and Donu Redesign by [Mr. Krane](https://www.artstation.com/krane)*

**Patch Notes**
### Balance
- Removing the Colossus mod to be reworked.
### UI and Effects
- Adjust margin for run history's path elements to match relics and cards.
- Blizzard gets improved size, velocity, and SFX pitch scaling logic (now up to 50 Frost). 
- Checkbox to view upgrade in single card view is now much larger.
- Improved Dagger Spray VFX readability and no longer flashes a sprite for 1 frame at the start.
- Thousand Cuts power' now displays its VFX faster (0.25s -> 0.2s and 0.25s -> 0.1s FAST MODE).
### Bug Fixes
- Added logic to remove the Strike tip from Pandora's box (attempt 2).
- Bonfire Spirits event now works if the only remaining cards are bottled.
- Capitalization fix: Jack Of All Trades -> Jack of All Trades.
- Certain enemies no longer gain extra strength when removing Piercing Wail or Dark Shackles from themselves.
- Electrodynamics' passively triggered Orbs now resolve in the correct order and flash the orbs
- Fixed issue where Bottled icon wasn't showing in card upgrade screens. 
- Fixed issue where Dagger Spray VFX wasn't spawning in the right spot for some resolutions. 
- Fixed issue where Maw enemy was considered elite in the back end.
- Fixed issue where relic outlines were rendered twice in reward screens.
- Fixed issue where seeds stopped working after completing a run until restarting client.
- Fixed several events modifying eventRNG values, causing future events to be inconsistent.
- Fixing some errors with event logging in Run History.
- Gold Shrine was logging an incorrect amount of gold received on A15+ for Run History.
- Grammar: Aside -> Beside for Black Star's flavor text.
- Insanity and Diverse mods now work together.
- Resolution fallback now affects Fullscreen only, allowing higher resolutions for vertical multi-monitor setups.
- Shiny mod and Diverse now work together correctly.
- The Lab event now shows up correctly in the Run History.
### Optimization
- Compressing various over-the-shoulder and character corpse assets.
- Removed various unused assets.
### Localization
- Adding a name to DEU credits.
- Updates for DEU, EPO, FRA, IND, ITA, JPN, KOR, POL, RUS, SPA, ZHS, and ZHT.
- Updating REFERENCES.txt
