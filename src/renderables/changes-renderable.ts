import type { LineSign, MouseEvent, Selection } from "@opentui/core";
import {
  type CodeOptions,
  CodeRenderable,
  DiffRenderable,
  type LineColorConfig,
  LineNumberRenderable,
  measureText,
  parseColor,
  Renderable,
  type RenderableOptions,
  type RenderContext,
  type RGBA,
  SyntaxStyle,
  type TreeSitterClient,
} from "@opentui/core";

import { parsePatch, type StructuredPatch } from "diff";

interface UnifiedLogicalLine {
  content: string;
  type: "context" | "add" | "remove";
}

interface UnifiedDiffModel {
  content: string;
  logicalLines: UnifiedLogicalLine[];
  lineOffsets: number[];
  lineColors: Map<number, string | RGBA | LineColorConfig>;
  lineSigns: Map<number, LineSign>;
  lineNumbers: Map<number, number>;
}

interface SliceWindow {
  startLine: number;
  endLine: number;
  windowStartRow: number;
  windowEndRow: number;
  windowHeight: number;
  totalRows: number;
}

export interface ChangesRenderableOptions extends RenderableOptions<ChangesRenderable> {
  diff?: string;
  syncScroll?: boolean;
  view?: "unified" | "split";

  fg?: string | RGBA;
  filetype?: string;
  syntaxStyle?: SyntaxStyle;
  wrapMode?: "word" | "char" | "none";
  conceal?: boolean;
  selectionBg?: string | RGBA;
  selectionFg?: string | RGBA;
  treeSitterClient?: TreeSitterClient;

  showLineNumbers?: boolean;
  lineNumberFg?: string | RGBA;
  lineNumberBg?: string | RGBA;

  addedBg?: string | RGBA;
  removedBg?: string | RGBA;
  contextBg?: string | RGBA;
  addedContentBg?: string | RGBA;
  removedContentBg?: string | RGBA;
  contextContentBg?: string | RGBA;
  addedSignColor?: string | RGBA;
  removedSignColor?: string | RGBA;
  addedLineNumberBg?: string | RGBA;
  removedLineNumberBg?: string | RGBA;

  virtualizationOverscan?: number;
  onScrollStateChange?: (
    scrollTop: number,
    viewportHeight: number,
    scrollHeight: number,
  ) => void;
}

class DetachedCodeRenderable extends CodeRenderable {
  public applyViewportSize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));

    this._widthValue = nextWidth;
    this._heightValue = nextHeight;
    this.onResize(nextWidth, nextHeight);
  }
}

class LayoutCodeRenderable extends DetachedCodeRenderable {
  protected override onMouseEvent(_event: MouseEvent): void {}

  public syncViewport(scrollY: number): void {
    this.scrollY = Math.max(0, Math.floor(scrollY));
  }

  public applySelectionFromParent(
    selection: Selection | null,
    contentX: number,
    contentY: number,
  ): boolean {
    if (!selection?.isActive) {
      this.lastLocalSelection = null;
      this.textBufferView.resetLocalSelection();
      this.requestRender();
      return false;
    }

    const localSelection = {
      anchorX: selection.anchor.x - contentX,
      anchorY: selection.anchor.y - contentY,
      focusX: selection.focus.x - contentX,
      focusY: selection.focus.y - contentY,
      isActive: true as const,
    };

    this.lastLocalSelection = localSelection;

    const changed = selection.isStart
      ? this.textBufferView.setLocalSelection(
          localSelection.anchorX,
          localSelection.anchorY,
          localSelection.focusX,
          localSelection.focusY,
          this.selectionBg,
          this.selectionFg,
        )
      : this.textBufferView.updateLocalSelection(
          localSelection.anchorX,
          localSelection.anchorY,
          localSelection.focusX,
          localSelection.focusY,
          this.selectionBg,
          this.selectionFg,
        );

    if (changed) {
      this.requestRender();
    }

    return this.hasSelection();
  }
}

class ViewportCodeRenderable extends DetachedCodeRenderable {
  public clearHighlights(): void {
    this.textBuffer.clearAllHighlights();
  }

  public clearSelectionRange(): void {
    this.textBufferView.resetSelection();
    this.textBufferView.resetLocalSelection();
    this.requestRender();
  }

  public setSelectionRange(start: number, end: number): void {
    if (start >= end) {
      this.clearSelectionRange();
      return;
    }

    this.textBufferView.resetLocalSelection();
    this.textBufferView.setSelection(start, end, this.selectionBg, this.selectionFg);
    this.requestRender();
  }

  public override getSelectedText(): string {
    return this.textBufferView.getSelectedText();
  }
}

