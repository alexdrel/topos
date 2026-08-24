import type { EditorModel } from "./model.ts";

/**
 * Source history for hosts that do not have VS Code's text buffer.
 * Undo and redo deliberately return through `syncDocumentSource()`, just as
 * VS Code sends the model an updated complete document.
 */
export class EditorHistory {
  private entries: string[] = [];
  private index = -1;

  constructor(private readonly model: EditorModel, private readonly limit = 100) {
    model.subscribe((_, event) => {
      if (event === undefined || event.commit) this.push(model.document.source);
    });
  }

  updateSource(source: string): void {
    this.model.syncDocumentSource(source);
  }

  commitSource(): void {
    this.push(this.model.document.source);
  }

  undo(): void {
    if (!this.canUndo) return;
    this.model.syncDocumentSource(this.entries[--this.index]);
  }

  redo(): void {
    if (!this.canRedo) return;
    this.model.syncDocumentSource(this.entries[++this.index]);
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  private push(source: string): void {
    if (this.entries[this.index] === source) return;
    this.entries.splice(this.index + 1);
    this.entries.push(source);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }
}
