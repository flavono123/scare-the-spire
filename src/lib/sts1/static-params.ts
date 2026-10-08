import { generateLocalizedStaticParams } from "@/lib/codex-static-params";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  sts1RouteIds,
} from "./data";

export async function generateSts1CardStaticParams() {
  return sts1RouteIds(await getSts1Cards());
}

export async function generateSts1RelicStaticParams() {
  return sts1RouteIds(await getSts1Relics());
}

export async function generateSts1PotionStaticParams() {
  return sts1RouteIds(await getSts1Potions());
}

export async function generateSts1PowerStaticParams() {
  return sts1RouteIds(await getSts1Powers());
}

export async function generateSts1CharacterStaticParams() {
  return sts1RouteIds(await getSts1Characters());
}

export function generateSts1LocalizedCardStaticParams() {
  return generateLocalizedStaticParams(generateSts1CardStaticParams);
}

export function generateSts1LocalizedRelicStaticParams() {
  return generateLocalizedStaticParams(generateSts1RelicStaticParams);
}

export function generateSts1LocalizedPotionStaticParams() {
  return generateLocalizedStaticParams(generateSts1PotionStaticParams);
}

export function generateSts1LocalizedPowerStaticParams() {
  return generateLocalizedStaticParams(generateSts1PowerStaticParams);
}

export function generateSts1LocalizedCharacterStaticParams() {
  return generateLocalizedStaticParams(generateSts1CharacterStaticParams);
}
