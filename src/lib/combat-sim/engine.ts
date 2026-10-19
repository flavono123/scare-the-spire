/**
 * Minimal deterministic combat engine for the dev-only combat simulator.
 *
 * Rules follow the archived build source (`~/sts2-builds/<version>/src`):
 * - Card play (`PlayCardAction` -> `CardModel.SpendResources` -> `OnPlayWrapper`,
 *   order from the state machine's await numbering): pay energy, move hand ->
 *   play (AddDuringManualCardPlay), then per play: BeforeCardPlayed, card OnPlay,
 *   enchantment OnPlay, affliction OnPlay, AfterCardPlayed; then
 *   CustomScaledWait(0.15 - elapsed, 0.3 - elapsed) and the result pile
 *   (Power: removed, Exhaust keyword: exhaust, otherwise discard). The
 *   CustomScaledWait(0.25, 0.35) in OnPlayWrapper is on the auto-play path only.
 * - Animations: attacks trigger "Attack" inside DamageCmd.Attack with the
 *   attacker's delay; skills trigger no animation unless the card says so.
 * - Waits are `pause` events with the game's (fast, normal) values, so the
 *   timeline can follow the speed setting without changing any state.
 * - `CardModel.CanPlay`: Unplayable keyword or not enough energy blocks the play.
 * - `CardPileCmd.Draw`: one card at a time from the top of the draw pile while the
 *   hand has fewer than 10 cards; an empty draw pile reshuffles the discard pile.
 * - `PlayerCombatState.LoseEnergy`: clamps at 0.
 *
 * Same input and catalog always give the same steps. Shuffles use a seeded RNG,
 * not the game's `Rng.Shuffle`, so a reshuffled order is not the game's order.
 */

import { CARD_RECIPES, resolveCount, type CardOp } from "./card-effects";
import { AFFLICTION_HOOKS, POWER_HOOKS, type HookContext } from "./hooks";
import { nextRandom, seedRandom } from "./rng";
import type {
  CardSpec,
  CombatSimInput,
  ScenePart,
  PileType,
  PowerSpec,
  SimAction,
  SimCard,
  SimCardDef,
  SimCatalog,
  SimCreature,
  SimEvent,
  SimKeyword,
  SimMonster,
  SimResult,
  SimState,
  SimStep,
} from "./types";
import { PILE_TYPES, SCENE_PARTS } from "./types";

export const MAX_HAND_SIZE = 10;
const TURN_DRAW = 5;

export function parseCardSpec(spec: CardSpec): { id: string; upgraded: boolean; count: number } {
  const match = spec.trim().match(/^([A-Za-z0-9_]+)(\+?)(?:\*(\d+))?$/);
  if (!match) throw new Error(`card must look like ID, ID+ or ID*N: ${spec}`);
  return { id: match[1].toUpperCase(), upgraded: match[2] === "+", count: match[3] ? Number(match[3]) : 1 };
}

export function expandCardSpecs(specs: CardSpec[] | undefined): { id: string; upgraded: boolean }[] {
  return (specs ?? []).flatMap((spec) => {
    const { id, upgraded, count } = parseCardSpec(spec);
    return Array.from({ length: count }, () => ({ id, upgraded }));
  });
}

export function parsePowerSpec(spec: PowerSpec): { id: string; amount: number } {
  if (typeof spec !== "string") return { id: spec.id.toUpperCase(), amount: spec.amount ?? 1 };
  const [id, amount] = spec.split(":");
  return { id: id.trim().toUpperCase(), amount: amount === undefined ? 1 : Number(amount) };
}

/** Scene parts the input asks for: `parts`, or both with a character and none without. */
export function sceneParts(input: CombatSimInput): ScenePart[] {
  const parts = input.parts ?? (input.character ? [...SCENE_PARTS] : []);
  return SCENE_PARTS.filter((part) => parts.includes(part));
}

export function hasPart(input: CombatSimInput, part: ScenePart): boolean {
  return sceneParts(input).includes(part);
}

