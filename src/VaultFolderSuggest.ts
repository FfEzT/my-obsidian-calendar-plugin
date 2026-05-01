import { AbstractInputSuggest, App } from "obsidian"

export type VaultFolderPickHandler = (path: string, evt: MouseEvent | KeyboardEvent) => void

export class VaultFolderSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly folders: string[],
    private readonly onPick?: VaultFolderPickHandler,
  ) {
    super(app, inputEl)
    this.limit = 100
  }

  getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase()
    if (!q)
      return this.folders.slice(0, this.limit)
    const filtered = this.folders.filter(
      f => f.toLowerCase().includes(q),
    )
    return filtered.slice(0, this.limit)
  }

  renderSuggestion(path: string, el: HTMLElement): void {
    el.setText(path)
  }

  selectSuggestion(path: string, evt: MouseEvent | KeyboardEvent): void {
    this.setValue(path)
    this.onPick?.(path, evt)
    this.close()
  }
}
