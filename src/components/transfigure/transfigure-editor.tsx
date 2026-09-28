"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";
import { CARD_TYPE_FILTER_ICONS } from "@/components/codex/codex-filter-assets";
import { BoundedCarouselFrame } from "@/components/codex/bounded-carousel";
import { FilterSection } from "@/components/codex/codex-filters";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import { MenuDropdown } from "@/components/menu-dropdown";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import Image from "@/components/ui/static-image";
import type {
  SaveTransfigurePostInput,
  SaveTransfigureVariantInput,
} from "@/hooks/use-transfigure-posts";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  canTransfigureCardMetadata,
  findTransfigureEntity,
  getTransfigureCardRarityLabel,
  getTransfigureCardTypeLabel,
  getTransfigureSourceText,
  isTransfigureResourceType,
  isTransfigureTokenResourceType,
  transfigureBlocksSignature,
  transfigurePostVariants,
  transfigureSourceHasEnergyCost,
  transfigureSourceHasStarCost,
  TRANSFIGURE_CARD_COLORS,
  TRANSFIGURE_CARD_RARITIES,
  TRANSFIGURE_CARD_TYPES,
  TRANSFIGURE_DEFAULT_ADDED_COST,
  TRANSFIGURE_MAX_VARIANTS,
  type TransfigureCardColor,
  type TransfigurePost,
} from "@/lib/transfigure-types";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";
import { TransfigureAssetEditor } from "./transfigure-asset-editor";
import { TransfigureResourcePicker } from "./transfigure-resource-picker";
import { TransfigureTokenAppearanceControls } from "./transfigure-token-appearance";
import {
  createTransfigureVariantDraft,
  getTransfigureVariantSource,
  transfigureDraftOmitsEnergyCost,
  transfigureVariantBlockReason,
  transfigureVariantDraftSignature,
  transfigureVariantSaveInput,
  type TransfigureVariantDraft,
  type TransfigureVariantSource,
} from "./transfigure-variant-draft";
import { TransfigureVariantPalette } from "./transfigure-variant-palette";

interface TransfigureEditorProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  initialPost?: TransfigurePost | null;
  profileNickname: string;
  serviceLocale: ServiceLocale;
  upgradeLabel: string;
  onSubmit: (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => Promise<void>;
  hideNickname?: boolean;
}

type DraftPatch =
  | Partial<TransfigureVariantDraft>
  | ((draft: TransfigureVariantDraft) => Partial<TransfigureVariantDraft>);

type TransfigureCopy = (typeof serviceMessages)[ServiceLocale]["transfigure"];

const LEGACY_TRANSFIGURE_DRAFT_PREFIXES = [
  "sts-transfigure-draft:",
  "sts-transfigure-edit-draft:",
] as const;

function removeTransfigureDrafts(prefixes: readonly string[]) {
  if (typeof window === "undefined") return;
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      sessionStorage.removeItem(key);
    }
  }
}

function transfigureCardColorLabel(
  color: TransfigureCardColor,
  entities: EntityInfo[],
  serviceLocale: ServiceLocale,
): string {
  const character = entities.find(
    (entity) => entity.type === "character" && entity.id.toLowerCase() === color,
  );
  if (character) return character.nameKo;
  const labels = getCodexServiceMessages(serviceLocale).labels;
  if (color === "token") return labels.rarityDetails.token;
  if (color === "quest") return labels.rarityDetails.quest;
  return labels.pools[color as keyof typeof labels.pools] ?? color;
}

function CardAttributePresence({
  active,
  cancelLabel,
  icon,
  kind,
  label,
  onCancel,
  onOpen,
}: {
  active: boolean;
  cancelLabel: string;
  icon: ReactNode;
  kind: "cost" | "star-cost";
  label: string;
  onCancel: () => void;
  onOpen: () => void;
}) {
  if (!active) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-primary/25 px-2 py-1 text-left text-xs text-primary/70 transition-colors hover:border-primary/50 hover:text-primary"
        data-transfigure-card-attribute-add={kind}
      >
        {icon}
        <span>+ {label}</span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-black/20 px-2 py-1.5"
      data-transfigure-card-attribute={kind}
    >
      <span className="flex min-w-0 items-center gap-2 text-xs text-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-[11px] text-gray-500 hover:text-gray-200"
        aria-label={`${cancelLabel}: ${label}`}
      >
        {cancelLabel}
      </button>
    </div>
  );
}

