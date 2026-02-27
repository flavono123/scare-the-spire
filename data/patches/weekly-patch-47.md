# Weekly Patch 47: Metamorphosis

- **Date**: 2018-10-25
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2403127338430504919)

## Content

Greetings,

This week's focus was on prepping the final content for next week, visual updates, and bug fixes.

### Final Content?! (BETA)
It's coming to the beta branch on Monday! (October 29). We won't be giving out too much details in order to prevent spoilers. However, localization for this content will be available 1 or 2 days prior.

For information on the beta branch, [click here!](https://steamcommunity.com/games/646570/announcements/detail/1462971926900801868) Keep in mind that save files must be transferred manually if you switch to the beta branch. This is to prevent save file incompatibilities.

### Visual Updates

We're incorporating more visual effects!

### Community Fan Art

*Fat Gremlin and Ice Cream by [by Katie Daniel](https://www.instagram.com/katjdaniel/)*


*This amazing Donu patch by [/u/JonChinaMan](https://www.reddit.com/user/JonChinaMan)*


*Deca & Donu by [昂拉克](https://www.pixiv.net/member.php?id=24166488)*

**Patch Notes**

### Hotfixes
- Fixed issue where incorrect RNG was utilized to create reward cards.
- Fixed issue where daily scores weren't uploading.
### Balance
- Council of Ghosts event now only gives 3 Apparition on Ascension 15+.
- Prismatic Shard now sets your max orbs to 1 only if you have 0 max orbs and you aren't the Defect.
- Smiling Mask relic will no longer spawn on Hoarder daily mod.
- Standard Runs with set seeds now always give you Neow's Blessing.
- Wing Boots relic will no longer spawn on Certain Future daily mod.
### UI and Effects
- Adding a hit react animation for the Ironclad.
- Adding an updated idle animation for the Ironclad.
- Adding VFX for Blizzard Card (scales with Frost channeled).
- Ironclad's combat sprite updated (more color and contrast).
- Updating VFX for Searing Blow card (now scales with upgrade count).
- Adding 0.1s animation blend between Hit and Idle animations for Ironclad, Silent, and Defect. 
- Closing out of a Card Reward screen using controller will now reset your selection position for combat reward screens, hand position, etc.
- Custom mods no longer have overlapping hitboxes, this allowed the player to select two at once.
- Evoking Orbs is now 0.15s faster per orb in Fast Mode.
- The Silent's idle animation speed is slowed by 10%.
- Updated description for Preserved Insect for clarity.
### Bug Fixes
- Adding more information to bottled card saves to prevent incorrect card being bottled when loading a save.
- Defect and The Silent unlocks now reuse existing character instances.
- Fix for a scenario which upgrading cards affected by Snecko Eye would sometimes give negative cost cards.
- Fixed a memory leak whenever player returned to the main menu.
- Fixed bug where playing Mayhem card would alter your card rewards.
- Fixed issue where displayed seed value was calculated every frame.
- Fixed issue where Neow did not give anything to players who first encountered her.
- Fixed issue where seeded runs allowed ascension unlocks and uploading to leaderboards.
- Fixed issue where The Specimen's Poison transfer failed if the target died before the transfer.
- Fixed issue where True Grit card was not behaving correctly with seeded runs.
- Fixing issues with Writhing Mass displaying the incorrect intent on turn 1.
- Game now handles monitor resolution changes more gracefully.
- Mind Bloom event combat now correctly gives appropriate gold for the battle.
- Poison transfer target for The Specimen is now seeded random. 
- Random Curse generating effects were marking the wrong curse as seen in the card library.
- Reboot and Deep Breath cards no longer trigger shuffle-based relics twice.
- Relics with counters like Pen Nib and Girya no longer display the counter offset incorrectly when the player has too many relics.
- Thank you message in the credits was appearing at the wrong time.
- The discard pile will no longer incorrectly shuffle into the draw pile when having a full hand prevents all of the card draw.
- Typo fixed in Colossus mod's name (extra space)
- Typo fixed in We Meet Again event.
- Updated energy orb rendering logic on cards to scale properly for high res monitors.
- Vintage modifier now correctly drops cards on bosses.
### Optimization
- Fusion card works better for modders now
- Removed rendundant dungeon scene foreground rendering.
### Localization
- Updates for DEU, EPO, ITA, KOR, POL, RUS, SPA, TUR, ZHS, and ZHT.
