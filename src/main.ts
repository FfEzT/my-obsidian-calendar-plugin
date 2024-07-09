// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, Platform, WorkspaceLeaf } from 'obsidian';
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { CalendarView, VIEW_TYPE } from "./view"
import { Cache } from "./cache"

export default class MyPlugin extends Plugin {
  public cache = new Cache(this)
  public calendar: CalendarView

  public async onload() {
      this.registerView(
          VIEW_TYPE,
          (leaf: WorkspaceLeaf) => {
            this.calendar = new CalendarView(leaf, this)
            return this.calendar
          }
      )

      this.addRibbonIcon("info", "Open Calendar", () => this.activateView())
      this.initRegister()
  }

  public onunload() {}

  private initRegister() {
    this.registerEvent(
      this.app.metadataCache.on("changed", file => {
        this.cache.changeFile(file)
      })
    )

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.cache.renameFile(file, oldPath)
      })
    )

    this.registerEvent(
      this.app.vault.on(
        "delete",
        file => {
          this.cache.deleteFile(file)
        }
      )
    )
  }

// TODO открытие в текущей вкладке
  private async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE)
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({
        type: VIEW_TYPE,
        active: true,
      })
    }
    else if (leaves.length === 1) {
      (leaves[0].view as CalendarView).onOpen()
      this.app.workspace.setActiveLeaf(leaves[0])
    }
    else for (let leaf of leaves)
      leaf.detach()
  }
}
