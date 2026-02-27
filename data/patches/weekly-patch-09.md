# Weekly Patch 9: Ascension

- **Date**: 2018-01-25
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2356940714982936728)

## Content

It's patch day!

We fixed the leaderboards, they upload again!
Also, the leaderboards have been reset.

We heard that some of our players wanted an additional challenge so we've devised an experimental game mode for you! For those just starting Slay the Spire, we don't want to spoil the fun so we're putting it in a spoiler block. You have been warned!

### Hotfixes
- Ascension Mode should unlock properly now. Sorry about that! (Exit Steam and Relaunch to force an update!)
- Pushed fixes for several odd crashes that prevented the game from loading for a few users.
### Ascension Mode

This mode can be accessed by defeating all of the Act 3 bosses.
Afterwards, Ascension Mode will be available in the character select screen after choosing a character.

Each Ascension run will get harder as you emerge victorious.
But beware, each victory will add another layer of difficulty...
Currently, there are 10 Ascension Levels to fight through!

Ascension mode does NOT affect winstreaks but wins/losses and leaderboards are still utilized. Each level of Ascension grants a 5% score bonus.


### More Languages
Our awesome community has generously provided us with more translations!
Keep in mind that Slay the Spire continuously receives updates so translations may be behind or missing in some areas. They are continuously being updated and you can even lend a hand at our [Official Discord channel.](https://discord.gg/slaythespire)
- Italian is now available! Meraviglioso!
- Chinese (Simplified) is updated + Localized Achievements.
- Chinese (Traditional) is updated + Localized Achievements.
- French is updated + Localized Achievements.
- German is updated + Localized Achievements.
- Japanese is updated + Localized Achievements.
- Korean is updated + Localized Achievements + New font!
- Russian is updated + Localized Achievements.
### 32-bits
We're pushing out 32-bit builds today!
There have been some rockiness here (beta builds somehow affecting main branch), but we're doing our best to resolve these issues as soon as we can.

**Patch Notes**

### Gameplay
- Cheater score penalty reduced as it's there for informational purposes, not fun ruining.
- Nightmare no longer retains "cost for turn" when copying cards (as you get the copies next turn).
- Playtime is now calculated incrementally rather than end time - start time (unaffected by system clock).
- Sentry HP ranges updated to be wider (36 - 40) -> (35 - 41).
- The Collector respawns its minions considerably less often when certain criteria is met: (100% -> 25%)
### UI and Effects
- If an anti-virus prevents the creation of a .copy file, the game will no longer crash.
- Improved card trail VFX to be more performant.
- Leaderboards Screen: No longer show the left arrow if filtered to friends with less than 20 friends.
- Mind Blast now shows you how much damage it will deal on the card itself.
- Updating description for Curl Up power to clarify it only triggers once.
- When saving sound settings, it is saved when you release the mouse now.
- You can now view your current run's playtime by opening the map.
### Bug Fixes
- Accuracy wasn't working with Shiv+
- Achievement descriptions for non-hidden achievements now properly show how they're obtained.
- All files when saved now create backups. If a corrupt file is detected, they are now restored.
- Character info text in char select is now <- 200px to hide the flavor text for some languages.
- Cheater score penalty reduced. The bonus was meant to be informational, not a fun ruiner.
- Fixed bug where Centennial Puzzle doesn't trigger off of enemy thorns.
- Fixed interaction of Enlightenment + Eviscerate + Discard.
- Fixed issue where leaderboard scores weren't uploading properly.
- Fixed issue where Orichalcum will start flashing even if you have Block from Barricade/Blur/Calipers.
- Now preventing crashes when an audio file is not found. (how did this even happen?)
- Sadistic Nature no longer triggers twice from Shackles and Piercing Wail.