function CardAttributeChange<T extends string>({
  active,
  cancelLabel,
  kind,
  label,
  options,
  selectLabel,
  sourceLabel,
  value,
  onCancel,
  onChange,
  onOpen,
}: {
  active: boolean;
  cancelLabel: string;
  kind: "rarity" | "type" | "color";
  label: string;
  options: readonly { icon: ReactNode; label: string; value: T }[];
  selectLabel: string;
  sourceLabel: string;
  value: T | "";
  onCancel: () => void;
  onChange: (value: T) => void;
  onOpen: () => void;
}) {
  if (!active) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-md border border-dashed border-primary/25 px-2 py-1 text-left text-xs text-primary/70 transition-colors hover:border-primary/50 hover:text-primary"
        data-transfigure-card-attribute-add={kind}
      >
        + {label}
      </button>
    );
  }

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div
      className="space-y-1.5 rounded-lg border border-primary/20 bg-black/20 p-2"
      data-transfigure-card-attribute={kind}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground">{label}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-gray-500 hover:text-gray-200"
          aria-label={`${cancelLabel}: ${label}`}
        >
          {cancelLabel}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.35fr)] items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-game-title text-xs text-gray-500">
          {sourceLabel}
        </span>
        <span className="text-xs text-primary/60" aria-hidden="true">→</span>
        <MenuDropdown
          ariaLabel={label}
          rootClassName="min-w-0"
          summaryClassName="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted px-2 font-game-title text-xs text-primary outline-none transition-colors hover:border-primary/60 focus-visible:border-primary"
          menuClassName="left-0 max-h-64 min-w-full overflow-y-auto bg-popover"
          summary={(
            <>
              {selectedOption?.icon}
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedOption?.label ?? selectLabel}
              </span>
              <svg
                className="h-3 w-3 shrink-0 text-primary transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        >
          {options
            .filter((option) => option.value !== value)
            .map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => onChange(option.value)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-game-title text-sm text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {option.icon}
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            ))}
        </MenuDropdown>
      </div>
    </div>
  );
}