export class ChangesRenderable extends Renderable {
  private _diff: string;
  private _syncScroll = false;
  private _view: "unified" | "split";
  private _parsedDiff: StructuredPatch | null = null;
  private _parseError: Error | null = null;
  private _virtualizationOverscan = 8;
  private _scrollTop = 0;
  private _onScrollStateChange?: ChangesRenderableOptions["onScrollStateChange"];
  private _fg?: RGBA;
  private _filetype?: string;
  private _syntaxStyle?: SyntaxStyle;
  private _wrapMode?: "word" | "char" | "none";
  private _conceal: boolean;
  private _selectionBg?: RGBA;
  private _selectionFg?: RGBA;
  private _treeSitterClient?: TreeSitterClient;

  private _showLineNumbers: boolean;
  private _lineNumberFg: RGBA;
  private _lineNumberBg: RGBA;

  private _addedBg: RGBA;
  private _removedBg: RGBA;
  private _contextBg: RGBA;
  private _addedContentBg: RGBA | null;
  private _removedContentBg: RGBA | null;
  private _contextContentBg: RGBA | null;
  private _addedSignColor: RGBA;
  private _removedSignColor: RGBA;
  private _addedLineNumberBg: RGBA;
  private _removedLineNumberBg: RGBA;

  private unifiedModel: UnifiedDiffModel | null = null;
  private layoutCodeRenderable: LayoutCodeRenderable | null = null;
  private visibleCodeRenderable: ViewportCodeRenderable | null = null;
  private visibleSide: LineNumberRenderable | null = null;
  private fallbackDiffRenderable: DiffRenderable | null = null;

  private cachedWrapWidth = -1;
  private cachedSliceSignature = "";
  private rowStarts: number[] = [];
  private rowCounts: number[] = [];
  private totalVirtualRows = 0;
  private currentSlice: SliceWindow | null = null;

  constructor(ctx: RenderContext, options: ChangesRenderableOptions) {
    super(ctx, {
      ...options,
      flexDirection: options.view === "split" ? "row" : "column",
      width: options.width ?? "100%",
      overflow: "hidden",
    });

    this.selectable = true;
    this._diff = options.diff ?? "";
    this._syncScroll = options.syncScroll ?? false;
    this._view = options.view ?? "unified";
    this._virtualizationOverscan = options.virtualizationOverscan ?? 8;
    this._onScrollStateChange = options.onScrollStateChange;

    this._fg = options.fg ? parseColor(options.fg) : undefined;
    this._filetype = options.filetype;
    this._syntaxStyle = options.syntaxStyle;
    this._wrapMode = options.wrapMode;
    this._conceal = options.conceal ?? false;
    this._selectionBg = options.selectionBg ? parseColor(options.selectionBg) : undefined;
    this._selectionFg = options.selectionFg ? parseColor(options.selectionFg) : undefined;
    this._treeSitterClient = options.treeSitterClient;

    this._showLineNumbers = options.showLineNumbers ?? true;
    this._lineNumberFg = parseColor(options.lineNumberFg ?? "#888888");
    this._lineNumberBg = parseColor(options.lineNumberBg ?? "transparent");

    this._addedBg = parseColor(options.addedBg ?? "#1a4d1a");
    this._removedBg = parseColor(options.removedBg ?? "#4d1a1a");
    this._contextBg = parseColor(options.contextBg ?? "transparent");
    this._addedContentBg = options.addedContentBg ? parseColor(options.addedContentBg) : null;
    this._removedContentBg = options.removedContentBg
      ? parseColor(options.removedContentBg)
      : null;
    this._contextContentBg = options.contextContentBg
      ? parseColor(options.contextContentBg)
      : null;
    this._addedSignColor = parseColor(options.addedSignColor ?? "#22c55e");
    this._removedSignColor = parseColor(options.removedSignColor ?? "#ef4444");
    this._addedLineNumberBg = parseColor(options.addedLineNumberBg ?? "transparent");
    this._removedLineNumberBg = parseColor(options.removedLineNumberBg ?? "transparent");

    this.parseDiff();
    this.buildView();
  }

  protected override onResize(width: number, height: number): void {
    super.onResize(width, height);

    if (this._view !== "unified") {
      return;
    }

    this.rebuildUnifiedSlice(true);
  }

  protected override onMouseEvent(event: MouseEvent): void {
    if (event.type !== "scroll" || !event.scroll) {
      return;
    }

    const { direction, delta } = event.scroll;

    if (direction === "up") {
      this.scrollTop -= delta;
    } else if (direction === "down") {
      this.scrollTop += delta;
    }
  }

  public override shouldStartSelection(x: number, y: number): boolean {
    if (!this.visible || this._view !== "unified") {
      return false;
    }

    return x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height;
  }

