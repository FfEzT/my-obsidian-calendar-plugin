import MyPlugin from "./main"
import { TAbstractFile, TFile } from "obsidian"
import { IPage, MyView } from "./types"
import { isEqualObj } from "./util"


export class Cache {
  private parrentPointer: MyPlugin

  private storage = new Map<string, IPage>()
  private subscribers = new Map<string, MyView>()

  private initSync: Promise<void> = new Promise(
    resolve => this.initSyncResolve = resolve
  )
  private initSyncResolve: any
  private isInited = false

  constructor(parrentPointer: MyPlugin) {
    this.parrentPointer = parrentPointer

    this.parrentPointer.app.workspace.onLayoutReady(() => this.initStorage())
  }

  public async subscribe(path: string, subscriber: MyView): Promise<IPage[]> {

    this.subscribers.set(path, subscriber)

    if (!this.isInited)
      await this.initSync

    const result = []
    for (let [key, value] of this.storage) {
      if (!key.startsWith(path))
        continue
      result.push(value)
    }
    return result
  }

  // TODO по идее если много раз нажимать на кнопку активации
  // не будет вызываться unsubscribe
  // здесь это не критично, но будет бобо, если будет несколько views
  public unsubscribe(path: string) {
    this.subscribers.delete(path)
  }

  public renameFile(file: TFile, oldPath: string) {
    if (!this.isInited)
      return

    const oldPage = this.storage.get(oldPath) as IPage

    // NOTE типа это ссылочные объекты
    const page = {...oldPage}
    page.file = {...oldPage.file}
    page.file.path = file.path
    page.file.name = file.basename

    for (let [path, view] of this.subscribers) {
      if (file.path.startsWith(path) && oldPath.startsWith(path))
        view.renameFile(page, oldPage)
      else if (oldPath.startsWith(path))
        view.deleteFile(oldPage)
      else if (file.path.startsWith(path))
        view.addFile(page)
    }

    this.storage.delete(oldPath)
    this.storage.set(file.path, page)
  }

  public async addFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.parrentPointer.getPage(file)
    this.storage.set(file.path, page)

    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.addFile(page)
    }
  }

  public async changeFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.parrentPointer.getPage(file)
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
    if (!this.isInited)
      return

    const page = this.storage.get(file.path) as IPage
    for (let [path, view] of this.subscribers) {
      if (!file.path.startsWith(path))
        continue

      view.deleteFile(page)
    }
    this.storage.delete(file.path)
  }

  public async reset() {
    this.isInited = false

    this.storage.clear()

    const tmp = this.subscribers
    this.subscribers = new Map()
    await this.initStorage()

    for (let [_, view] of tmp)
      view.reset()
  }

  private async initStorage() {
    const tFiles = this.parrentPointer.app.vault.getMarkdownFiles()
    for (let tFile of tFiles) {
      this.storage.set(
        tFile.path,
        await this.parrentPointer.getPage(tFile)
      )
    }

    this.isInited = true
    this.initSyncResolve()
  }
}
