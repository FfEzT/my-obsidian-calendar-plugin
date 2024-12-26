// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, Platform, WorkspaceLeaf } from 'obsidian';
import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView, VIEW_TYPE } from "./view"
import { Cache } from "./cache"
import { IPluginSettings } from './types';
import { MySettingTab } from './setting';
import { DEFAULT_SETTINGS, EVENT_SRC, CACHE_ID } from './constants';
import StatusCorrector from './statusCorrector';
import FileManager from './fileManager';


// TODO to constants
const MSG_PLG_NAME = "MyCalendar: "

export default class MyPlugin extends Plugin {
  public cache = new Cache(this)
  public fileManager = new FileManager(this)

  public async onload() {
    await this.loadSettings()

    if (this.settings.withStatusCorrector) {
      this.statusCorrector = new StatusCorrector(CACHE_ID.STATUS_CORRECTOR, [EVENT_SRC], this)

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
        (leaf: WorkspaceLeaf) => new CalendarView(leaf, CACHE_ID.CALENDAR, [EVENT_SRC], this) // TODO EVENT_SRC брать из настроек
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

    this.initRegister()
  }

  public onunload() {
    if (this.settings.withStatusCorrector)
      this.statusCorrector.destroy()
  }

  public createNotice(str: string) {
    new Notice(MSG_PLG_NAME + str)
  }

  public async saveSettings() {
    await this.saveData(this.settings);
  }


  private statusCorrector: StatusCorrector

  private settings: IPluginSettings

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

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addSettingTab(new MySettingTab(this.app, this));
  }
}
