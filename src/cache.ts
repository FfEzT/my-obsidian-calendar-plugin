import MyPlugin from "./main"
import { App, TAbstractFile, TFile } from "obsidian"
import { IPage } from "./types"
import { getPage } from "./util"
import { CalendarView } from "./view"


export class Cache {
  private app: App

  private parrentPointer: MyPlugin

  private storage = new Map<string, IPage>()
  private subscribers = new Map<string, CalendarView>()

  constructor(parrentPointer: MyPlugin) {
    this.parrentPointer = parrentPointer
    this.app = parrentPointer.app

    this.app.workspace.onLayoutReady(() => this.initStorage())
  }

  public subscribe(path: string, subscriber: CalendarView): IPage[] {
    this.subscribers.set(path, subscriber)

    const result = []
    for (let [key, value] of this.storage) {
      if (!key.startsWith(path))
        continue
      result.push(value)
    }
    return result
  }

  // TODO отправлять сигнал календарю
  public renameFile(file: TAbstractFile, oldPath: string) {
    const tmpNode = this.storage.get(oldPath)

    // TODO когда такое может быть и что с этим делать?
    if (!tmpNode)
      return

    tmpNode.file.path = file.path
    this.storage.delete(oldPath)
    this.storage.set(file.path, tmpNode)
  }

  // TODO отправлять сигнал календарю
  public changeFile(file: TFile) {
    getPage(file, this.app.metadataCache)
    .then(
      data => this.storage.set(file.path, data)
    )
  }

  // TODO отправлять сигнал календарю
  public deleteFile(file: TAbstractFile) {
    this.storage.delete(file.path)
  }

  // TODO отправлять сигнал календарю
  public reset() {
    this.storage.clear()
    this.initStorage()
  }

  private async initStorage() {
    const tFiles = this.app.vault.getMarkdownFiles()
    for (let tFile of tFiles) {
      this.storage.set(
        tFile.path,
        await getPage(tFile, this.app.metadataCache)
      )
    }
  }
}