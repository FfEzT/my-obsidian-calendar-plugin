import MyPlugin from "./main"
import { TAbstractFile, TFile } from "obsidian"
import { IPage, MyView, ISubscriber } from "./types"
import { isEqualObj } from "./util"

interface IPathSubscriber {
  paths: string[],
  subscriber: ISubscriber
}

export class Cache {
  private parrentPointer: MyPlugin

  private storage = new Map<string, IPage>()
  private subscribers = new Map<Number, IPathSubscriber>()

  private initSync: Promise<void> = new Promise(
    resolve => this.initSyncResolve = resolve
  )
  private initSyncResolve: (value: void | PromiseLike<void>) => void
  private isInited = false

  constructor(parrentPointer: MyPlugin) {
    this.parrentPointer = parrentPointer

    this.parrentPointer.app.workspace.onLayoutReady(() => this.initStorage())
  }

  public getPage(path: string): IPage|undefined {
    return this.storage.get(path)
  }

  public log() {
    console.log("storage", this.storage)
    console.log("subscribers", this.subscribers)
  }

  public async subscribe(id: Number, paths: Array<string>, subscriber: ISubscriber): Promise<IPage[]> {
    this.subscribers.set(
      id,
      {
        paths,
        subscriber
      }
    )

    if (!this.isInited)
      await this.initSync

    const result = []
    for (let [key, value] of this.storage) {
      for (let path of paths) {
        if (key.startsWith(path))
          result.push(value)
      }
    }
    return result
  }

  public unsubscribe(id: Number) {
    this.subscribers.delete(id)
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


    this.storage.delete(oldPath)
    this.storage.set(file.path, page)

    for (let [_, {paths, subscriber}] of this.subscribers) {
      for (let path of paths) {
        if (file.path.startsWith(path) && oldPath.startsWith(path))
          subscriber.renameFile(page, oldPage)
        else if (oldPath.startsWith(path))
          subscriber.deleteFile(oldPage)
        else if (file.path.startsWith(path))
          subscriber.addFile(page)
      }
    }
  }

  public async addFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.parrentPointer.getPage(file)
    this.storage.set(file.path, page)

    for (let [_, {paths, subscriber}] of this.subscribers) {
      for (let path of paths) {
        if (!file.path.startsWith(path))
          continue

        subscriber.addFile(page)
      }
    }
  }

  public async changeFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.parrentPointer.getPage(file)
    const oldPage = this.storage.get(file.path) as IPage
    if (isEqualObj(page, oldPage))
      return

    this.storage.set(file.path, page)

    for (let [_, {paths, subscriber}] of this.subscribers) {
      for (let path of paths) {
        if (!file.path.startsWith(path))
          continue

        subscriber.changeFile(page, oldPage)
      }
    }
  }

  public deleteFile(file: TAbstractFile) {
    if (!this.isInited)
      return

    const page = this.storage.get(file.path) as IPage

    this.storage.delete(file.path)
    for (let [_, {paths, subscriber}] of this.subscribers) {
      for (let path of paths) {
        if (!file.path.startsWith(path))
          continue

        subscriber.deleteFile(page)
      }
    }
  }

  public async reset() {
    this.isInited = false

    this.storage.clear()

    const tmp = this.subscribers
    this.subscribers = new Map()
    await this.initStorage()

    for (let [_, {subscriber}] of tmp)
      subscriber.reset()
  }

  private async initStorage() {
    const tFiles = this.parrentPointer.app.vault.getMarkdownFiles()
    for (let tFile of tFiles) {
      this.storage.set(
        tFile.path,
        await this.parrentPointer.getPage(tFile)
      )
    }

    this.initSyncResolve()
    this.isInited = true
  }
}
