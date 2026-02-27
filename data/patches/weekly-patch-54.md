# Weekly Patch 54: Loop

- **Date**: 2019-01-04
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2417770561712455827)

## Content

Happy New Year!

This week's patch brings Steam Workshop support, bug fixes, and a few touch-ups here and there.

### Steam Workshop
Utilizing and keeping up-to-date with community-made mods are now easier as we're enabling Steam Workshop support today.

Have you wanted more cards, relics, characters? Many hardworking players have been modding Slay the Spire for quite a while and they can now be easily accessed through the workshop. [Check them out here!](https://steamcommunity.com/workshop/browse/?appid=646570&browsesort=trend&section=readytouseitems)

Browse the Workshop page, subscribe to some mods, and upon launching the game, choose the "Play with Mods" option.

*Now you are a professional mod user*

For support and info on installation, bug reporting, or creating mods, join the modding community at our [Official Discord channel](https://discord.gg/slaythespire) at #modding. We want to play your mods!

### Community Fan Art
Some excellent renditions to kick off the year


*The Ironclad by (https://www.instagram.com/nathanj/)*


*The Silent by [u/khazan0](https://www.reddit.com/user/khazan0)*


*The Defect by [@Nicxan](https://twitter.com/nicxanbrooks)*

**Patch Notes**

### Hotfixes
- Fix for Card Reward screens sometimes not dismissing, causing duplicate card selection issues.
### Gameplay and Balance
- A Note For Yourself event is now available if you aren't playing your highest ascension AND the ascension level is 14 or less.
- If you have unlocked The Ending achievement, you can now enable the final act in custom mode.
- Stone Calendar relic damage buffed 40 -> 50.
- The Specialized Daily Mod now allows Alchemize (was restricted because the mod Brewmaster used to exist)
### UI and Effects
- Improved controller navigation of Rest Site options when there are 5 options.
- Recall option now appears in Run History screens when hovering a rest site room node.
- Removed flame VFX that appeared when Reptomancer was defeated.
- Smiling Mask relic stops flashing if Card Removal Service has been utilized.
- The Input Settings menu button now utilizes a different image.
- The Standard play menu button now utilizes a different image.
- Updated relic asset for Blood Vial.
- Credits updated and improved timing for the Thanks for Playing message.
### Bug Fixes
- Adding a check for a Cancel button (Safer for Modders!)
- Adding a check for a potential game exit crash instead of returning to menu.
- Adding logic so Beyond elites score increments more accurately in case of future/custom Acts.
- Blight rolling now increments relic rng seeds correctly (consistency on save/load)
- Fix Run History corruption due to save/load (again). 
- Fixed card randomization inconsistencies caused by save/load.
- Fixed events which sometimes rerolled when loading a save after an event-based combat.
- Fixed instances where certain screens could be opened while on that screen, causing visual issues. 
- Fixed issue where a non-dismissable Map could be dismissed by navigating menus in a specific order.
- Fixed issue where Blood Potion wouldn't heal the player if used immediately after combat.
- Fixed issue where City and Beyond Elites killed score bonuses weren't showing up if you won/lost in The Ending.
- Fixed issue where Entropic Brew did not give players potions if used post-combat.
- Fixed issue where opening deck/map/settings and returning would enable cancelling out of certain screens (like choosing cards for bottles).
- Fixed issue where opening deck/map/settings during Card Removal Service caused the card to not remove unless you access the shop again.
- Fixed issue where potion seeds weren't persistent on save/load.
- Fixed issue where Toy Ornithopter relic wouldn't trigger outside of combat.
- Fixed issues where navigating from screen -> map/deck -> settings would dismiss some screens such as Sealed Deck.
- Fixed issues where some monsters dealt the incorrect damage with Philosopher's Stone on turn 1.
- Note For Yourself event no longer crashes with modded cards.
- Opening Settings during Draft mod now properly hides the top banner.
- Potential fix for Prismatic Shard returning duplicate cards on rare occasions.
- Prevent Run History corruption when loading saves in Event rooms.
- The Specialized Mod now gives you 5 of a random card and works with mods Draft and Sealed Deck.
- Tingsha, Sword Boomerang, Bouncing Flask, Rip and Tear, Thunder Orbs, Havoc, and Juggernaut now utilize seeded enemy target randomization.
### Performance
- Reduced some unnecessary saving when encountering bosses.
### Localization
- Adding shop assets for EPO.
- Updates for EPO, DEU, DUT, EPO, FRA, ITA, KOR, SPA, UKR, ZHS, ZHT.
