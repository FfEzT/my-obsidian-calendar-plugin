import { App, Modal, Notice, Setting } from "obsidian"
import { Src, SrcJSON, SourceFolderPreset } from "./types"
import { MSG_PLG_NAME } from "./constants"
import { VaultOps } from "./vaultOps"
import { VaultFolderSuggest } from "./VaultFolderSuggest"

export type ISourceFoldersPluginApi = {
  getActiveFolders(): SrcJSON[]
  applyActiveFolders(sources: SrcJSON[]): Promise<void>
  getPresets(): SourceFolderPreset[]
  savePresets(presets: SourceFolderPreset[]): Promise<void>
}

function newPresetId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cloneFolders(f: SrcJSON[]): SrcJSON[] {
  return structuredClone(f)
}

function isAllowedSourceFolderPath(value: string, folders: string[]): boolean {
  const t = value.trim()
  if (t === "/")
    return true
  return folders.contains(value)
}

const BODY_CLASS_SUGGEST_ABOVE_MODAL = "my-cal-source-folders-suggest-top"

export class SourceFoldersModal extends Modal {
  private working: SrcJSON[] = []

  private presetRows: SourceFolderPreset[] = []

  private folderInputSuggests: VaultFolderSuggest[] = []

  constructor(
    app: App,
    private vaultOps: VaultOps,
    private api: ISourceFoldersPluginApi,
  ) {
    super(app)
  }

  async onOpen() {
    document.body.classList.add(BODY_CLASS_SUGGEST_ABOVE_MODAL)
    const { contentEl } = this
    contentEl.empty()
    this.titleEl.setText(`${MSG_PLG_NAME}: event source folders`)

    this.working = cloneFolders(this.api.getActiveFolders())
    this.presetRows = [...this.api.getPresets()]

    await this.renderBody(contentEl)
  }

  onClose(): void {
    this.deleteFolderSuggest()
    document.body.classList.remove(BODY_CLASS_SUGGEST_ABOVE_MODAL)
    super.onClose()
  }

  private deleteFolderSuggest(): void {
    for (const s of this.folderInputSuggests)
      s.close()
    this.folderInputSuggests.length = 0
  }


  private async renderBody(container: HTMLElement) {
    const folders = await this.vaultOps.getFoldersInVault()
    folders.unshift("/")

    container.empty()

    new Setting(container).setName("Folders").setHeading()
      .setDesc("Notes under these paths are loaded into Views. Use `/` for the whole vault (all folders).")

    const folderSection = container.createDiv({ cls: "my-cal-source-folders-list" })

    const renderFolderRows = () => {
      this.deleteFolderSuggest()
      folderSection.empty()
      for (let i = 0; i < this.working.length; i++) {
        const idx = i
        new Setting(folderSection)
          .setName(`Folder ${idx + 1}`)
          .addText(text => {
            text
              .setPlaceholder("Type to search folders…")
              .setValue(this.working[idx].path)
              .onChange(v => {
                if (v !== "" && !isAllowedSourceFolderPath(v, folders))
                  return
                this.working[idx] = { path: v, excludes: this.working[idx].excludes ?? [] }
              })
            const suggest = new VaultFolderSuggest(
              this.app,
              text.inputEl,
              folders,
              path => {
                if (!isAllowedSourceFolderPath(path, folders))
                  return
                this.working[idx] = { path, excludes: this.working[idx].excludes ?? [] }
              },
            )
            this.folderInputSuggests.push(suggest)
          })
          .addExtraButton(btn => {
            btn.setIcon("trash").setTooltip("Remove")
              .onClick(() => {
                if (this.working.length <= 1) {
                  new Notice(`${MSG_PLG_NAME}: keep at least one folder row`)
                  return
                }
                this.working.splice(idx, 1)
                renderFolderRows()
              })
          })
      }
    }

    renderFolderRows()

    new Setting(container).addButton(btn => {
      btn.setButtonText("Add folder row")
        .onClick(() => {
          this.working.push({ path: "", excludes: [] })
          renderFolderRows()
        })
    })

    new Setting(container).setName("Presets").setHeading()
      .setDesc("Save or load named folder sets.")

    const presetBlock = container.createDiv({ cls: "my-cal-source-presets" })

    const renderPresets = () => {
      presetBlock.empty()
      for (const pr of this.presetRows) {
        new Setting(presetBlock)
          .setName(pr.name)
          .addButton(b => b.setButtonText("Load").onClick(() => {
            this.working = cloneFolders(pr.noteSources)
            renderFolderRows()
            new Notice(`${MSG_PLG_NAME}: loaded preset "${pr.name}"`)
          }))
          .addButton(b => b.setButtonText("Delete").setWarning().onClick(async () => {
            this.presetRows = this.presetRows.filter(p => p.id !== pr.id)
            await this.api.savePresets(this.presetRows)
            renderPresets()
            new Notice(`${MSG_PLG_NAME}: preset removed`)
          }))
      }
      if (this.presetRows.length === 0) {
        presetBlock.createDiv({ text: "No presets yet.", cls: "setting-item-description" })
      }
    }

    renderPresets()

    let presetName = ""
    new Setting(container).setName("Save current folders as preset")
      .addText(t => t.setPlaceholder("preset name").onChange(v => { presetName = v.trim() }))
      .addButton(b => b.setButtonText("Save preset").onClick(async () => {
        if (!presetName) {
          new Notice(`${MSG_PLG_NAME}: enter a preset name`)
          return
        }
        const normalized = this.normalizeForApply(this.working)
        if (!normalized)
          return
        const existing = this.presetRows.find(p => p.name === presetName)
        if (existing) {
          existing.noteSources = cloneFolders(normalized)
        }
        else {
          this.presetRows.push({
            id: newPresetId(),
            name: presetName,
            noteSources: cloneFolders(normalized),
          })
        }
        await this.api.savePresets(this.presetRows)
        renderPresets()
        new Notice(`${MSG_PLG_NAME}: preset "${presetName}" saved`)
      }))

    new Setting(container).addButton(b => b.setButtonText("Apply to views").setCta()
      .onClick(async () => {
        const normalized = this.normalizeForApply(this.working)
        if (!normalized)
          return
        await this.api.applyActiveFolders(normalized)
        new Notice(`${MSG_PLG_NAME}: source folders updated`)
        this.close()
      }))

    new Setting(container).addButton(b => b.setButtonText("Cancel")
      .onClick(() => this.close()))
  }

  private normalizeForApply(rows: SrcJSON[]): SrcJSON[] | null {
    const out: SrcJSON[] = []
    for (const row of rows) {
      const path = row.path.trim()
      if (!path)
        continue
      const s = new Src(path)
      if (row.excludes?.length) {
        if (!s.addExcludes(row.excludes)) {
          new Notice(`${MSG_PLG_NAME}: invalid excludes for "${path}"`)
          return null
        }
      }
      out.push(s.toSrcJson())
    }
    if (out.length === 0) {
      new Notice(`${MSG_PLG_NAME}: add at least one non-empty folder path`)
      return null
    }
    return out
  }
}
