# Weekly Patch 7: Setting Up All the Things

- **Date**: 2018-01-12
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2747626897932945296)

## Content

Hey everyone, it's patch day again!

This patch brings a lot of back end changes for stability and future content.
While not too exciting on the content side, this is necessary to ensure quality and flexibility.

Slay the Spire is getting more and more popular! For all you new players, welcome! For all of you previous players, we would sincerely like to thank you for spreading the word. Thank you! It means a lot that you enjoy our game and spread the ~~agony of defeat~~ accomplished feeling of victory!

### Back End Changes!?
Yes, lots of exciting things are happening behind the scenes. Progress continues for the enigmatic 3rd character and leaderboards are coming soon(tm). Those in the beta branch have been a great help and we hope that we can feed your competitive needs in the next week.

### Save Migration
When you run this week's build, your save data will be copied from the original directory (.prefs) to the new directory found in the game directory in a new "preferences" folder (betaPreferences for beta). Yes, this will diverge beta and non-beta save data.

This solves anti-virus false positives, full disk errors, and allows us to utilize Steam Auto-Cloud.

### Steam Auto-Cloud
Your saves are now synced between computers! Please be careful not to overwrite your main save. If this occurs, the data is recoverable- there will be extra steps posted in the Bugs & Crashes FAQ in the Steam Discussions.

### Localization
This weekly patch brings BETA-level localization for Korean.
Here's a quick refresher on how to change your language!



We're still looking for community translators! Any and all help for translations are greatly appreciated. Just stop by the official [Slay the Spire Discord's localization channel.](https://discord.gg/SlayTheSpire) 

### HOTFIX
- The way writing files were written had a potential to corrupt the file if you quit while files were being written. Files are now written in a safer way (buffer + flush)
- The Awakened One actually heals to full HP now.
### Balance
- The Awakened One gets many changes (spoilers blocked):
- > HP is increased from 300 -> 320.
- > Curiosity is nerfed from 3 -> 2
- > Form 2 HP 200 -> 240
- > Form 2 no longer cleanses buffs (Strength is retained)
- > Form 2: Dark Echo 40 -> 32
- > Form 2: 12 x 2 attack is now 10 x 2 attack
- > Form 2: 16 damage attack is now 12 damage
- > Form 2: Cleanse move is removed
- Bronze Automaton's Hyper Beam damage is increased from 40 -> 45.
- Feed no longer works on Minions (New Power: Minion to let you know who are minions).
- Golden Idol Event options are slightly harsher. 20% -> 25% damage and 5% -> 8% Max HP loss.
- Maximum gold score bonus now caps at 300 (was unlimited).
- Exhume card can no longer return an Exhume card to your hand.
- You can no longer get both a curse and card removal in the same Neow Risk/Reward option.
- Sentry enemy now gives you 2x Dazed instead of Wounds.
- Sentry enemy's max HP is raised by 2 (to compensate).
### UI and Effects
- Localization: Several updates to CN (Simplified), French, German, Japanese, Korean, and Russian.
- Adding Win Streak and High Score into Statistics screen.
- Hex Power wording improvements.
- Energized Power wording improvements.
- Intangible Power wording improvements.
- Enchiridion relic wording improvements.
### Bug Fixes
- Adding a used up image for Neow's Lament.
- Blue Candle and Medical Kit should now work with Choke and Thousand Cuts.
- Cloak and Dagger no longer appears in the card match event before it is unlocked, instead there is always a copy of Neutralize.
- Energy back end is overhauled. If you notice any new issues related to Energy, please let us know!
- Falling event can no longer target bottled cards.
- Fixed issue where bottled cards + Duplication event caused issues.
- Fixed issues where loading a save after receiving a relic from Neow wouldn't retain +Energy or +Card Draw effects.
- Fixed typo in Transmutation card description.
- Fixing typo for Donu & Deca achievement description.
- Fixing typo in Matryoshka's flavor text.
- Slaver and Shelled Parasite combat in the city have their order swapped so the slaver will not apply Vulnerable before attacked by Parasite.
- The You Are Nothing achievement can be achieved on The Awakened One now.
[Discuss the latest patch notes here.](http://steamcommunity.com/app/646570/discussions/3/3277925755432574726/)
