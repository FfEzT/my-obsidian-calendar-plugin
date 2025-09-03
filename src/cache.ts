import MyPlugin from "./main"
import { Notice, TAbstractFile, TFile, Vault } from "obsidian"
import { IPage, ISubscriber, Src } from "./types"
import { isEqualObj } from "./util"
import FileManager from "./NoteManager"
import { MSG_PLG_NAME } from "./constants"
import NoteManager from "./NoteManager"

type IPathSubscriber = {
  paths: Src[],
  subscriber: ISubscriber
}

export class Cache {
  private noteManager: NoteManager

  private vault: Vault

  private storage = new Map<string, IPage>()
  private subscribers = new Map<Number, IPathSubscriber>()

  private initSync: Promise<void> = new Promise(
    resolve => this.initSyncResolve = resolve
  )
  private initSyncResolve: (value: void | PromiseLike<void>) => void
  private isInited = false

  constructor(noteManager: NoteManager, vault: Vault) {
    this.noteManager = noteManager
    this.vault = vault
  }

  public async init() {
    // NOTE u can init only one time
    if (this.isInited)
      return

    await this.initStorage()

    this.initSyncResolve()
    this.isInited = true
  }

  public getPage(path: string): IPage|undefined {
    return this.storage.get(path)
  }

  public log() {
    console.log("storage", this.storage)
    console.log("subscribers", this.subscribers)
  }

  public async subscribe(id: Number, paths: Src[], subscriber: ISubscriber): Promise<IPage[]> {
    this.subscribers.set(
      id,
      {
        paths,
        subscriber
      }
    )

    if (!this.isInited)
      await this.initSync

    const result: IPage[] = []
    for (let [key, value] of this.storage) {
      const isOk = paths.some(
        el => el.includes(key)
      )

      if (isOk) {
        result.push(value)
      }
    }

    return result
  }

  public unsubscribe(id: Number) {
    this.subscribers.delete(id)
  }

  public async renameFile(file: TFile, oldPath: string) {
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
      const isOk1 = paths.some( el => el.includes(file.path) )
      const isOk2 = paths.some( el => el.includes(oldPath) )

      for (let path of paths) {
        if (isOk1 && isOk2)
          subscriber.renameFile(page, oldPage)
        else if (isOk2)
          subscriber.deleteFile(oldPage)
        else if (isOk1)
          subscriber.addFile(page)
      }
    }
  }

  public async addFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.noteManager.getPage(file)
    this.storage.set(file.path, page)

    for (let [_, {paths, subscriber}] of this.subscribers) {
      const isOk = paths.some( el => el.includes(file.path) )

      if (isOk)
        subscriber.addFile(page)
    }
  }

  public async changeFile(file: TFile) {
    if (!this.isInited)
      return

    const page = await this.noteManager.getPage(file)
    const oldPage = this.storage.get(file.path) as IPage
    if (isEqualObj(page, oldPage))
      return

    this.storage.set(file.path, page)
    for (let [_, {paths, subscriber}] of this.subscribers) {
      const isOk = paths.some( el => el.includes(file.path) )

      if (isOk)
        subscriber.changeFile(page, oldPage)
    }
  }

  public async deleteFile(file: TAbstractFile) {
    if (!this.isInited)
      return

    const page = this.storage.get(file.path) as IPage

    this.storage.delete(file.path)
    for (let [_, {paths, subscriber}] of this.subscribers) {
      const isOk = paths.some( el => el.includes(file.path) )

      if (isOk)
        subscriber.deleteFile(page)
    }
  }

  public async reset() {
    this.isInited = false

    this.storage.clear()

    const tmp = this.subscribers
    this.subscribers = new Map()
    await this.init() // TODO что это делает

    for (let [_, {subscriber}] of tmp)
      subscriber.reset()
  }

  private async initStorage() {
    const tFiles = this.vault.getMarkdownFiles()

    const notice = new Notice(
      `${MSG_PLG_NAME}: there are ${tFiles.length} notes`,
      1000 * 60 // 60 seconds
    )

    for (let i in tFiles) {
      const tFile = tFiles[i]

      notice.setMessage(`${MSG_PLG_NAME}: (${i}/${tFiles.length}) added ${tFile.path}`)

      this.storage.set(
        tFile.path,
        await this.noteManager.getPage(tFile)
      )
    }

    notice.hide()
    new Notice(`${MSG_PLG_NAME}: cache has been inited`)
  }
}
