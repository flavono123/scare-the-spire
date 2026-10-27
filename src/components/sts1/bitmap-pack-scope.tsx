"use client";

import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";
import {
  registerSts1BitmapPack,
  type Sts1BitmapPack,
  type Sts1BitmapPackName,
} from "@/lib/sts1/bitmap-font";

type ScopeProps = { children?: ReactNode };

function PackChildren({ children }: ScopeProps) {
  return children;
}

function registerThenRender(name: Sts1BitmapPackName) {
  return (module: { default: unknown }) => {
    registerSts1BitmapPack(name, module.default as Sts1BitmapPack);
    return PackChildren;
  };
}

// One async chunk per glyph pack. With ssr on, the server renders the children
// in place and Next preloads the chunk, so hydration waits for the page's own
// pack instead of every pack shipping in a shared chunk.
const KorScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/kor.json").then(registerThenRender("kor")));
const LatinScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/latin.json").then(registerThenRender("latin")));
const JpnScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/jpn.json").then(registerThenRender("jpn")));
const ZhsScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/zhs.json").then(registerThenRender("zhs")));
const RusScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/rus.json").then(registerThenRender("rus")));
const ThaScope = dynamic(() => import("@/lib/sts1/bitmap-fonts/tha.json").then(registerThenRender("tha")));

const SCOPES: Record<Sts1BitmapPackName, ComponentType<ScopeProps>> = {
  kor: KorScope,
  latin: LatinScope,
  jpn: JpnScope,
  zhs: ZhsScope,
  rus: RusScope,
  tha: ThaScope,
};

/** Renders children once the named STS1 bitmap glyph packs are registered. */
export function Sts1BitmapPackScope({
  packs,
  children,
}: {
  packs: readonly Sts1BitmapPackName[];
  children: ReactNode;
}) {
  return packs.reduceRight<ReactNode>((tree, name) => {
    const Scope = SCOPES[name];
    return <Scope>{tree}</Scope>;
  }, children);
}
