import MyPlugin from "./main"
import { TAbstractFile, TFile } from "obsidian"
import { IPage, MyView } from "./types"
import { getPage, isEqualObj } from "./util"


export class Cache {
  private parrentPointer: MyPlugin

  private storage = new Map<string, IPage>()
  private subscribers = new Map<string, MyView>()

  constructor(parrentPointer: MyPlugin) {
    this.parrentPointer = parrentPointer

    this.parrentPointer.app.workspace.onLayoutReady(() => this.initStorage())
  }

  public subscribe(path: string, subscriber: MyView): IPage[] {
    this.subscribers.set(path, subscriber)

    const result = []
    for (let [key, value] of this.storage) {
      if (!key.startsWith(path))
        continue
      result.push(value)
    }
    return result
  }

  public unsubscribe(path: string) {
    this.subscribers.delete(path)
  }

  public renameFile(file: TFile, oldPath: string) {
    const oldPage = this.storage.get(oldPath) as IPage

    // NOTE типа это ссылочные объекты
    const page = {...oldPage}
    page.file = {...oldPage.file}
    page.file.path = file.path
    page.file.name = file.basename

    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.renameFile(page, oldPage)
    }

    this.storage.delete(oldPath)
    this.storage.set(file.path, page)
  }

  public async addFile(file: TFile) {
    const page = await getPage(file, this.parrentPointer.app.metadataCache)
    this.storage.set(file.path, page)

    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.addFile(page)
    }
  }

  public async changeFile(file: TFile) {
    const page = await getPage(file, this.parrentPointer.app.metadataCache)
    const oldPage = this.storage.get(file.path) as IPage
    if (isEqualObj(page, oldPage))
      return

    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.changeFile(page, oldPage)
    }

    this.storage.set(file.path, page)
  }

  public deleteFile(file: TAbstractFile) {
    const page = this.storage.get(file.path) as IPage
    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.deleteFile(page)
    }
    this.storage.delete(file.path)
  }

  // TODO добавить это в настройки
  public async reset() {
    this.storage.clear()
    this.subscribers.clear()
    await this.initStorage()

    for (let [_, view] of this.subscribers)
      view.reset()
  }

  private async initStorage() {
    const tFiles = this.parrentPointer.app.vault.getMarkdownFiles()
    for (let tFile of tFiles) {
      this.storage.set(
        tFile.path,
        await getPage(tFile, this.parrentPointer.app.metadataCache)
      )
    }
  }
}