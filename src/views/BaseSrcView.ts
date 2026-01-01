import { ItemView, Platform, WorkspaceLeaf } from 'obsidian'
import { Src } from 'src/types'

export abstract class BaseSrcView extends ItemView {
  private selectedSrcPaths: Set<string> = new Set()

  private _eventSrc: Src[]

  constructor(leaf: WorkspaceLeaf, eventSrc: Src[]) {
    super(leaf)

    this._eventSrc = eventSrc
    for (let src of eventSrc) {
      this.selectedSrcPaths.add(src.path)
    }
  }

  protected renderSrcCheckboxes(srcCheckboxContainer: HTMLElement) {
    srcCheckboxContainer.empty()
    srcCheckboxContainer.addClass('src-checkboxes')

    const selectAllButton = srcCheckboxContainer.createEl('button', { text: 'Select All' })
    selectAllButton.addEventListener('click', async () => {
      for (let src of this._eventSrc) {
        this.selectedSrcPaths.add(src.path)
      }
      this.renderSrcCheckboxes(srcCheckboxContainer)
      await this.refreshView()
    })

    const selectNoneButton = srcCheckboxContainer.createEl('button', { text: 'Clear' })
    selectNoneButton.addEventListener('click', async () => {
      this.selectedSrcPaths.clear()
      this.renderSrcCheckboxes(srcCheckboxContainer)
      await this.refreshView()
    })

    for (let src of this._eventSrc) {
      const id = `src-checkbox-${this.getViewType()}-${src.path}`

      const checkboxContainer = srcCheckboxContainer.createDiv({ cls: 'src-checkbox-item' })

      const checkbox = checkboxContainer.createEl('input', {
        type: 'checkbox',
        attr: {
          id: id,
          checked: this.selectedSrcPaths.has(src.path) ? 'checked' : null,
        },
      })

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
          this.selectedSrcPaths.add(src.path)
        } else {
          this.selectedSrcPaths.delete(src.path)
        }
        await this.refreshView()
      })

      checkboxContainer.createEl('label', {
        text: src.path,
        attr: { for: id },
      })
    }
  }

  protected isPathInActiveSrc(pagePath: string): boolean {
    const eventSrc = this._eventSrc.filter(
      src => src.isIn(pagePath)
    )
    if (eventSrc.length == 0)
      return false

    const src = eventSrc.reduce(
      (prevSrc, curSrc) => {
        if (prevSrc.getFolderDepth() < curSrc.getFolderDepth())
          return curSrc

        return prevSrc
      },
      eventSrc[0]
    )

    return this.selectedSrcPaths.has(src.path)
  }

  protected get eventSrc() : Src[] {
    return this._eventSrc
  }

  protected abstract refreshView(): Promise<void>
}