  public override onSelectionChanged(selection: Selection | null): boolean {
    if (this._view !== "unified" || !this.layoutCodeRenderable) {
      return this.fallbackDiffRenderable?.onSelectionChanged(selection) ?? false;
    }

    const changed = this.layoutCodeRenderable.applySelectionFromParent(
      selection,
      this.getContentOriginX(),
      this.y,
    );
    this.applyVisibleSelection();
    return changed;
  }

  public override getSelectedText(): string {
    if (this._view === "unified" && this.layoutCodeRenderable) {
      return this.layoutCodeRenderable.getSelectedText();
    }

    return this.fallbackDiffRenderable?.getSelectedText() ?? "";
  }

  public override hasSelection(): boolean {
    if (this._view === "unified" && this.layoutCodeRenderable) {
      return this.layoutCodeRenderable.hasSelection();
    }

    return this.fallbackDiffRenderable?.hasSelection() ?? false;
  }

  public get scrollTop(): number {
    return this._scrollTop;
  }

  public set scrollTop(value: number) {
    const next = Math.max(0, Math.min(Math.floor(value), this.maxScrollTop));

    if (this._scrollTop === next) {
      return;
    }

    this._scrollTop = next;

    if (this._view === "unified") {
      this.rebuildUnifiedSlice(false);
    }
  }

  public get scrollHeight(): number {
    return this._view === "unified"
      ? Math.max(this.totalVirtualRows, this.height)
      : (this.fallbackDiffRenderable?.height ?? this.height);
  }

  public get viewportHeight(): number {
    return this.height;
  }

  public get maxScrollTop(): number {
    return Math.max(0, this.scrollHeight - this.height);
  }

  public scrollBy(delta: number): void {
    this.scrollTop += delta;
  }

  private notifyScrollState(): void {
    this._onScrollStateChange?.(this._scrollTop, this.height, this.scrollHeight);
  }

  private parseDiff(): void {
    this.unifiedModel = null;

    if (!this._diff) {
      this._parsedDiff = null;
      this._parseError = null;
      return;
    }

    try {
      const patches = parsePatch(this._diff);
      this._parsedDiff = patches[0] ?? null;
      this._parseError = null;
    } catch (error) {
      this._parsedDiff = null;
      this._parseError = error instanceof Error ? error : new Error(String(error));
    }
  }

  private getUnifiedModel(): UnifiedDiffModel | null {
    if (this.unifiedModel) {
      return this.unifiedModel;
    }

    if (!this._parsedDiff || this._parsedDiff.hunks.length === 0) {
      return null;
    }

    const logicalLines: UnifiedLogicalLine[] = [];
    const lineColors = new Map<number, string | RGBA | LineColorConfig>();
    const lineSigns = new Map<number, LineSign>();
    const lineNumbers = new Map<number, number>();

    let lineIndex = 0;

    for (const hunk of this._parsedDiff.hunks) {
      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      for (const rawLine of hunk.lines) {
        const firstChar = rawLine[0];
        const content = rawLine.slice(1);

        if (firstChar === "+") {
          logicalLines.push({ content, type: "add" });
          lineColors.set(lineIndex, {
            gutter: this._addedLineNumberBg,
            content: this._addedContentBg ?? this._addedBg,
          });
          lineSigns.set(lineIndex, {
            after: " +",
            afterColor: this._addedSignColor,
          });
          lineNumbers.set(lineIndex, newLineNum);
          newLineNum += 1;
          lineIndex += 1;
          continue;
        }

        if (firstChar === "-") {
          logicalLines.push({ content, type: "remove" });
          lineColors.set(lineIndex, {
            gutter: this._removedLineNumberBg,
            content: this._removedContentBg ?? this._removedBg,
          });
          lineSigns.set(lineIndex, {
            after: " -",
            afterColor: this._removedSignColor,
          });
          lineNumbers.set(lineIndex, oldLineNum);
          oldLineNum += 1;
          lineIndex += 1;
          continue;
        }

        if (firstChar === " ") {
          logicalLines.push({ content, type: "context" });
          lineColors.set(lineIndex, {
            gutter: this._lineNumberBg,
            content: this._contextContentBg ?? this._contextBg,
          });
          lineNumbers.set(lineIndex, newLineNum);
          oldLineNum += 1;
          newLineNum += 1;
          lineIndex += 1;
        }
      }
    }

    this.unifiedModel = {
      content: logicalLines.map((line) => line.content).join("\n"),
      logicalLines,
      lineOffsets: logicalLines.reduce<number[]>((offsets, _line, index) => {
        const previousOffset = offsets[index - 1] ?? 0;
        const previousLine = logicalLines[index - 1];

        offsets.push(
          index === 0 ? 0 : previousOffset + (previousLine?.content.length ?? 0) + 1,
        );

        return offsets;
      }, []),
      lineColors,
      lineSigns,
      lineNumbers,
    };

    return this.unifiedModel;
  }