function TransfigureVariantAttributes({
  copy,
  draft,
  entities,
  serviceLocale,
  source,
  onChange,
}: {
  copy: TransfigureCopy;
  draft: TransfigureVariantDraft;
  entities: EntityInfo[];
  serviceLocale: ServiceLocale;
  source: TransfigureVariantSource;
  onChange: (patch: DraftPatch) => void;
}) {
  const { entity } = draft;
  const selectedCardData = entity.type === "card" ? entity.cardData : undefined;
  const sourceHasEnergyCost = transfigureSourceHasEnergyCost(source.sourceCost);
  const sourceHasStarCost = transfigureSourceHasStarCost(source.sourceStarCost);
  const canChangeCardMetadata = canTransfigureCardMetadata(
    source.sourceCardType,
    source.sourceCardRarity,
  );
  const attributeVisualColor = selectedCardData
    ? (
      draft.transformedCardColor
      && draft.transformedCardColor !== selectedCardData.color
        ? draft.transformedCardColor
        : (selectedCardData.visualColor ?? selectedCardData.color)
    )
    : "colorless";

  return (
    <>
      {selectedCardData && (
        <div
          className="border-t border-border px-3 py-2"
          data-transfigure-card-attributes
        >
          <FilterSection label={copy.cardAttributes}>
            <div className="space-y-2">
              <CardAttributePresence
                active={draft.showEnergyCost}
                cancelLabel={copy.cancelChange}
                icon={(
                  <Image
                    src={resolveSts2EnergyIcon(attributeVisualColor)}
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                )}
                kind="cost"
                label={copy.costLabel}
                onCancel={() => onChange({
                  showEnergyCost: false,
                  transformedCost: "",
                  transformedUpgradeCost: "",
                })}
                onOpen={() => onChange((current) => ({
                  showEnergyCost: true,
                  ...(!sourceHasEnergyCost ? {
                    transformedCost: current.transformedCost.trim()
                      || TRANSFIGURE_DEFAULT_ADDED_COST,
                    ...(source.sourceUpgradeText ? {
                      transformedUpgradeCost: current.transformedUpgradeCost.trim()
                        || TRANSFIGURE_DEFAULT_ADDED_COST,
                    } : {}),
                  } : {}),
                }))}
              />

              {!sourceHasStarCost && (
                <CardAttributePresence
                  active={draft.showStarCost}
                  cancelLabel={copy.cancelChange}
                  icon={(
                    <Image
                      src="/images/game-assets/card-misc/energy_star.png"
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4 shrink-0 object-contain"
                    />
                  )}
                  kind="star-cost"
                  label={copy.starCostLabel}
                  onCancel={() => onChange({
                    showStarCost: false,
                    transformedStarCost: "",
                    transformedUpgradeStarCost: "",
                  })}
                  onOpen={() => onChange((current) => ({
                    showStarCost: true,
                    transformedStarCost: current.transformedStarCost.trim()
                      || TRANSFIGURE_DEFAULT_ADDED_COST,
                    ...(source.sourceUpgradeText ? {
                      transformedUpgradeStarCost: current.transformedUpgradeStarCost.trim()
                        || source.sourceUpgradeStarCost
                        || TRANSFIGURE_DEFAULT_ADDED_COST,
                    } : {}),
                  }))}
                />
              )}

              <CardAttributeChange
                active={draft.showCardColorChange}
                cancelLabel={copy.cancelChange}
                kind="color"
                label={copy.cardColor}
                options={TRANSFIGURE_CARD_COLORS
                  .filter((color) => color !== source.sourceCardColor)
                  .map((color) => ({
                    icon: (
                      <TinyCardIcon
                        card={{
                          color,
                          visualColor: color,
                          rarity: draft.transformedCardRarity || selectedCardData.rarity,
                          type: draft.transformedCardType || selectedCardData.type,
                        }}
                        width={24}
                      />
                    ),
                    label: transfigureCardColorLabel(color, entities, serviceLocale),
                    value: color,
                  }))}
                selectLabel={copy.selectCardColor}
                sourceLabel={transfigureCardColorLabel(
                  selectedCardData.color,
                  entities,
                  serviceLocale,
                )}
                value={draft.transformedCardColor}
                onCancel={() => onChange({
                  transformedCardColor: "",
                  showCardColorChange: false,
                })}
                onChange={(value) => onChange({ transformedCardColor: value })}
                onOpen={() => onChange({ showCardColorChange: true })}
              />

              {canChangeCardMetadata ? (
                <>
                  <CardAttributeChange
                    active={draft.showCardRarityChange}
                    cancelLabel={copy.cancelChange}
                    kind="rarity"
                    label={copy.cardRarity}
                    options={TRANSFIGURE_CARD_RARITIES
                      .filter((rarity) => rarity !== source.sourceCardRarity)
                      .map((rarity) => {
                        const previewColor = draft.transformedCardColor
                          || selectedCardData.color;
                        return {
                          icon: (
                            <TinyCardIcon
                              card={{
                                color: previewColor,
                                visualColor: previewColor === selectedCardData.color
                                  ? selectedCardData.visualColor
                                  : previewColor,
                                rarity,
                                type: draft.transformedCardType || selectedCardData.type,
                              }}
                              width={24}
                            />
                          ),
                          label: getTransfigureCardRarityLabel(entities, rarity),
                          value: rarity,
                        };
                      })}
                    selectLabel={copy.selectCardRarity}
                    sourceLabel={selectedCardData.rarityLabel}
                    value={draft.transformedCardRarity}
                    onCancel={() => onChange({
                      transformedCardRarity: "",
                      showCardRarityChange: false,
                    })}
                    onChange={(value) => onChange({ transformedCardRarity: value })}
                    onOpen={() => onChange({ showCardRarityChange: true })}
                  />

                  <CardAttributeChange
                    active={draft.showCardTypeChange}
                    cancelLabel={copy.cancelChange}
                    kind="type"
                    label={copy.cardType}
                    options={TRANSFIGURE_CARD_TYPES
                      .filter((type) => type !== source.sourceCardType)
                      .map((type) => ({
                        icon: (
                          <Image
                            src={CARD_TYPE_FILTER_ICONS[type]}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                        ),
                        label: getTransfigureCardTypeLabel(entities, type),
                        value: type,
                      }))}
                    selectLabel={copy.selectCardType}
                    sourceLabel={selectedCardData.typeLabel}
                    value={draft.transformedCardType}
                    onCancel={() => onChange({
                      transformedCardType: "",
                      showCardTypeChange: false,
                    })}
                    onChange={(value) => onChange({ transformedCardType: value })}
                    onOpen={() => onChange({ showCardTypeChange: true })}
                  />
                </>
              ) : null}
            </div>
          </FilterSection>
        </div>
      )}

      {isTransfigureTokenResourceType(entity.type) && (
        <TransfigureTokenAppearanceControls
          color={draft.tokenColor}
          wax={draft.tokenWax}
          serviceLocale={serviceLocale}
          waxLabel={getCodexServiceMessages(serviceLocale).relicsView.toggles.wax}
          meltedLabel={getCodexServiceMessages(serviceLocale).relicsView.toggles.melted}
          onColorChange={(value) => onChange({ tokenColor: value })}
          onWaxChange={(value) => onChange({ tokenWax: value })}
        />
      )}
    </>
  );
}

