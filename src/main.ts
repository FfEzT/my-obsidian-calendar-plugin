import { App, Plugin, PluginManifest, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView} from "./views/CalendarView"
import { Cache } from "./cache"
import { PluginSettings, Src } from './types';
import { MySettingTab } from './setting';
import { DEFAULT_SETTINGS, CACHE_ID, MSG_PLG_NAME, VIEW_TYPE } from './constants';
import StatusCorrector from './views/StatusCorrector';
import { TickChecker } from './views/TickCheker';
import NoteManager from './NoteManager';
import { VaultOps } from './vaultOps';


export default class MyPlugin extends Plugin {
  private noteManager: NoteManager

  private cache: Cache

  private statusCorrector: StatusCorrector

  private settings: PluginSettings

  private tickChecker: TickChecker | void

  private calendar: CalendarView | void

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)

    const noteManager = new NoteManager(
      this.app.vault,
      this.app.metadataCache,
      this.app.fileManager,
      this.app.workspace
    )
    this.noteManager = noteManager

    this.cache = new Cache(this.noteManager, this.app.vault)
  }

  public async onload() {
    await this.loadSettings()

    this.initRegister()

    const src: Src[] = []
    for (let i of this.settings.source.noteSources) {
      const tmp = Src.fromSrcJson(i)
      if (tmp)
        src.push(tmp)
    }

    this.tickChecker = new TickChecker(
      CACHE_ID.TICK_CHECKER,
      src,
      this.cache,
      this.noteManager
    )

    if (this.settings.statusCorrector.isOn) {
      this.statusCorrector = new StatusCorrector(
        CACHE_ID.STATUS_CORRECTOR,
        src,
        this.cache,
        this.noteManager
      )

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

    this.app.workspace.onLayoutReady(() => this.init())

    this.registerView(
        VIEW_TYPE,
        (leaf: WorkspaceLeaf) => {
          this.calendar = new CalendarView(
            leaf,
            CACHE_ID.CALENDAR,
            src,
            this.settings.calendar,
            this.cache,
            this.noteManager,
            this.settings.source.defaultCreatePath
          )

          return this.calendar
        }
    )

    this.addRibbonIcon("calendar-range", MSG_PLG_NAME + "Open Calendar", () => this.activateView())

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

    // if (this.settings?.statusCorrector.isOn)
      this.statusCorrector?.destroy()
  }

  private async init() {
    await this.cache.init()

    this.tickChecker?.init()
    this.statusCorrector?.init()
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

  public getSettings(): PluginSettings {
    // NOTE: full copy
    return JSON.parse(
      JSON.stringify(this.settings)
    )
  }

  public async saveSettings(settings: PluginSettings) {
    this.settings = settings
    await this.saveData(this.settings);
  }



  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    // settings.source.noteSources = settings.source.noteSources.map(
    //   (el:any) => {
    //     const res = new Src(el.path)
    //     for (let i of el.excludes) {
    //       res.addExcludes(i)
    //     }

    //     return res
    //   }
    // )


    this.addSettingTab(
      new MySettingTab(
        this.app,
        this,
        new VaultOps(this.app.vault)
      )
    );
  }
}