  private createOrUpdateFallbackDiff(): DiffRenderable {
    if (!this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable = new DiffRenderable(this.ctx, {
        id: this.id ? `${this.id}-fallback` : undefined,
        width: "100%",
        diff: this._diff,
        syncScroll: this._syncScroll,
        view: this._view,
        fg: this._fg,
        filetype: this._filetype,
        syntaxStyle: this._syntaxStyle,
        wrapMode: this._wrapMode,
        conceal: this._conceal,
        selectionBg: this._selectionBg,
        selectionFg: this._selectionFg,
        treeSitterClient: this._treeSitterClient,
        showLineNumbers: this._showLineNumbers,
        lineNumberFg: this._lineNumberFg,
        lineNumberBg: this._lineNumberBg,
        addedBg: this._addedBg,
        removedBg: this._removedBg,
        contextBg: this._contextBg,
        addedContentBg: this._addedContentBg ?? undefined,
        removedContentBg: this._removedContentBg ?? undefined,
        contextContentBg: this._contextContentBg ?? undefined,
        addedSignColor: this._addedSignColor,
        removedSignColor: this._removedSignColor,
        addedLineNumberBg: this._addedLineNumberBg,
        removedLineNumberBg: this._removedLineNumberBg,
      });
    }

    this.fallbackDiffRenderable.diff = this._diff;
    this.fallbackDiffRenderable.view = this._view;
    this.fallbackDiffRenderable.width = "100%";
    return this.fallbackDiffRenderable;
  }

  private getEffectiveWrapMode(): "word" | "char" | "none" {
    return this._wrapMode ?? "none";
  }

  private getVisibleSideWidth(): number {
    const model = this.getUnifiedModel();
    if (!model || !this._showLineNumbers) {
      return 0;
    }

    let maxLineNumber = model.logicalLines.length;
    for (const lineNumber of model.lineNumbers.values()) {
      maxLineNumber = Math.max(maxLineNumber, lineNumber);
    }

    const digits = maxLineNumber > 0 ? Math.floor(Math.log10(maxLineNumber)) + 1 : 1;
    let maxAfterWidth = 0;
    for (const sign of model.lineSigns.values()) {
      if (sign.after) {
        maxAfterWidth = Math.max(maxAfterWidth, Bun.stringWidth(sign.after));
      }
    }

    const baseWidth = Math.max(3, digits + 2);
    return baseWidth + maxAfterWidth;
  }

  private getContentWidth(): number {
    const sideWidth = this.getVisibleSideWidth();
    return Math.max(1, this.width - sideWidth);
  }

  private getContentOriginX(): number {
    return this.x + this.getVisibleSideWidth();
  }

  private countWrappedRows(content: string, width: number): number {
    if (width <= 0) {
      return 1;
    }

    if (content.length === 0) {
      return 1;
    }

    const effectiveWidth = Math.max(1, width);
    const wrapMode = this.getEffectiveWrapMode();

    if (wrapMode === "none") {
      return 1;
    }

    const expanded = content.replace(/\t/g, "    ");

    if (wrapMode === "char") {
      const charWidth = measureText({ text: expanded }).width;
      return Math.max(1, Math.ceil(charWidth / effectiveWidth));
    }

    let rowCount = 1;
    let currentWidth = 0;
    const words = expanded.split(/(\s+)/);

    for (const word of words) {
      if (word.length === 0) {
        continue;
      }

      const wordWidth = measureText({ text: word }).width;

      if (/^\s+$/.test(word)) {
        currentWidth = Math.min(effectiveWidth, currentWidth + wordWidth);
        continue;
      }

      if (wordWidth > effectiveWidth) {
        if (currentWidth > 0) {
          rowCount += 1;
          currentWidth = 0;
        }
        rowCount += Math.max(1, Math.ceil(wordWidth / effectiveWidth)) - 1;
        currentWidth = wordWidth % effectiveWidth;
        continue;
      }

      if (currentWidth > 0 && currentWidth + wordWidth > effectiveWidth) {
        rowCount += 1;
        currentWidth = wordWidth;
      } else {
        currentWidth += wordWidth;
      }
    }

    return Math.max(1, rowCount);
  }

