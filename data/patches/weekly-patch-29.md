# Weekly Patch 29: TURBO

- **Date**: 2018-06-15
- **Source**: [Steam](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/2842216343261591224)

## Content

Hey again!

This week we worked on polishing and finishing up controller support, bringing in a new game mode: Endless, publishing the soundtrack, special seeds, and a handful of new relics.

### Controller Support
It's out of beta! Currently, support is limited to PS4, Xbox 360, and Xbox One controllers on the PC. To use a controller, just start the game with a controller plugged in.

### Endless Mode (Beta)
We're testing a game mode in the Beta branch: Endless! A lot of changes, bug fixes, and content are still planned so stay tuned!

### Soundtrack
The official soundtrack is finally here! All of these tracks were created by Clark Aboud and the soundtrack contains all songs (plus a few extras) as 320kbps MP3s. If you want to know more, visit the [Soundtrack page!](https://store.steampowered.com/app/877620/Slay_the_Spire__Soundtrack/)

### Special Seeds
Special runs can be played by entering specific seeds! Ever wanted to play a random daily run? Play Slay the Spire in Draft mode? Do you just want to be one with Snecko? Now you can, and more! All of your dreams will come true, yada yada. A special UI and menu will probably be created if this turns out to be high demand.

We added special runs that you can play by entering specific seeds:
- **RAND0MM0DS** or **DAILYM0DS** will let you do new daily-style runs.
- **DRAFT** will activate the draft daily mod.
- **MEGADRAFT** will activate Diverse and Draft daily mods. Letting you draft from every characters' cards.
- **FADEAWAY** activates Night Terrors and Terminal. Can you beat the game before running out of HP?
- **PRAISESNECK0** Will replace your starting relic with Snecko Eye.
- **Y0URET00SL0W** Will activate the Time Dilation daily mod, giving all enemies Slow.
- **STARTERDECK** Will give you Busted Crown and Binary (Meaning enemies drop 0 cards. Can you win with the starter deck??)
- **INCEPTI0N** Start with Unceasing Top _(it's a dream come true!)_
- **MYTRUEFORM** You're a Demon! You're a Wraith! You Echo... echo echo. Start with one of each 'Form' card.
- **1HITW0NDER** Can you beat the game with 1 Max HP? 
### Community Fan Art
Wooow, everyone is so talented. We're really happy to showcase these!
If you want your art showcased, just ping us at [@megacrit!](https://twitter.com/megacrit)


*Amazing print by Jesse Turner [(@jouste)](https://twitter.com/jouste) of Crypt of the NecroDancer fame!*


*The Silent by (https://www.twitch.tv/hiromoru)*


*The Time Eater by [George Eracleous](https://george-eracleous.deviantart.com/)*


*Summer Fun Donu by [@lotsofwoomy](https://twitter.com/lotsofwoomy)*


*A Younger Silent and Ironclad enjoying a Snack Together by [@Amueezy](https://twitter.com/Amueezy)*


*The Defect by [@BaeFeather](https://twitter.com/Baefeather)*

**Patch Notes**

### Hotfix
- Fix issue where daily mode can be treated as an endless run.
- Fixed Snecko Oil description issues on Ascension 11+.
- Run History scrolling now works correctly for Endless Mode.
### Content
- Adding boss relic Coffee Dripper.
- Adding boss relic Empty Cage.
- Adding boss relic Fusion Hammer.
- Adding rare relic Incense Burner.
### Balance
- In the Nest event, you receive the dagger for 6 damage instead of a downgrade now.
- In the Nest event, the non-dagger option steals less gold now (150 -> 99). Ascension 15 -> 50.
### Bug Fixes
- Aggregate now gives the correct amount of energy.
- Fixed instance where audio would overlap with Hexaghost on Save/Quit interactions.
- Fixed issue where Fairy Potion wouldn't heal you if max HP was less than 10.
- Fixed issue where game crashed if Gdx.audio was null.
- Fixed issue where Gremlin Wheel event was not seeded.
- Fixed issue where Input Settings' rows were duplicating when reopened.
- Mind Bloom no longer shows status/curse cards upgrading.
- Ritual Dagger card is marked as seen when you obtain it now.
- Smoke Bombs now work when fighting monsters in ? rooms.
- Some dialog for events was leaking into other events. Now cleared out between events.
- Unceasing Top no longer infinitly spins when you are out of cards (hand/discard/draw pile)
- Reducing a lot of unnecessary saving whenever you see cards/relics.
- Reducing memory usage at certain points.
- Removing unused asset menuPanelPortrait.png
### UI and Effects
- Updated art on Endless mode's panel.
- Updated bg art for Defect in character select screen.
- Attacks that hit all enemies are now properly faster in Fast Mode.
- MindBloom upgrade now only shows up to 20 cards as it's CPU intensive.
- Seeds are now alphanumeric.
- Tips are now rendered on the left side of the screen in Relic Library as the position was inconsistent.
- ToughBandages relics now uses its effect faster (0.35s -> 0.2s).
- Viewing potions during Discard/Draw Pile view no longer scrolls oddly.
- Fix grammar issue in Sensory Stone event.
- Less vs Fewer for Potion Slots relic.
- Pick up -> pickup wording change for several relics.
### Localization
- SRB and SRP no longer render ordinals for floor numbers.
- Updates for DEU, FRA, GRE, ITA, JPN, KOR, RUS, SRB, SRP, ZHS, ZHT.
