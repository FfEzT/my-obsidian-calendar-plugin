// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, Platform, WorkspaceLeaf } from 'obsidian';
import { App, Notice, Plugin, PluginManifest, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView, VIEW_TYPE } from "./views/CalendarView"
import { Cache } from "./cache"
import { IPluginSettings } from './types';
import { MySettingTab } from './setting';
import { DEFAULT_SETTINGS, CACHE_ID, MSG_PLG_NAME } from './constants';
import StatusCorrector from './views/statusCorrector';
import FileManager from './fileManager';
import { TickChecker } from './views/TickCheker';


export default class MyPlugin extends Plugin {
  public fileManager: FileManager

  public cache: Cache

  private statusCorrector: StatusCorrector

  private settings: IPluginSettings

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)

    const fileManager = new FileManager(this)
    this.fileManager = fileManager

    // создавать при onload и тогда же запускать initStorage
    this.cache = new Cache(this, fileManager)
  }

  public async onload() {
    await this.loadSettings()

    this.initRegister()

    await new TickChecker(CACHE_ID.TICK_CHECKER, this.settings.source.noteSources, this)

    if (this.settings.statusCorrector.isOn) {
      this.statusCorrector = new StatusCorrector(CACHE_ID.STATUS_CORRECTOR, this.settings.source.noteSources, this)

      if (this.settings.statusCorrector.startOnStartUp)
        this.statusCorrector.correctAllNotes()

      this.addCommand({
        id: 'fullStatusCorrect',
        name: MSG_PLG_NAME + 'Full StatusCorrector',
        callback: () => {
          this.statusCorrector.correctAllNotes()
        }
      });
    }

    this.registerView(
        VIEW_TYPE,
        (leaf: WorkspaceLeaf) => new CalendarView(leaf, CACHE_ID.CALENDAR, this.settings.source.noteSources, this)
    )

    this.addRibbonIcon("info", MSG_PLG_NAME + "Open Calendar", () => this.activateView())

    this.addCommand({
      id: 'reset-cache',
      name: MSG_PLG_NAME + 'Reset Cache',
      callback: () => {
        this.cache.reset()
      }
    })
    this.addCommand({
      id: 'log-cache',
      name: MSG_PLG_NAME + 'Log Cache',
      callback: () => {
        this.cache.log()
      }
    });
  }

  public onunload() {
    // TODO как будто других не хватает destoy
    if (this.settings.statusCorrector.isOn)
      this.statusCorrector.destroy()
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

  private async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE)
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeaf(false);
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


  // Settings

  public getSettings(): IPluginSettings {
    // NOTE: full copy
    return JSON.parse(
      JSON.stringify(this.settings)
    )
  }

  public async saveSettings(settings: IPluginSettings) {
    this.settings = settings
    await this.saveData(this.settings);
  }



  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    this.addSettingTab(new MySettingTab(this.app, this));
  }
}