  private ensureRowLayout(): void {
    const model = this.getUnifiedModel();
    if (!model) {
      this.rowStarts = [];
      this.rowCounts = [];
      this.totalVirtualRows = 0;
      return;
    }

    const contentWidth = this.getContentWidth();
    if (contentWidth <= 0) {
      return;
    }

    if (
      this.cachedWrapWidth === contentWidth &&
      this.rowCounts.length === model.logicalLines.length
    ) {
      return;
    }

    this.cachedWrapWidth = contentWidth;
    this.rowCounts = new Array(model.logicalLines.length);
    this.rowStarts = new Array(model.logicalLines.length);

    let totalRows = 0;

    for (let i = 0; i < model.logicalLines.length; i += 1) {
      this.rowStarts[i] = totalRows;
      const rowCount = this.countWrappedRows(
        model.logicalLines[i]?.content ?? "",
        contentWidth,
      );
      this.rowCounts[i] = rowCount;
      totalRows += rowCount;
    }

    this.totalVirtualRows = Math.max(totalRows, 1);
    this._scrollTop = Math.min(this._scrollTop, this.maxScrollTop);
  }

  private findStartLineForRow(targetRow: number): number {
    let low = 0;
    let high = this.rowStarts.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const start = this.rowStarts[mid] ?? 0;

      if (start <= targetRow) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  private computeSliceWindow(): SliceWindow {
    const model = this.getUnifiedModel();
    if (!model || model.logicalLines.length === 0) {
      return {
        startLine: 0,
        endLine: 0,
        windowStartRow: 0,
        windowEndRow: 1,
        windowHeight: Math.max(1, this.height),
        totalRows: Math.max(1, this.height),
      };
    }

    this.ensureRowLayout();

    const overscan = Math.max(0, this._virtualizationOverscan);
    const viewportHeight = Math.max(1, this.height);
    const visibleStartRow = Math.max(0, this._scrollTop);
    const visibleEndRow = Math.min(this.totalVirtualRows, visibleStartRow + viewportHeight);
    const windowStartRow = Math.max(0, visibleStartRow - overscan);
    const windowEndRow = Math.min(this.totalVirtualRows, visibleEndRow + overscan);
    const startLine = this.findStartLineForRow(windowStartRow);
    let endLine = startLine;

    while (endLine < model.logicalLines.length) {
      const lineStart = this.rowStarts[endLine] ?? 0;
      const lineEnd = lineStart + (this.rowCounts[endLine] ?? 1);
      if (lineStart >= windowEndRow) {
        break;
      }
      endLine += 1;
      if (lineEnd >= windowEndRow) {
        break;
      }
    }

    return {
      startLine,
      endLine: Math.max(startLine + 1, endLine),
      windowStartRow,
      windowEndRow,
      windowHeight: Math.max(1, windowEndRow - windowStartRow),
      totalRows: this.totalVirtualRows,
    };
  }

  private createOrUpdateLayoutCodeRenderable(content: string): LayoutCodeRenderable {
    if (!this.layoutCodeRenderable) {
      const codeOptions: CodeOptions = {
        id: this.id ? `${this.id}-layout` : undefined,
        content,
        filetype: this._filetype,
        wrapMode: this.getEffectiveWrapMode(),
        conceal: this._conceal,
        syntaxStyle: this._syntaxStyle ?? SyntaxStyle.create(),
        width: this.getContentWidth(),
        height: this.height,
        visible: false,
        ...(this._selectionBg !== undefined && { selectionBg: this._selectionBg }),
        ...(this._selectionFg !== undefined && { selectionFg: this._selectionFg }),
        ...(this._treeSitterClient !== undefined && {
          treeSitterClient: this._treeSitterClient,
        }),
      };

      this.layoutCodeRenderable = new LayoutCodeRenderable(this.ctx, codeOptions);
      this.layoutCodeRenderable.selectable = true;
    } else {
      this.layoutCodeRenderable.content = content;
      this.layoutCodeRenderable.filetype = this._filetype;
      this.layoutCodeRenderable.wrapMode = this.getEffectiveWrapMode();
      this.layoutCodeRenderable.syntaxStyle =
        this._syntaxStyle ?? this.layoutCodeRenderable.syntaxStyle;
      this.layoutCodeRenderable.conceal = this._conceal;
      this.layoutCodeRenderable.selectionBg = this._selectionBg;
      this.layoutCodeRenderable.selectionFg = this._selectionFg;
    }

    return this.layoutCodeRenderable;
  }

  private createOrUpdateVisibleCodeRenderable(content: string): ViewportCodeRenderable {
    if (!this.visibleCodeRenderable) {
      const codeOptions: CodeOptions = {
        id: this.id ? `${this.id}-visible` : undefined,
        content,
        filetype: this._filetype,
        wrapMode: this.getEffectiveWrapMode(),
        conceal: this._conceal,
        syntaxStyle: this._syntaxStyle ?? SyntaxStyle.create(),
        width: this.getContentWidth(),
        height: 1,
        selectable: false,
        ...(this._fg !== undefined && { fg: this._fg }),
        ...(this._selectionBg !== undefined && { selectionBg: this._selectionBg }),
        ...(this._selectionFg !== undefined && { selectionFg: this._selectionFg }),
        ...(this._treeSitterClient !== undefined && {
          treeSitterClient: this._treeSitterClient,
        }),
      };

      this.visibleCodeRenderable = new ViewportCodeRenderable(this.ctx, codeOptions);
      this.visibleCodeRenderable.selectable = false;
    } else {
      this.visibleCodeRenderable.content = content;
      this.visibleCodeRenderable.filetype = this._filetype;
      this.visibleCodeRenderable.wrapMode = this.getEffectiveWrapMode();
      this.visibleCodeRenderable.syntaxStyle =
        this._syntaxStyle ?? this.visibleCodeRenderable.syntaxStyle;
      this.visibleCodeRenderable.conceal = this._conceal;
      this.visibleCodeRenderable.width = this.getContentWidth();
      this.visibleCodeRenderable.height = Math.max(1, this.height);
      if (this._fg !== undefined) {
        this.visibleCodeRenderable.fg = this._fg;
      }
      this.visibleCodeRenderable.selectionBg = this._selectionBg;
      this.visibleCodeRenderable.selectionFg = this._selectionFg;
    }

    return this.visibleCodeRenderable;
  }

  private createOrUpdateVisibleSide(): LineNumberRenderable {
    if (!this.visibleCodeRenderable) {
      throw new Error("Visible code renderable must exist before visible side.");
    }

    if (!this.visibleSide) {
      this.visibleSide = new LineNumberRenderable(this.ctx, {
        id: this.id ? `${this.id}-side` : undefined,
        target: this.visibleCodeRenderable,
        fg: this._lineNumberFg,
        bg: this._lineNumberBg,
        lineColors: new Map(),
        lineSigns: new Map(),
        lineNumbers: new Map(),
        hideLineNumbers: new Set(),
        width: this.width,
        height: 1,
        position: "absolute",
        left: 0,
        top: 0,
      });
    }

    this.visibleSide.fg = this._lineNumberFg;
    this.visibleSide.bg = this._lineNumberBg;
    this.visibleSide.showLineNumbers = this._showLineNumbers;
    this.disableVisibleSideGutterBuffering();
    return this.visibleSide;
  }

  private disableVisibleSideGutterBuffering(): void {
    const gutter = this.visibleSide?.getChildren()[0] as
      | {
          buffered?: boolean;
          frameBuffer?: { destroy?: () => void } | null;
        }
      | undefined;

    if (!gutter) {
      return;
    }

    gutter.buffered = false;
    gutter.frameBuffer?.destroy?.();
    gutter.frameBuffer = null;
  }

  private buildSliceContent(slice: SliceWindow): string {
    const model = this.getUnifiedModel();
    if (!model) {
      return "";
    }

    return model.logicalLines
      .slice(slice.startLine, slice.endLine)
      .map((line) => line.content)
      .join("\n");
  }

  private getSliceTextRange(slice: SliceWindow): { start: number; end: number } {
    const model = this.getUnifiedModel();
    if (!model || model.logicalLines.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = model.lineOffsets[slice.startLine] ?? 0;

    if (slice.endLine >= model.logicalLines.length) {
      return { start, end: model.content.length };
    }

    return {
      start,
      end: Math.max(start, (model.lineOffsets[slice.endLine] ?? model.content.length) - 1),
    };
  }

  private sliceHasChanged(slice: SliceWindow): boolean {
    const signature = `${slice.startLine}:${slice.endLine}:${slice.windowStartRow}:${slice.windowEndRow}:${this.width}:${this.height}`;
    if (this.cachedSliceSignature === signature) {
      return false;
    }

    this.cachedSliceSignature = signature;
    return true;
  }

  private buildVisibleMaps(slice: SliceWindow): {
    lineColors: Map<number, string | RGBA | LineColorConfig>;
    lineSigns: Map<number, LineSign>;
    lineNumbers: Map<number, number>;
  } {
    const model = this.getUnifiedModel();

    const lineColors = new Map<number, string | RGBA | LineColorConfig>();
    const lineSigns = new Map<number, LineSign>();
    const lineNumbers = new Map<number, number>();

    if (!model) {
      return { lineColors, lineSigns, lineNumbers };
    }

    for (let line = slice.startLine; line < slice.endLine; line += 1) {
      const localLine = line - slice.startLine;
      const color = model.lineColors.get(line);
      const sign = model.lineSigns.get(line);
      const lineNumber = model.lineNumbers.get(line);

      if (color) {
        lineColors.set(localLine, color);
      }
      if (sign) {
        lineSigns.set(localLine, sign);
      }
      if (lineNumber !== undefined) {
        lineNumbers.set(localLine, lineNumber);
      }
    }

    return { lineColors, lineSigns, lineNumbers };
  }

  private applyVisibleSelection(): void {
    if (!this.layoutCodeRenderable || !this.visibleCodeRenderable || !this.currentSlice) {
      return;
    }

    const selection = this.layoutCodeRenderable.getSelection();
    if (!selection) {
      this.visibleCodeRenderable.clearSelectionRange();
      return;
    }

    const sliceRange = this.getSliceTextRange(this.currentSlice);
    if (selection.end <= sliceRange.start || selection.start >= sliceRange.end) {
      this.visibleCodeRenderable.clearSelectionRange();
      return;
    }

    const localStart = Math.max(0, selection.start - sliceRange.start);
    const localEnd = Math.min(
      sliceRange.end - sliceRange.start,
      selection.end - sliceRange.start,
    );

    this.visibleCodeRenderable.setSelectionRange(localStart, localEnd);
  }

  private ensureAdded(renderable: Renderable | null): void {
    if (!renderable || renderable.parent === this) {
      return;
    }

    super.add(renderable);
  }

  private ensureRemoved(renderable: Renderable | null): void {
    if (!renderable || renderable.parent !== this) {
      return;
    }

    super.remove(renderable.id);
  }

  private buildFallbackView(): void {
    this.ensureRemoved(this.visibleSide);
    this.ensureRemoved(this.layoutCodeRenderable);
    this.currentSlice = null;
    this.cachedSliceSignature = "";

    const fallbackDiff = this.createOrUpdateFallbackDiff();
    this.ensureAdded(fallbackDiff);
    this.notifyScrollState();
  }

  private rebuildUnifiedSlice(force: boolean): void {
    const model = this.getUnifiedModel();
    if (!model) {
      this.buildFallbackView();
      return;
    }

    this.ensureRowLayout();
    const layoutRenderable = this.createOrUpdateLayoutCodeRenderable(model.content);

    layoutRenderable.applyViewportSize(this.getContentWidth(), Math.max(1, this.height));
    layoutRenderable.syncViewport(this._scrollTop);
    this.ensureRemoved(this.fallbackDiffRenderable);

    const slice = this.computeSliceWindow();
    const sliceChanged = force || this.sliceHasChanged(slice);
    this.currentSlice = slice;

    const visibleContent = this.buildSliceContent(slice);
    const visibleRenderable = this.createOrUpdateVisibleCodeRenderable(visibleContent);
    visibleRenderable.width = this.getContentWidth();
    visibleRenderable.height = slice.windowHeight;
    visibleRenderable.applyViewportSize(this.getContentWidth(), slice.windowHeight);
    visibleRenderable.scrollY = 0;
    visibleRenderable.scrollX = 0;

    const visibleSide = this.createOrUpdateVisibleSide();

    const visibleMaps = this.buildVisibleMaps(slice);
    visibleSide.setLineColors(visibleMaps.lineColors);
    visibleSide.setLineSigns(visibleMaps.lineSigns);
    visibleSide.setLineNumbers(visibleMaps.lineNumbers);
    visibleSide.setHideLineNumbers(new Set<number>());
    visibleSide.width = this.width;
    visibleSide.height = slice.windowHeight;
    visibleSide.top = slice.windowStartRow - this._scrollTop;

    if (sliceChanged) {
      visibleRenderable.clearHighlights();
    }

    this.ensureAdded(visibleSide);
    this._scrollTop = Math.min(this._scrollTop, this.maxScrollTop);
    this.applyVisibleSelection();
    this.notifyScrollState();
    this.requestRender();
  }

  private buildUnifiedView(): void {
    const model = this.getUnifiedModel();
    if (!model) {
      this.buildFallbackView();
      return;
    }

    if (this.width <= 0 || this.height <= 0) {
      return;
    }

    this.flexDirection = "column";
    this.rebuildUnifiedSlice(true);
  }

  private buildView(): void {
    if (this._view !== "unified" || this._parseError) {
      this.buildFallbackView();
      return;
    }

    this.buildUnifiedView();
  }

  public override destroyRecursively(): void {
    super.destroyRecursively();
  }

  public get diff(): string {
    return this._diff;
  }

  public set diff(value: string) {
    if (this._diff === value) {
      return;
    }

    this._diff = value;
    this.cachedWrapWidth = -1;
    this.cachedSliceSignature = "";
    this.rowStarts = [];
    this.rowCounts = [];
    this.parseDiff();
    this.buildView();
  }

  public get view(): "unified" | "split" {
    return this._view;
  }

  public set view(value: "unified" | "split") {
    if (this._view === value) {
      return;
    }

    this._view = value;
    this.buildView();
  }

  public get virtualizationOverscan(): number {
    return this._virtualizationOverscan;
  }

  public set virtualizationOverscan(value: number) {
    const next = Math.max(0, Math.floor(value));
    if (this._virtualizationOverscan === next) {
      return;
    }

    this._virtualizationOverscan = next;
    this.rebuildUnifiedSlice(true);
  }

  public get onScrollStateChange(): ChangesRenderableOptions["onScrollStateChange"] {
    return this._onScrollStateChange;
  }

  public set onScrollStateChange(value: ChangesRenderableOptions["onScrollStateChange"]) {
    this._onScrollStateChange = value;
    this.notifyScrollState();
  }

  public get wrapMode(): "word" | "char" | "none" | undefined {
    return this._wrapMode;
  }

  public set wrapMode(value: "word" | "char" | "none" | undefined) {
    if (this._wrapMode === value) {
      return;
    }

    this._wrapMode = value;
    this.cachedWrapWidth = -1;
    this.cachedSliceSignature = "";
    this.rebuildUnifiedSlice(true);
  }

  public get selectionBg(): RGBA | undefined {
    return this._selectionBg;
  }

  public set selectionBg(value: string | RGBA | undefined) {
    const parsed = value ? parseColor(value) : undefined;
    if (this._selectionBg === parsed) {
      return;
    }

    this._selectionBg = parsed;
    if (this.layoutCodeRenderable) {
      this.layoutCodeRenderable.selectionBg = parsed;
    }
    if (this.visibleCodeRenderable) {
      this.visibleCodeRenderable.selectionBg = parsed;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.selectionBg = parsed;
    }
    this.applyVisibleSelection();
  }

  public get selectionFg(): RGBA | undefined {
    return this._selectionFg;
  }

  public set selectionFg(value: string | RGBA | undefined) {
    const parsed = value ? parseColor(value) : undefined;
    if (this._selectionFg === parsed) {
      return;
    }

    this._selectionFg = parsed;
    if (this.layoutCodeRenderable) {
      this.layoutCodeRenderable.selectionFg = parsed;
    }
    if (this.visibleCodeRenderable) {
      this.visibleCodeRenderable.selectionFg = parsed;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.selectionFg = parsed;
    }
    this.applyVisibleSelection();
  }

  public get fg(): RGBA | undefined {
    return this._fg;
  }

  public set fg(value: string | RGBA | undefined) {
    const parsed = value ? parseColor(value) : undefined;
    if (this._fg === parsed) {
      return;
    }

    this._fg = parsed;
    if (this.visibleCodeRenderable) {
      this.visibleCodeRenderable.fg = parsed;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.fg = parsed;
    }
  }

  public get filetype(): string | undefined {
    return this._filetype;
  }

  public set filetype(value: string | undefined) {
    if (this._filetype === value) {
      return;
    }

    this._filetype = value;
    this.cachedSliceSignature = "";
    this.rebuildUnifiedSlice(true);
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.filetype = value;
    }
  }

  public get syntaxStyle(): SyntaxStyle | undefined {
    return this._syntaxStyle;
  }

  public set syntaxStyle(value: SyntaxStyle | undefined) {
    if (this._syntaxStyle === value) {
      return;
    }

    this._syntaxStyle = value;
    this.cachedSliceSignature = "";
    this.rebuildUnifiedSlice(true);
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.syntaxStyle = value;
    }
  }

