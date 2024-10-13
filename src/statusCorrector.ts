import { TEXT_BLOCKED, TEXT_DONE, TEXT_NEW, TEXT_SOON } from "./constants"
import MyPlugin from "./main"
import { IPage } from "./types"
import { dv } from "./util"

export default class StatusCorrector {
  private parent: MyPlugin
  private idForCache: number
  private event_src: string[]

  constructor(idForCache: number, event_src: string[], parrentPointer: MyPlugin) {
    this.parent = parrentPointer
    this.idForCache = idForCache
    this.event_src = event_src
  }

  // TODO refactor
  private deepCheckNote(page: IPage) {
    /*const status = page.status

    if (status) {
      checkProgress: {
        // TODO
        const progress = this.getProgress() // мб кэшировать прогресс, типа для каждого считать прогресс будет дорого

        if (progress == 1 && status != TEXT_DONE) {
          // TODO заметке ставится in progress
        }
        else if (progress != 0 && status == TEXT_NEW) {
          // TODO ставится in progress
        }
      }
      checkDate: {
        const checks = [TEXT_SOON, TEXT_BLOCKED, TEXT_NEW]
        if (page.date && checks.indexOf(page.status as string) ) {
          // TODO ставим in progress
        }
      }
    }*/

  }

  public async start() {
    const pages = await this.parent.cache.subscribe(this.idForCache, this.event_src, this)

    for (let page of pages)
      this.deepCheckNote(page)
  }

  public destroy() {
    // TODO unsibscribe from cache
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {}
  public deleteFile(page: IPage): void {}

  public addFile(page: IPage): void {
    // TODO
  }

  public changeFile(newPage: IPage, oldPage: IPage): void {
    // TODO
  }

  public reset(): void {
    // TODO
  }

  // private async checkAllNotes() {
  //   while (!dv.index.initialized)
  //     await sleep(1000)

  //   const child = dv.pages().where(
  //     (page: any) => !page.file.inlinks.length
  //   ).array()

  //   console.log(child)
  // }
}