export function TransfigureEditor({
  entities,
  gameLocale,
  initialPost,
  profileNickname,
  serviceLocale,
  upgradeLabel,
  onSubmit,
  hideNickname = false,
}: TransfigureEditorProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const [draftSessionId] = useState(() => globalThis.crypto.randomUUID());
  const draftSessionPrefix = `sts-transfigure-composer:${draftSessionId}:`;
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const pickerRootRef = useRef<HTMLDivElement>(null);
  const [initialDrafts] = useState<TransfigureVariantDraft[]>(() => (
    initialPost
      ? transfigurePostVariants(initialPost).flatMap((variant) => {
        const entity = findTransfigureEntity(entities, {
          type: variant.resource_type,
          id: variant.resource_id,
        });
        return entity
          ? [createTransfigureVariantDraft(
            entity,
            getTransfigureVariantSource(entity, entities),
            variant,
          )]
          : [];
      })
      : []
  ));
  const [initialSignature] = useState(() => initialDrafts
    .map((draft) => transfigureVariantDraftSignature(
      draft,
      getTransfigureVariantSource(draft.entity, entities),
    ))
    .join("\n"));
  const [drafts, setDrafts] = useState(initialDrafts);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(!initialPost);
  const [postTitle, setPostTitle] = useState(initialPost?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(initialPost));
  const [submitting, setSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    message: string;
    tone: "error" | "status";
  } | null>(null);
  const [submitTipPinned, setSubmitTipPinned] = useState(false);

  useEffect(() => {
    removeTransfigureDrafts(LEGACY_TRANSFIGURE_DRAFT_PREFIXES);
    return () => removeTransfigureDrafts([draftSessionPrefix]);
  }, [draftSessionPrefix]);

  const sourceEntities = useMemo(
    () => entities.filter((entity) => getTransfigureSourceText(entity) != null),
    [entities],
  );
  const sources = drafts.map((draft) => (
    getTransfigureVariantSource(draft.entity, entities)
  ));
  const currentIndex = activeIndex < drafts.length
    ? activeIndex
    : Math.max(0, drafts.length - 1);
  const activeDraft = drafts[currentIndex] ?? null;
  const activeSource = activeDraft ? sources[currentIndex]! : null;
  const autoTitle = drafts[0]
    ? copy.defaultTitle.replace("{name}", drafts[0].entity.nameKo)
    : "";
  const titleValue = titleTouched ? postTitle : autoTitle;
  const resolvedTitle = titleValue.trim() || autoTitle;
  const variantFull = drafts.length >= TRANSFIGURE_MAX_VARIANTS;

  const updateDraft = useCallback((
    uid: string,
    patch: DraftPatch,
    clearFeedback = true,
  ) => {
    setDrafts((current) => current.map((draft) => (
      draft.uid === uid
        ? { ...draft, ...(typeof patch === "function" ? patch(draft) : patch) }
        : draft
    )));
    if (clearFeedback) setSaveFeedback(null);
  }, []);

  const variantMessages = drafts.map((draft, index) => {
    const reason = transfigureVariantBlockReason(draft, sources[index]!);
    if (!reason) return null;
    return reason === "invalidDescription"
      ? copy.invalidDescription
      : copy.anchorOrDiffRequired;
  });
  const firstInvalidIndex = variantMessages.findIndex((message) => message != null);
  const draftsSignature = drafts
    .map((draft, index) => transfigureVariantDraftSignature(draft, sources[index]!))
    .join("\n");

  const readNickname = useCallback(() => (
    hideNickname
      ? (profileNickname.trim() || copy.defaultNickname)
      : (nicknameInputRef.current?.value.trim()
        || profileNickname
        || copy.defaultNickname)
  ), [copy.defaultNickname, hideNickname, profileNickname]);

  const hasUpdateDiff = (title: string, nickname: string) => {
    if (!initialPost) return true;
    return (
      title !== (initialPost.title ?? "").trim()
      || nickname !== initialPost.nickname.trim()
      || draftsSignature !== initialSignature
    );
  };

  const submitBlockMessage = (() => {
    if (submitting) return null;
    if (drafts.length === 0) return copy.selectResource;
    if (firstInvalidIndex >= 0) {
      const message = variantMessages[firstInvalidIndex]!;
      return drafts.length > 1
        ? copy.variantBlocked
          .replace("{index}", String(firstInvalidIndex + 1))
          .replace("{message}", message)
        : message;
    }
    if (!hasUpdateDiff(resolvedTitle, readNickname())) return copy.noChanges;
    return null;
  })();

  useEffect(() => {
    if (!submitBlockMessage) setSubmitTipPinned(false);
  }, [submitBlockMessage]);

  const requestSubmit = async () => {
    if (submitting || drafts.length === 0) return;
    if (firstInvalidIndex >= 0) {
      setActiveIndex(firstInvalidIndex);
      setSubmitTipPinned(true);
      return;
    }
    const nickname = readNickname();
    if (!hasUpdateDiff(resolvedTitle, nickname)) {
      setSubmitTipPinned(true);
      return;
    }
    const variants = drafts.map((draft, index) => (
      transfigureVariantSaveInput(draft, sources[index]!)
    ));
    if (variants.some((variant) => variant == null)) {
      setSubmitTipPinned(true);
      return;
    }
    setSubmitTipPinned(false);
    setSaveFeedback({ message: copy.saving, tone: "status" });
    setSubmitting(true);
    try {
      await onSubmit({
        title: resolvedTitle,
        nickname,
        sourceGameLocale: gameLocale,
        variants: variants as SaveTransfigureVariantInput[],
        hadExtraVariants: (initialPost?.extra_variants.length ?? 0) > 0,
      });
    } catch {
      setSaveFeedback({ message: copy.saveFailed, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const addVariant = (entity: EntityInfo) => {
    if (variantFull) return;
    const draft = createTransfigureVariantDraft(
      entity,
      getTransfigureVariantSource(entity, entities),
    );
    setDrafts((current) => [...current, draft]);
    setActiveIndex(drafts.length);
    setPickerOpen(false);
    setSaveFeedback(null);
  };

  const removeVariant = (index: number) => {
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
    setActiveIndex(index < currentIndex
      ? currentIndex - 1
      : Math.max(0, Math.min(currentIndex, drafts.length - 2)));
    if (drafts.length <= 1) setPickerOpen(true);
    setSaveFeedback(null);
  };

  const makeRepresentative = (index: number) => {
    setDrafts((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.unshift(moved);
      return next;
    });
    setActiveIndex(0);
    setSaveFeedback(null);
  };

  const openPicker = () => {
    if (variantFull) return;
    setPickerOpen(true);
    pickerRootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const renderAssetEditor = (
    draft: TransfigureVariantDraft,
    source: TransfigureVariantSource,
  ) => (
    <TransfigureAssetEditor
      key={`${initialPost?.id ?? "new"}:${draft.uid}`}
      draftKey={`${draftSessionPrefix}${gameLocale}:${draft.uid}`}
      entities={entities}
      entity={draft.entity}
      gameLocale={gameLocale}
      blocks={draft.blocks}
      initialBlocks={draft.seedBlocks}
      initialUpgradeBlocks={draft.seedUpgradeBlocks}
      nameLabel={copy.nameLabel}
      costLabel={copy.costLabel}
      starCostLabel={copy.starCostLabel}
      descriptionLabel={copy.descriptionLabel}
      descriptionFrameLimit={copy.descriptionFrameLimit}
      costTokenTip={copy.costTokenTip}
      addTopKeywordLabel={copy.addTopKeyword}
      addBottomKeywordLabel={copy.addBottomKeyword}
      removeKeywordLabel={copy.removeKeyword}
      serviceLocale={serviceLocale}
      sourceText={source.sourceText ?? ""}
      sourceUpgradeText={source.sourceUpgradeText}
      sourceUpgradeCost={source.sourceUpgradeCost}
      sourceStarCost={source.sourceStarCost}
      sourceUpgradeStarCost={source.sourceUpgradeStarCost}
      submitLabel={initialPost ? copy.saveChanges : copy.submit}
      transformedName={draft.transformedName}
      transformedCost={draft.transformedCost}
      transformedStarCost={draft.transformedStarCost}
      transformedCardType={draft.transformedCardType}
      transformedCardRarity={draft.transformedCardRarity}
      transformedCardColor={draft.transformedCardColor}
      cardKeywords={draft.cardKeywords}
      transformedUpgradeCost={draft.transformedUpgradeCost}
      transformedUpgradeStarCost={draft.transformedUpgradeStarCost}
      upgradedCardKeywords={draft.upgradedCardKeywords}
      upgradedBlocks={draft.upgradedBlocks}
      upgradeLabel={upgradeLabel}
      showUpgrade={draft.showUpgrade}
      tokenColor={draft.tokenColor}
      tokenWax={draft.tokenWax}
      showEnergyCost={draft.showEnergyCost}
      showStarCost={draft.showStarCost}
      omitEnergyCost={transfigureDraftOmitsEnergyCost(draft, source)}
      onBlocksChange={(blocks) => {
        updateDraft(
          draft.uid,
          { blocks },
          transfigureBlocksSignature(blocks)
            !== transfigureBlocksSignature(draft.blocks),
        );
      }}
      onCardKeywordsChange={(keywords) => updateDraft(draft.uid, { cardKeywords: keywords })}
      onCostChange={(value) => updateDraft(draft.uid, { transformedCost: value })}
      onStarCostChange={(value) => updateDraft(draft.uid, { transformedStarCost: value })}
      onUpgradeBlocksChange={(blocks) => {
        updateDraft(
          draft.uid,
          { upgradedBlocks: blocks },
          blocks == null
            ? draft.upgradedBlocks != null
            : (
              draft.upgradedBlocks == null
              || transfigureBlocksSignature(blocks)
                !== transfigureBlocksSignature(draft.upgradedBlocks)
            ),
        );
      }}
      onUpgradeCardKeywordsChange={(keywords) => updateDraft(
        draft.uid,
        { upgradedCardKeywords: keywords },
      )}
      onUpgradeCostChange={(value) => updateDraft(
        draft.uid,
        { transformedUpgradeCost: value },
      )}
      onUpgradeStarCostChange={(value) => updateDraft(
        draft.uid,
        { transformedUpgradeStarCost: value },
      )}
      onShowUpgradeChange={(checked) => updateDraft(draft.uid, { showUpgrade: checked })}
      onNameChange={(value) => updateDraft(draft.uid, { transformedName: value })}
      onSubmit={async () => {
        await requestSubmit();
      }}
    />
  );

  const submitButton = (
    <button
      type="button"
      onClick={() => { void requestSubmit(); }}
      disabled={submitting}
      aria-disabled={submitBlockMessage ? true : undefined}
      data-transfigure-submit=""
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-colors",
        submitting || submitBlockMessage
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-primary/25",
      )}
    >
      {submitting
        ? copy.saving
        : initialPost
          ? copy.saveChanges
          : copy.submit}
      <Image
        src="/images/sts2/relics/astrolabe.webp"
        alt=""
        width={16}
        height={16}
        className="object-contain"
      />
    </button>
  );

  const pickerHint = drafts.length === 0
    ? copy.searchPlaceholder
    : variantFull
      ? copy.variantLimitReached.replace("{max}", String(TRANSFIGURE_MAX_VARIANTS))
      : copy.addVariantHint
        .replace("{count}", String(drafts.length))
        .replace("{max}", String(TRANSFIGURE_MAX_VARIANTS));

  return (
    <div className="space-y-3" data-transfigure-editor>
      <div ref={pickerRootRef} className="scroll-mt-2">
        <TransfigureResourcePicker
          entities={sourceEntities}
          selected={null}
          serviceLocale={serviceLocale}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          disabled={variantFull}
          triggerTitle={drafts.length === 0 ? copy.selectResource : copy.addVariant}
          triggerHint={pickerHint}
          triggerIcon={drafts.length > 0
            ? <Plus className="h-5 w-5 text-primary/80" aria-hidden="true" />
            : undefined}
          onSelect={addVariant}
        />
      </div>

      {activeDraft
        && activeSource?.sourceText
        && isTransfigureResourceType(activeDraft.entity.type) && (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <label className="block">
                <span className="spire-gold mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {copy.titleLabel}
                </span>
                <input
                  type="text"
                  value={titleValue}
                  onChange={(event) => {
                    setPostTitle(event.target.value);
                    setTitleTouched(true);
                    setSaveFeedback(null);
                  }}
                  placeholder={copy.titlePlaceholder}
                  maxLength={80}
                  data-transfigure-title-input
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            {!hideNickname && (
            <div className="px-3 py-2">
              <input
                key={`${initialPost?.id ?? "new"}:${profileNickname}`}
                ref={nicknameInputRef}
                type="text"
                defaultValue={initialPost?.nickname ?? profileNickname}
                onChange={() => setSaveFeedback(null)}
                placeholder={copy.defaultNickname}
                maxLength={20}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            )}

            <TransfigureVariantPalette
              items={drafts.map((draft, index) => ({
                uid: draft.uid,
                entity: draft.entity,
                name: draft.transformedName.trim() || draft.entity.nameKo,
                upgraded: draft.showUpgrade && draft.entity.type === "card",
                blockMessage: variantMessages[index] ?? null,
              }))}
              activeIndex={currentIndex}
              serviceLocale={serviceLocale}
              onSelect={(index) => {
                setActiveIndex(index);
                setSubmitTipPinned(false);
              }}
              onMakeRepresentative={makeRepresentative}
              onRemove={removeVariant}
              onAdd={openPicker}
            />

            <TransfigureVariantAttributes
              key={activeDraft.uid}
              copy={copy}
              draft={activeDraft}
              entities={entities}
              serviceLocale={serviceLocale}
              source={activeSource}
              onChange={(patch) => updateDraft(activeDraft.uid, patch)}
            />
          </div>

          <section
            className="dark rounded-xl border border-primary/15 bg-black/20 p-3 lg:sticky lg:top-0"
            data-transfigure-variant-stage=""
            data-active-variant={currentIndex}
          >
            {drafts.length > 1 && (
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  {currentIndex === 0 && (
                    <span className="shrink-0 rounded bg-primary/20 px-1 text-[10px] text-primary">
                      {copy.representative}
                    </span>
                  )}
                  <span className="truncate font-game-title text-primary">
                    {activeDraft.transformedName.trim() || activeDraft.entity.nameKo}
                  </span>
                </span>
                <span
                  className="shrink-0 font-game-title tabular-nums text-primary/70"
                  data-transfigure-variant-position=""
                >
                  {copy.variantPosition
                    .replace("{index}", String(currentIndex + 1))
                    .replace("{total}", String(drafts.length))}
                </span>
              </div>
            )}
            {drafts.length > 1 ? (
              <BoundedCarouselFrame
                canMovePrevious={currentIndex > 0}
                canMoveNext={currentIndex < drafts.length - 1}
                onPrevious={() => setActiveIndex(currentIndex - 1)}
                onNext={() => setActiveIndex(currentIndex + 1)}
                previousLabel={copy.previousVariant}
                nextLabel={copy.nextVariant}
              >
                {renderAssetEditor(activeDraft, activeSource)}
              </BoundedCarouselFrame>
            ) : renderAssetEditor(activeDraft, activeSource)}
            <div className="mt-4 flex justify-center">
              {submitBlockMessage ? (
                <GameUiHoverTip
                  delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
                  open={submitTipPinned}
                  label={submitBlockMessage}
                >
                  {submitButton}
                </GameUiHoverTip>
              ) : submitButton}
            </div>
          </section>
        </div>
      )}

      {saveFeedback && (
        <p
          className={saveFeedback.tone === "error"
            ? "text-xs text-red-300"
            : "text-xs text-primary/75"}
          role={saveFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          data-transfigure-save-feedback={saveFeedback.tone}
        >
          {saveFeedback.message}
        </p>
      )}
    </div>
  );
}