  public get showLineNumbers(): boolean {
    return this._showLineNumbers;
  }

  public set showLineNumbers(value: boolean) {
    if (this._showLineNumbers === value) {
      return;
    }

    this._showLineNumbers = value;
    this.cachedWrapWidth = -1;
    this.cachedSliceSignature = "";
    if (this.visibleSide) {
      this.visibleSide.showLineNumbers = value;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.showLineNumbers = value;
    }
    this.rebuildUnifiedSlice(true);
  }

  public get lineNumberFg(): RGBA {
    return this._lineNumberFg;
  }

  public set lineNumberFg(value: string | RGBA) {
    const parsed = parseColor(value);
    if (this._lineNumberFg === parsed) {
      return;
    }

    this._lineNumberFg = parsed;
    if (this.visibleSide) {
      this.visibleSide.fg = parsed;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.lineNumberFg = parsed;
    }
  }

  public get lineNumberBg(): RGBA {
    return this._lineNumberBg;
  }

  public set lineNumberBg(value: string | RGBA) {
    const parsed = parseColor(value);
    if (this._lineNumberBg === parsed) {
      return;
    }

    this._lineNumberBg = parsed;
    this.cachedSliceSignature = "";
    if (this.visibleSide) {
      this.visibleSide.bg = parsed;
    }
    if (this.fallbackDiffRenderable) {
      this.fallbackDiffRenderable.lineNumberBg = parsed;
    }
    this.rebuildUnifiedSlice(true);
  }
}
