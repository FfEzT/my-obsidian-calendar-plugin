// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, Platform, WorkspaceLeaf } from 'obsidian';
import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView, VIEW_TYPE } from "./view"
import { Cache } from "./cache"
import { eventToIDate } from './util';
import { CalendarEvent } from './types';

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

  public async createFile(path: string) {
    // NOTE это отправит сигнал cache
    await this.app.vault.create(path,'')
    new Notice("Created " + path)
  }
  
  public async changePropertyFile(path: string, {start, end, allDay}: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
          const property_ = eventToIDate({start, end, allDay})

          property['date']      = property_['date'].toISOString().slice(0,-14)
          property['timeStart'] = property_['timeStart']
          property['duration']  = property_['duration']
      }
    )
  }

  public async changeTickFile(path: string, tickname:string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile

    // TODO мб, поменять с использованием другой либы (см. плагин другой с видоса YouTube)
    const text = await this.app.vault.read(tFile)
    const property = eventToIDate(event)
    const date = property["date"].toISOString().slice(0,-14)

    const regExp = new RegExp(`\\[t::\\s*${tickname},.*\]`, "gm")
    const newString = `[t::${tickname},${date},${property["timeStart"]},${property['duration']}]`
    await this.app.vault.modify(
      tFile,
      text.replace(regExp, newString)
    )
  }

  private initRegister() {
    this.registerEvent(
      this.app.metadataCache.on("changed", file => {
        this.cache.changeFile(file)
      })
    )

    this.registerEvent(
      this.app.vault.on(
        "rename",
        (file, oldPath) => {
          // проверка на то, что это файл, а не папка
          if (!(file as TFile).basename)
            return

          this.cache.renameFile(file as TFile, oldPath)
        }
      )
    )

    this.registerEvent(
      this.app.vault.on(
        "delete",
        file => this.cache.deleteFile(file)
      )
    )

    this.registerEvent(
      this.app.vault.on(
        "create",
        file => {
          // проверка на то, что это файл, а не папка
          if (!(file as TFile).basename)
            return

          this.cache.addFile(file as TFile)
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
