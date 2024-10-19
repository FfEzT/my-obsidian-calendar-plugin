import { TEXT_BLOCKED, TEXT_DONE, TEXT_NEW, TEXT_SOON, EVENT_SRC, TEXT_IN_PROGRESS, TEXT_CHILD_IN_PROGRESS } from "./constants"
import MyPlugin from "./main"
import { IPage } from "./types"
import { getNotesWithoutChild, isNotDone, isStarted, getParentNote, getChildNote } from "./util"

export default class StatusCorrector {
  private parent: MyPlugin
  private idForCache: number
  private event_src: string[]

  constructor(idForCache: number, event_src: string[], parrentPointer: MyPlugin) {
    this.parent = parrentPointer
    this.idForCache = idForCache
    this.event_src = event_src

    this.correctAllNotes()
    this.parent.cache.subscribe(this.idForCache, this.event_src, this)
  }

  // TODO refactor
  private async deepCorrectNote(page: IPage, queue: IPage[], set: Set<string>) {
    if (set.has(page.file.path))
      return
    set.add(page.file.path)

    const status = page.status

    if (status) {
      checkProgress: {
        if (status == TEXT_DONE && await isNotDone(page)) {
          // TODO заметке ставится in progress
        }
        else if (status == TEXT_NEW && !await isStarted(page)) {
          // TODO ставится in progress
        }
        // TODO проверка, что все задачи на нуле, то ставим not started (если до этого было не soon)
      }
      checkDate: {
        const checks = [TEXT_SOON, TEXT_BLOCKED, TEXT_NEW]
        if (page.date && checks.indexOf(page.status as string) ) {
          // TODO ставим in progress
        }
      }
      checkStatus: {
        const child = await getChildNote(page)
        for (let children of child) {
          if (!children.status || children.status == status)
            continue
          
          /*
          Р Д   Ставим Родителю
          1 1 -> ничего
          1 2 -> blocked
          1 3 -> not started
          1 4 -> child
          1 5 -> child
          1 6 -> ???

          2 1 -> ничего
          2 2 -> ничего
          2 3 -> child
          2 4 -> child
          2 5 -> child
          2 6 -> 

          3 1 ->
          3 2 ->
          3 3 ->
          3 4 ->
          3 5 ->
          3 6 ->

          4 1 ->
          4 2 ->
          4 3 ->
          4 4 ->
          4 5 ->
          4 6 ->

          5 1 ->
          5 2 ->
          5 3 ->
          5 4 ->
          5 5 ->
          5 6 ->

          6 1 ->
          6 2 ->
          6 3 ->
          6 4 ->
          6 5 ->
          6 6 ->
          */
          // TODO
        }
      }
    }
    const aga = await getParentNote(page)
    console.log(page.file.name) // ! delete
    console.log("added", aga) // ! delete

    queue.push(...aga)

  }

  // TODO для добавления в Command Pallete
  public async correctAllNotes() {
    const child = await getNotesWithoutChild(EVENT_SRC)
    const set = new Set<string>()

    while (1) {
      const children = child.shift()
      if (!children)
        break

      await this.deepCorrectNote(children, child, set)
    }
  }

  public destroy() {
    this.parent.cache.unsubscribe(this.idForCache)
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {}
  public deleteFile(page: IPage): void {}
  public reset(): void {}

  public addFile(page: IPage): void {
    // TODO
  }
  
  public changeFile(newPage: IPage, oldPage: IPage): void {
    // TODO
  }

}
