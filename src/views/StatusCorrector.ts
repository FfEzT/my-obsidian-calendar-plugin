import { Notice } from "obsidian"
import { TEXT_BLOCKED, TEXT_DONE, TEXT_SOON, TEXT_IN_PROGRESS, TEXT_CHILD_IN_PROGRESS, MSG_PLG_NAME } from "../constants"
import { IPage, ISubscriber, Src } from "../types"
import { getNotesWithoutParent, getParentNote, getChildNotePaths, getProgress } from "../util"
import { Cache } from "src/cache"
import NoteManager from "src/NoteManager"

export default class StatusCorrector implements ISubscriber {
  private cache: Cache

  private idForCache: number

  private eventSrc: Src[]

  private noteManager: NoteManager

  private subscribed = false
  private whileSubscribing = new Promise(
    (resolve) => this.resolveSubscribing = resolve
  )
  private resolveSubscribing: (value: void | PromiseLike<void>) => void

  constructor(idForCache: number, eventSrc: Src[], cache: Cache, noteManager: NoteManager) {
    this.cache = cache
    this.idForCache = idForCache
    this.eventSrc = eventSrc
    this.noteManager = noteManager
  }

  public async init() {
    await this.cache.subscribe(this.idForCache, this.eventSrc, this)

    this.subscribed = true
    this.resolveSubscribing()
  }

  private async correctNote(page: IPage): Promise<boolean> {
    let status = page.ff_status
    if (!status)
      return false

    checkProgress: {
      const tasks = await getProgress(this.cache, this.noteManager, page.file.path)
      if (status == TEXT_DONE && tasks.all > tasks.done) {
        status = TEXT_IN_PROGRESS
      }
      else if (status == TEXT_SOON && tasks.done != 0) {
        status = TEXT_BLOCKED
      }
      else if (status != TEXT_IN_PROGRESS && tasks.done == 0 && tasks.all != 0) {
        status = TEXT_SOON;
      }
    }

    checkDate: {
      const checks = [TEXT_SOON, TEXT_BLOCKED, TEXT_CHILD_IN_PROGRESS]
      if (page.ff_date && checks.indexOf(status as string) != -1) {
        status = TEXT_IN_PROGRESS
      }
    }

    checkStatus: {
      const child_ = await getChildNotePaths(page.file.path)
      const statuses: string[] = new Array

      for (let children_ of child_) {
        const children = (this.cache.getPage(children_) as IPage)

        if (!children?.ff_status)
          continue

        statuses.push(children.ff_status)
      }

      switch (status) {
        case TEXT_SOON: {
          if (statuses.indexOf(TEXT_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_CHILD_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_BLOCKED) != -1)
            status = TEXT_BLOCKED
          else if (statuses.indexOf(TEXT_DONE) != -1)
            status = TEXT_BLOCKED
          break
        }
        case TEXT_BLOCKED: {
          if (statuses.indexOf(TEXT_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_CHILD_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          break
        }
        case TEXT_CHILD_IN_PROGRESS: {
          status = TEXT_BLOCKED
          if (statuses.indexOf(TEXT_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_CHILD_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_DONE) != -1)
            status = TEXT_IN_PROGRESS
          break
        }
        case TEXT_DONE: {
          if (statuses.indexOf(TEXT_SOON) != -1)
            status = TEXT_BLOCKED
          else if (statuses.indexOf(TEXT_BLOCKED) != -1)
            status = TEXT_BLOCKED
          else if (statuses.indexOf(TEXT_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS
          else if (statuses.indexOf(TEXT_CHILD_IN_PROGRESS) != -1)
            status = TEXT_CHILD_IN_PROGRESS

          break
        }
        // case TEXT_BLOCKED: break
      }
    }
    if (status == page.ff_status)
      return false

    page.ff_status = status
    await this.noteManager.changeStatusFile(page.file.path, status)

    return true
  }

  public async correctAllNotes() {
    const notice = new Notice(
      MSG_PLG_NAME + ": Start checking status of notes",
      1000 * 60 // 60 seconds
    )

    if (!this.subscribed) {
      await this.whileSubscribing
    }

    const queuePaths: string[] = []
    const set = new Set<string>()

    // let parents = []
    const computes = []

    for (let el of this.eventSrc) {
      computes.push(
        getNotesWithoutParent(el.path)
      )
    }
    let parents_ = await Promise.all(computes)
    let parents = []
    for (let el of parents_) {
      parents.push(...el)
    }
    parents = parents.unique()
      .filter(
        el => this.eventSrc.some(src => src.isIn(el.file.path))
      )

    for (let parent of parents) {
      queuePaths.push(parent.file.path)
      set.add(parent.file.path)
    }

    for (let leftPointer = 0; leftPointer < queuePaths.length; ++leftPointer) {
      let path = queuePaths[leftPointer]

      const child = await getChildNotePaths(path)
      for (let children of child) {
        if (set.has(children))
          continue

        set.add(children)
        queuePaths.push(children)
      }
    }

    for (let pointer = queuePaths.length-1; pointer > 0; --pointer) {
      let i = queuePaths.length - pointer - 1
      notice.setMessage(`${MSG_PLG_NAME}(status) ${i}/${queuePaths.length}`)

      await this.correctNote(
        this.cache.getPage(
          queuePaths[pointer]
        ) as IPage
      )
    }

    notice.setMessage(MSG_PLG_NAME + ": Status of Notes has been checked")
    setTimeout(
      () => notice.hide(),
      3000
    )

    new Notice(`${MSG_PLG_NAME}: Notes has been checked`)
  }

  public destroy() {
    // TODO: при вызове завершать запуск statusCorrector

    this.cache.unsubscribe(this.idForCache)
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {}
  public deleteFile(page: IPage): void {}
  public reset(): void {}

  public async addFile(page: IPage) {
    await this.changeFile(page, page)
  }

  public async changeFile(page: IPage, oldPage: IPage) {
    const queuePaths: string[] = []
    const set = new Set<string>()

    queuePaths.push(page.file.path)
    set.add(page.file.path)

    for (let leftPointer = 0; leftPointer < queuePaths.length; ++leftPointer) {
      const path = queuePaths[leftPointer]
      const page = this.cache.getPage(path) as IPage
      const oldStatus = page.ff_status

      const isChanged = await this.correctNote(page)
      if (!isChanged && page.ff_status == oldPage.ff_status)
        continue

      new Notice(
        `${page.file.name} - change status: ${oldStatus} => ${page.ff_status}`
      )

      const child = await getParentNote(page)
      for (let children of child) {
        if (!children)
          continue

        const newPath = children.file.path
        if (set.has(newPath))
          continue

        set.add(newPath)
        queuePaths.push(newPath)
      }
    }
  }

}