/** Every card id the input can put into combat (none without the `cards` part). */
export function inputCardIds(input: CombatSimInput): string[] {
  if (!hasPart(input, "cards")) return [];
  const ids = new Set<string>();
  for (const pile of [input.hand, input.drawPile, input.discardPile, input.exhaustPile]) {
    for (const card of expandCardSpecs(pile)) ids.add(card.id);
  }
  for (const action of input.script ?? []) {
    if (action.do === "play" || action.do === "addCard") ids.add(parseCardSpec(action.card).id);
  }
  return [...ids];
}

const KEYWORD_UPGRADES: Record<string, SimKeyword> = {
  exhaust: "Exhaust",
  ethereal: "Ethereal",
  retain: "Retain",
  innate: "Innate",
  unplayable: "Unplayable",
};

export interface EffectiveCard {
  def: SimCardDef;
  cost: number;
  vars: Record<string, number>;
  keywords: SimKeyword[];
}

/** Cost, vars and keywords after the site upgrade map (`{"cards": "+1"}`, `{"cost": "0"}`). */
export function effectiveCard(def: SimCardDef, upgraded: boolean): EffectiveCard {
  const vars = { ...def.vars };
  let cost = def.cost;
  const keywords = new Set(def.keywords);
  if (upgraded && def.upgrade) {
    for (const [key, raw] of Object.entries(def.upgrade)) {
      const lower = key.toLowerCase();
      if (lower === "cost") {
        cost = Number(raw);
        continue;
      }
      const keywordChange = lower.match(/^(add|remove)_(.+)$/);
      if (keywordChange) {
        const keyword = KEYWORD_UPGRADES[keywordChange[2]];
        if (keyword) {
          if (keywordChange[1] === "add") keywords.add(keyword);
          else keywords.delete(keyword);
        }
        continue;
      }
      const varName = Object.keys(vars).find((name) => name.toLowerCase() === lower);
      if (!varName) continue;
      const text = String(raw);
      vars[varName] = /^[+-]/.test(text) ? vars[varName] + Number(text) : Number(text);
    }
  }
  return { def, cost, vars, keywords: [...keywords] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class Combat {
  readonly steps: SimStep[] = [];
  readonly warnings: string[] = [];
  state: SimState;
  action = -1;

  constructor(
    readonly input: CombatSimInput,
    readonly catalog: SimCatalog,
  ) {
    this.state = this.buildInitialState();
  }

  private buildInitialState(): SimState {
    const { catalog, input } = this;
    const cards: Record<string, SimCard> = {};
    const piles = Object.fromEntries(PILE_TYPES.map((pile) => [pile, [] as string[]])) as Record<PileType, string[]>;
    const add = (pile: PileType, specs: CardSpec[] | undefined) => {
      expandCardSpecs(specs).forEach((card, index) => {
        const uid = `${pile}-${index}`;
        if (!catalog.cards[card.id]) this.warnings.push(`카드 데이터 없음: ${card.id}`);
        cards[uid] = { uid, id: card.id, upgraded: card.upgraded, affliction: null };
        piles[pile].push(uid);
      });
    };
    const withCards = hasPart(input, "cards");
    if (withCards) {
      add("hand", input.hand);
      add("draw", input.drawPile);
      add("discard", input.discardPile);
      add("exhaust", input.exhaustPile);
      if (piles.hand.length > MAX_HAND_SIZE) this.warnings.push(`손 카드가 ${MAX_HAND_SIZE}장을 넘습니다`);
    } else if ([input.hand, input.drawPile, input.discardPile, input.exhaustPile].some((pile) => pile?.length)) {
      this.warnings.push("cards 파트가 꺼져 있어 카드 더미 입력을 무시합니다");
    }

    // Without a character the player still exists for the rules (monster attacks), but has no stats.
    const character = catalog.character;
    const hp = character ? input.hp ?? character.hp : 0;
    const player: SimCreature = { key: "player", id: character?.id ?? "NONE", hp, maxHp: character?.hp ?? 0, block: 0, powers: [] };
    const monsters: SimMonster[] = catalog.encounter.monsters.map(({ monsterId, slot }, index) => {
      const def = catalog.monsters[monsterId];
      if (!def) this.warnings.push(`몬스터 데이터 없음: ${monsterId}`);
      const moveId = this.lookup(input.moves, monsterId, index) ?? def?.initialMove ?? null;
      if (moveId && def && !def.moves[moveId]) this.warnings.push(`${monsterId}에 ${moveId} 행동이 없습니다`);
      const maxHp = def?.hp ?? 1;
      return { key: `m${index}`, id: monsterId, hp: maxHp, maxHp, block: 0, powers: [], slot, moveId };
    });

    const maxEnergy = withCards ? input.maxEnergy ?? character?.maxEnergy ?? 0 : 0;
    return {
      turn: 1,
      energy: withCards ? input.energy ?? maxEnergy : 0,
      maxEnergy,
      piles,
      cards,
      player,
      monsters,
      rng: seedRandom(input.seed ?? 1),
    };
  }

  private lookup<T>(map: Record<string, T> | undefined, monsterId: string, index: number): T | undefined {
    if (!map) return undefined;
    return map[String(index)] ?? map[`m${index}`] ?? map[monsterId] ?? map[monsterId.toLowerCase()];
  }

  emit(event: SimEvent) {
    this.steps.push({ action: this.action, event, state: clone(this.state) });
  }

  creature(key: string): SimCreature | null {
    if (key === "player") return this.state.player;
    return this.state.monsters.find((monster) => monster.key === key) ?? null;
  }

  creatures(): SimCreature[] {
    return [this.state.player, ...this.state.monsters];
  }

  pileOf(uid: string): PileType | null {
    return PILE_TYPES.find((pile) => this.state.piles[pile].includes(uid)) ?? null;
  }

  moveCard(uid: string, to: PileType, cause: Extract<SimEvent, { kind: "move" }>["cause"], position: "top" | "bottom" = "bottom", awaited = false) {
    const from = this.pileOf(uid);
    if (!from) return;
    this.state.piles[from] = this.state.piles[from].filter((id) => id !== uid);
    if (position === "top") this.state.piles[to].unshift(uid);
    else this.state.piles[to].push(uid);
    this.emit(awaited ? { kind: "move", uid, from, to, cause, awaited } : { kind: "move", uid, from, to, cause });
  }

  removeCard(uid: string) {
    const from = this.pileOf(uid);
    if (!from) return;
    this.state.piles[from] = this.state.piles[from].filter((id) => id !== uid);
    this.emit({ kind: "remove", uid, from });
  }

  readonly hooks: HookContext = {
    allCards: () => PILE_TYPES.flatMap((pile) => this.state.piles[pile]).map((uid) => this.state.cards[uid]),
    afflict: (card, afflictionId, amount, sourceId) => {
      this.state.cards[card.uid].affliction = { id: afflictionId, amount };
      this.emit({ kind: "afflict", uid: card.uid, afflictionId, amount, sourceId });
    },
    clearAffliction: (card) => {
      const current = this.state.cards[card.uid].affliction;
      if (!current) return;
      this.state.cards[card.uid].affliction = null;
      this.emit({ kind: "clearAffliction", uid: card.uid, afflictionId: current.id });
    },
    loseEnergy: (amount, cause, sourceId, uid) => {
      if (amount <= 0) return;
      const from = this.state.energy;
      this.state.energy = Math.max(0, from - amount);
      this.emit({ kind: "energy", from, to: this.state.energy, cause, sourceId, uid });
    },
  };

  private checkVersion(id: string, checkedVersions: string[]) {
    const version = this.catalog.version.replace(/^v/, "");
    const note = `${id} 규칙은 ${checkedVersions[0]}–${checkedVersions.at(-1)} 소스로만 확인했습니다 (v${version})`;
    if (!checkedVersions.includes(version) && !this.warnings.includes(note)) this.warnings.push(note);
  }

  /** Run a hook on every power of every creature, in creature order. */
  private eachPower(run: (owner: SimCreature, power: { id: string; amount: number }) => void) {
    for (const owner of this.creatures()) {
      for (const power of [...owner.powers]) run(owner, power);
    }
  }

  applyPower(owner: SimCreature, spec: { id: string; amount: number }) {
    const existing = owner.powers.find((power) => power.id === spec.id);
    if (existing) existing.amount += spec.amount;
    else owner.powers.push({ ...spec });
    this.emit({ kind: "power", creature: owner.key, powerId: spec.id, amount: spec.amount, change: "applied" });
    // PowerCmd.Apply: CustomScaledWait(0.1, 0.25); powers present at setup are already in place.
    if (this.action >= 0) this.emit({ kind: "pause", reason: "power", fastMs: 100, normalMs: 250 });
    const hooks = POWER_HOOKS[spec.id];
    if (!hooks) {
      if (!this.catalog.powers[spec.id]) this.warnings.push(`파워 데이터 없음: ${spec.id}`);
      return;
    }
    this.checkVersion(spec.id, hooks.checkedVersions);
    hooks.afterApplied?.(this.hooks, owner, owner.powers.find((power) => power.id === spec.id)!);
  }

  setup() {
    const powers = this.input.powers ?? {};
    for (const [key, specs] of Object.entries(powers)) {
      const owner = key === "player"
        ? this.state.player
        : this.state.monsters.find((monster, index) =>
          key === String(index) || key === `m${index}` || key.toUpperCase() === monster.id);
      if (!owner) {
        this.warnings.push(`파워 대상 없음: ${key}`);
        continue;
      }
      for (const spec of specs) this.applyPower(owner, parsePowerSpec(spec));
    }
  }

  run(): SimResult {
    const initial = clone(this.state);
    this.setup();
    const start = clone(this.state);
    (this.input.script ?? []).forEach((action, index) => {
      this.action = index;
      this.runAction(action);
    });
    return { initial, start, steps: this.steps, final: clone(this.state), warnings: this.warnings };
  }

  private runAction(action: SimAction) {
    const cardAction = action.do === "play" || action.do === "endTurn" || action.do === "startTurn" || action.do === "addCard";
    if (cardAction && !hasPart(this.input, "cards")) {
      this.emit({ kind: "rejected", reason: `cards 파트가 꺼져 있어 ${action.do}를 건너뜁니다` });
      return;
    }
    switch (action.do) {
      case "play":
        this.playCard(action);
        return;
      case "endTurn":
        this.endTurn();
        return;
      case "monsterTurn":
        this.monsterTurn();
        return;
      case "startTurn":
        this.startTurn();
        return;
      case "wait":
        this.emit({ kind: "wait", ms: Math.max(0, action.ms) });
        return;
      case "addCard":
        this.addCard(action.card, action.pile ?? "hand");
        return;
      default: {
        const unknown: never = action;
        this.emit({ kind: "rejected", reason: `알 수 없는 액션: ${JSON.stringify(unknown)}` });
      }
    }
  }

  private addCard(spec: CardSpec, pile: PileType) {
    for (const { id, upgraded } of expandCardSpecs([spec])) {
      if (!this.catalog.cards[id]) this.warnings.push(`카드 데이터 없음: ${id}`);
      const uid = `added-${Object.keys(this.state.cards).filter((key) => key.startsWith("added-")).length}`;
      const card: SimCard = { uid, id, upgraded, affliction: null };
      this.state.cards[uid] = card;
      // A full hand sends the card to the discard pile (CardPileCmd.Add).
      const to = pile === "hand" && this.state.piles.hand.length >= MAX_HAND_SIZE ? "discard" : pile;
      this.state.piles[to].push(uid);
      this.emit({ kind: "enter", uid, to });
      this.eachPower((owner, power) => POWER_HOOKS[power.id]?.afterCardEnteredCombat?.(this.hooks, owner, power, this.state.cards[uid]));
    }
  }

  private findInHand(spec: string, index?: number): string | null {
    const hand = this.state.piles.hand;
    if (index !== undefined) return hand[index] ?? null;
    const { id, upgraded } = parseCardSpec(spec);
    return hand.find((uid) => this.state.cards[uid].id === id && this.state.cards[uid].upgraded === upgraded) ?? null;
  }

  private effective(uid: string): EffectiveCard | null {
    const card = this.state.cards[uid];
    const def = this.catalog.cards[card.id];
    return def ? effectiveCard(def, card.upgraded) : null;
  }

  private resolveTarget(target: string | number | undefined): SimMonster | null {
    const alive = this.state.monsters.filter((monster) => monster.hp > 0);
    if (target === undefined) return alive[0] ?? null;
    if (typeof target === "number" || /^\d+$/.test(target)) return this.state.monsters[Number(target)] ?? null;
    return this.state.monsters.find((monster) => monster.key === target || monster.id === target.toUpperCase()) ?? null;
  }

  private playCard(action: Extract<SimAction, { do: "play" }>) {
    const uid = this.findInHand(action.card, action.index);
    if (!uid) {
      this.emit({ kind: "rejected", reason: `손에 ${action.card} 없음` });
      return;
    }
    const card = this.effective(uid);
    if (!card) {
      this.emit({ kind: "rejected", reason: `카드 데이터 없음: ${this.state.cards[uid].id}` });
      return;
    }
    // CardModel.CanPlay
    if (card.keywords.includes("Unplayable")) {
      this.emit({ kind: "rejected", reason: `${card.def.name}: 사용불가` });
      return;
    }
    const energyToSpend = card.def.isXCost ? this.state.energy : Math.max(0, card.cost);
    if (energyToSpend > this.state.energy) {
      this.emit({ kind: "rejected", reason: `${card.def.name}: 에너지 부족 (${this.state.energy}/${energyToSpend})` });
      return;
    }
    const target = card.def.target === "AnyEnemy" ? this.resolveTarget(action.target) : null;
    if (card.def.target === "AnyEnemy" && !target) {
      this.emit({ kind: "rejected", reason: `${card.def.name}: 대상 없음` });
      return;
    }

    this.emit({ kind: "select", uid });
    // PlayCardAction: SpendResources, then OnPlayWrapper.
    if (energyToSpend > 0) {
      const from = this.state.energy;
      this.state.energy -= energyToSpend;
      this.emit({ kind: "energy", from, to: this.state.energy, cause: "cost", uid });
    }
    // AddDuringManualCardPlay awaits the play-pile tween only for Power cards.
    this.moveCard(uid, "play", "play", "bottom", card.def.type === "Power");
    const playMove = this.steps.length - 1;

    const resultPile: PileType | null = card.def.type === "Power"
      ? null
      : card.keywords.includes("Exhaust") ? "exhaust" : "discard";

    this.eachPower((owner, power) => POWER_HOOKS[power.id]?.beforeCardPlayed?.(this.hooks, owner, power, this.state.cards[uid]));
    const recipe = CARD_RECIPES[card.def.id];
    if (!recipe) {
      this.emit({ kind: "unimplemented", what: `${card.def.name} 효과` });
    } else {
      for (const op of recipe.ops) this.runOp(op, card, uid, target, action.choose);
    }
    // Enchantments are not simulated; the affliction runs after them, still inside the play.
    const affliction = this.state.cards[uid].affliction;
    if (affliction) {
      this.emit({ kind: "afflictionTrigger", uid, afflictionId: affliction.id, amount: affliction.amount });
      const hooks = AFFLICTION_HOOKS[affliction.id];
      if (hooks?.onPlay) {
        this.checkVersion(affliction.id, hooks.checkedVersions);
        hooks.onPlay(this.hooks, this.state.cards[uid], affliction.amount);
      } else {
        this.emit({ kind: "unimplemented", what: `${affliction.id} OnPlay` });
      }
    }
    this.eachPower((owner, power) => POWER_HOOKS[power.id]?.afterCardPlayed?.(this.hooks, owner, power, this.state.cards[uid]));
    // OnPlayWrapper: CustomScaledWait(0.15 - elapsed, 0.3 - elapsed), elapsed since the card reached the play pile.
    this.emit({ kind: "pause", reason: "play", fastMs: 150, normalMs: 300, sincePlayMove: playMove });

    if (this.pileOf(uid) === "play") {
      if (resultPile) this.moveCard(uid, resultPile, resultPile === "exhaust" ? "exhaust" : "result");
      else this.removeCard(uid);
    }
  }

  private runOp(op: CardOp, card: EffectiveCard, uid: string, target: SimMonster | null, choose: CardSpec[] | undefined) {
    switch (op.op) {
      case "damage": {
        const amount = Math.max(0, Math.trunc(card.vars[op.var] ?? 0));
        const targets = op.target === "allEnemies"
          ? this.state.monsters.filter((monster) => monster.hp > 0)
          : target ? [target] : [];
        this.noteDamageModifiers(this.state.player, targets);
        // AttackCommand.FromCard: TriggerAnim("Attack", Character.AttackAnimDelay), then CreatureCmd.Damage.
        const delayMs = (this.catalog.character?.attackAnimDelay ?? 0) * 1000;
        this.emit({ kind: "animate", creature: "player", animation: "attack", delayMs, ...(op.normalAnimExtra ? { normalExtraMs: op.normalAnimExtra * 1000 } : {}) });
        for (const monster of targets) this.dealDamage(monster, amount, uid);
        this.emit({ kind: "pause", reason: "damage", fastMs: 100, normalMs: 200 });
        return;
      }
      case "block": {
        const amount = Math.max(0, Math.trunc(card.vars[op.var] ?? 0));
        if (this.state.player.powers.some((power) => power.id === "DEXTERITY_POWER" || power.id === "FRAIL_POWER")) {
          this.emit({ kind: "unimplemented", what: "방어도 수정자(민첩/손상)" });
        }
        this.state.player.block += amount;
        this.emit({ kind: "block", creature: "player", amount, total: this.state.player.block });
        // CreatureCmd.GainBlock: CustomScaledWait(0.1, 0.25).
        if (amount > 0) this.emit({ kind: "pause", reason: "block", fastMs: 100, normalMs: 250 });
        return;
      }
      case "draw":
        this.draw(resolveCount(op.count, card.vars));
        return;
      case "discardChoice":
        this.discardChoice(resolveCount(op.count, card.vars), choose);
        return;
      case "unimplemented":
        this.emit({ kind: "unimplemented", what: `${card.def.name}: ${op.what}` });
        return;
    }
  }

  private noteDamageModifiers(attacker: SimCreature, targets: SimCreature[]) {
    const modifiers = ["STRENGTH_POWER", "WEAK_POWER", "VULNERABLE_POWER"];
    const has = [attacker, ...targets].some((creature) => creature.powers.some((power) => modifiers.includes(power.id)));
    if (has) this.emit({ kind: "unimplemented", what: "피해 수정자(힘/약화/취약)" });
  }

  private dealDamage(creature: SimCreature, amount: number, source: string) {
    const blocked = Math.min(creature.block, amount);
    const hpFrom = creature.hp;
    creature.block -= blocked;
    creature.hp = Math.max(0, creature.hp - (amount - blocked));
    this.emit({ kind: "damage", creature: creature.key, amount, blocked, hpFrom, hpTo: creature.hp, source });
    if (creature.hp < hpFrom) this.emit({ kind: "animate", creature: creature.key, animation: "hurt", delayMs: 0 });
  }

  /** `CardPileCmd.ShuffleIfNecessary`: an empty draw pile takes the shuffled discard pile. */
  private shuffleIfNecessary() {
    if (this.state.piles.draw.length > 0 || this.state.piles.discard.length === 0) return;
    const cards = [...this.state.piles.discard];
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const [value, rng] = nextRandom(this.state.rng);
      this.state.rng = rng;
      const j = Math.floor(value * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    for (const uid of cards) this.moveCard(uid, "draw", "shuffle");
    this.emit({ kind: "shuffle", count: cards.length });
  }

  draw(count: number) {
    for (let i = 0; i < count; i += 1) {
      if (this.state.piles.hand.length >= MAX_HAND_SIZE) return;
      this.shuffleIfNecessary();
      const top = this.state.piles.draw[0];
      if (!top) return;
      this.moveCard(top, "hand", "draw");
    }
  }

  /**
   * `CardSelectCmd.FromHandForDiscard`: the player picks the cards. `choose` names
   * them (matched from the right of the hand); without it the rightmost cards go.
   */
  private discardChoice(count: number, choose: CardSpec[] | undefined) {
    const hand = [...this.state.piles.hand];
    const picked: string[] = [];
    for (const spec of choose ?? []) {
      if (picked.length >= count) break;
      const { id, upgraded } = parseCardSpec(spec);
      const uid = [...hand].reverse().find((candidate) =>
        !picked.includes(candidate)
        && this.state.cards[candidate].id === id
        && this.state.cards[candidate].upgraded === upgraded);
      if (uid) picked.push(uid);
      else this.warnings.push(`버릴 카드 ${spec}가 손에 없습니다`);
    }
    for (const uid of [...hand].reverse()) {
      if (picked.length >= Math.min(count, hand.length)) break;
      if (!picked.includes(uid)) picked.push(uid);
    }
    for (const uid of picked) this.moveCard(uid, "discard", "discard");
  }

  private endTurn() {
    // CombatManager.DoTurnEnd: CustomScaledWait(0.3, 0.6) before the hand goes to the discard pile.
    this.emit({ kind: "pause", reason: "turnEnd", fastMs: 300, normalMs: 600 });
    for (const uid of [...this.state.piles.hand]) {
      const card = this.effective(uid);
      if (card?.keywords.includes("Retain")) continue;
      if (card?.keywords.includes("Ethereal")) this.moveCard(uid, "exhaust", "exhaust");
      else this.moveCard(uid, "discard", "endTurn");
    }
  }

  private monsterTurn() {
    // CombatManager.StartTurn (enemy side): CustomScaledWait(0.5, 0.8) before ExecuteEnemyTurn.
    this.emit({ kind: "pause", reason: "enemyTurn", fastMs: 500, normalMs: 800 });
    for (const monster of this.state.monsters) {
      if (monster.hp <= 0 || !monster.moveId) continue;
      const def = this.catalog.monsters[monster.id];
      const move = def?.moves[monster.moveId];
      if (!def || !move) {
        this.emit({ kind: "unimplemented", what: `${monster.id} ${monster.moveId}` });
        continue;
      }
      // NCreature.PerformIntent: CustomScaledWait(0.25, 0.4), skipped on Instant.
      this.emit({ kind: "pause", reason: "performIntent", fastMs: 250, normalMs: 400 });
      monster.block = 0;
      for (const intent of move.intents) {
        if ((intent.type === "SingleAttackIntent" || intent.type === "MultiAttackIntent") && intent.damage !== undefined) {
          // AttackCommand.FromMonster(...).WithAttackerAnim(name, delay): one TriggerAnim, then a CreatureCmd.Damage per hit.
          this.emit({ kind: "animate", creature: monster.key, animation: "attack", delayMs: move.attackAnimDelay * 1000 });
          for (let hit = 0; hit < (intent.repeat ?? 1); hit += 1) {
            this.noteDamageModifiers(monster, [this.state.player]);
            this.dealDamage(this.state.player, intent.damage, monster.key);
            this.emit({ kind: "pause", reason: "damage", fastMs: 100, normalMs: 200 });
          }
        } else {
          this.emit({ kind: "unimplemented", what: `${def.name} ${move.name ?? move.id}: ${intent.type}` });
        }
      }
      const next = this.nextMove(monster.id, monster.moveId);
      monster.moveId = next;
      this.emit({ kind: "intent", creature: monster.key, moveId: next });
    }
  }

  private nextMove(monsterId: string, moveId: string): string | null {
    const options = (this.catalog.monsters[monsterId]?.transitions ?? []).filter((edge) => edge.from === moveId);
    if (options.length === 0) return moveId;
    if (options.length === 1) return options[0].to;
    const total = options.reduce((sum, edge) => sum + edge.weight, 0);
    const [value, rng] = nextRandom(this.state.rng);
    this.state.rng = rng;
    let roll = value * total;
    for (const edge of options) {
      roll -= edge.weight;
      if (roll < 0) return edge.to;
    }
    return options[options.length - 1].to;
  }

  private startTurn() {
    this.state.turn += 1;
    this.state.player.block = 0;
    const from = this.state.energy;
    this.state.energy = this.state.maxEnergy;
    this.emit({ kind: "energy", from, to: this.state.energy, cause: "turn" });
    this.draw(TURN_DRAW);
  }
}

export function runCombat(input: CombatSimInput, catalog: SimCatalog): SimResult {
  return new Combat(input, catalog).run();
}
