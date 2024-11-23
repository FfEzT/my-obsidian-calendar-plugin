import { Notice } from "obsidian"
import { TEXT_BLOCKED, TEXT_DONE, TEXT_SOON, EVENT_SRC, TEXT_IN_PROGRESS, TEXT_CHILD_IN_PROGRESS } from "./constants"
import MyPlugin from "./main"
import { IPage } from "./types"
import { getNotesWithoutParent, isNotDone, isStarted, getParentNote, getChildNotePaths } from "./util"

export default class StatusCorrector {
  private parent: MyPlugin
  private idForCache: number
  private event_src: string[]

  constructor(idForCache: number, event_src: string[], parrentPointer: MyPlugin) {
    this.parent = parrentPointer
    this.idForCache = idForCache
    this.event_src = event_src

    this.parent.cache.subscribe(this.idForCache, this.event_src, this)
    // TODO добавить флаг в настройки (типа запускать ли чекер при загрузке)
    .then(
      () => this.correctAllNotes()
    )
  }

  private async correctNote(page: IPage): Promise<boolean> {
    let status = page.status
    if (!status)
      return false

    checkProgress: {
      if (status == TEXT_DONE && await isNotDone(page)) {
        status = TEXT_IN_PROGRESS
      }
      else if (status == TEXT_SOON && await isStarted(page)) {
        status = TEXT_BLOCKED
      }
      // TODO проверка, что все задачи на нуле, то ставим not started (если до этого было не soon)
    }

    checkDate: {
      const checks = [TEXT_SOON, TEXT_BLOCKED, TEXT_CHILD_IN_PROGRESS]
      if (page.date && checks.indexOf(status as string) != -1) {
        status = TEXT_IN_PROGRESS
      }
    }

    checkStatus: {
      const child_ = await getChildNotePaths(page.file.path)
      const statuses: string[] = new Array

      for (let children_ of child_) {
        const children = (this.parent.cache.getPage(children_) as IPage)

        if (!children?.status)
          continue
        
        statuses.push(children.status)
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
    if (status == page.status)
      return false

    page.status = status
    await this.parent.changeStatusFile(page.file.path, status)

    return true
  }

  public async correctAllNotes() {
    const notice = new Notice(
      "StatusCorrector: Start checking notes",
      1000 * 60 // 60 seconds
    )

    const queuePaths: string[] = []
    const set = new Set<string>()

    const parents = await getNotesWithoutParent(EVENT_SRC)
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
      notice.setMessage(`StatusCorrector: ${i}/${queuePaths.length}`)

      await this.correctNote(
        this.parent.cache.getPage(
          queuePaths[pointer]
        ) as IPage
      )
    }

    notice.setMessage("StatusCorrector: Notes has been checked")
    setTimeout(
      () => notice.hide(),
      3000
    )

  }

  public destroy() {
    this.parent.cache.unsubscribe(this.idForCache)
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
      const page = this.parent.cache.getPage(path) as IPage
      const oldStatus = page.status

      const isChanged = await this.correctNote(page)
      if (!isChanged && page.status == oldPage.status)
        continue
      
      new Notice(
        `${page.file.name} - change status: ${oldStatus} => ${page.status}`
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
