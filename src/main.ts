// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, Platform, WorkspaceLeaf } from 'obsidian';
import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView, VIEW_TYPE } from "./view"
import { Cache } from "./cache"
import { dv, CalendarEventToIDate, getTicksFromText } from './util';
import { CalendarEvent, IPage, IEvent, IPluginSettings } from './types';
import { MySettingTab } from './setting';
import { DEFAULT_SETTINGS } from './constants';

export default class MyPlugin extends Plugin {
  public cache = new Cache(this)

  private settings: IPluginSettings

  public async onload() {
      await this.loadSettings();
      this.addSettingTab(new MySettingTab(this.app, this));

      this.registerView(
          VIEW_TYPE,
          (leaf: WorkspaceLeaf) => new CalendarView(leaf, this)
      )

      this.addRibbonIcon("info", "Open Calendar", () => this.activateView())
      this.addCommand({
        id: 'reset-cache',
        name: 'Reset Cache',
        callback: () => {
          this.cache.reset()
        }
      });

      this.initRegister()
  }

  public onunload() {}

  // TODO это можно в новый класс вывести (который работает с файлами)
  public async createFile(path: string) {
    // NOTE это отправит сигнал cache
    await this.app.vault.create(path,'')
    new Notice("Created " + path)
  }

  // TODO это можно в новый класс вывести (который работает с файлами)
  public async changePropertyFile(path: string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
          const property_ = CalendarEventToIDate(event)

          property['date']      = property_['date'].toISOString().slice(0,-14)
          property['timeStart'] = property_['timeStart']
          property['duration']  = property_['duration']
      }
    )
  }

  // TODO это можно в новый класс вывести (который работает с файлами)
  public async changeTickFile(path: string, tickname:string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile

    // ! мб, поменять с использованием другой либы (см. плагин другой с видоса YouTube)
    const text = await this.app.vault.read(tFile)
    const property = CalendarEventToIDate(event)
    const date = property["date"].toISOString().slice(0,-14)

    const regExp = new RegExp(`\\[t::\\s*${tickname},.*\]`, "gm")
    const newString = `[t::${tickname},${date},${property["timeStart"]},${property['duration']}]`
    await this.app.vault.modify(
      tFile,
      text.replace(regExp, newString)
    )
  }

  // TODO это можно в новый класс вывести (который работает с файлами)
  public openNote(event: IEvent) {
    // NOTE сначала проверяет тик ли это, а потом переходит к id
    const tFile = this.app.metadataCache.getFirstLinkpathDest(
      event?.extendedProps?.notePath || event.id, ''
    )
  
    // false = open in the current tab
    const leaf = this.app.workspace.getLeaf(true)
    tFile && leaf.openFile(tFile)
  }

  // TODO это можно в новый класс вывести (который работает с файлами)
  async getPage(file: TFile): Promise<IPage> {
    let result: IPage = {
      file: {
        path: "",
        name: ""
      },
      date: new Date,
      timeStart: null,
      duration: null,
      ticks: []
    }

    // const tFile = app.vault.getFileByPath(file.path) as TFile
    const ticks = getTicksFromText(await this.app.vault.read(file))

    // TODO эту надо оптимизировать
    await this.app.fileManager.processFrontMatter(
      file,
      property => {
        const page = {
        file: {
          path: file.path,
          name: file.basename
        },
        ticks,
        ...property
        }

        const duration = dv.duration(property.duration)
        // ! если убрать это, то не будет случай с FORMAT_DEFAULT_ADD
        if (duration)
          page.duration = duration

        page.timeStart = dv.duration(property.timeStart)
        page.date = dv.date(property.date)

        result = page
      }
    )

    return result
  }

  public async saveSettings() {
    await this.saveData(this.settings);
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

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
}
