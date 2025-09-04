import { App, Notice } from "obsidian";
import MyPlugin from "../main";
import { IPage, ISubscriber, Src } from "../types"
import { MSG_PLG_NAME } from "../constants";
import { safeParseInt } from "../util";
import { Cache } from "src/cache";
import NoteManager from "src/NoteManager";

export class TickChecker implements ISubscriber {
  private parent: MyPlugin

  private idForCache: number

  private cache: Cache

  private eventSrc: Src[]

  private noteManager: NoteManager


  constructor(idForCache: number, eventSrc: Src[], cache: Cache, noteManager: NoteManager) {
    this.cache = cache
    this.idForCache = idForCache
    this.eventSrc = eventSrc
    this.noteManager = noteManager
  }

  public async init() {
    const data = await this.cache.subscribe(this.idForCache, this.eventSrc, this)

    const calcs = data.map(
      el => this.process(el)
    )
    await Promise.all(calcs)

    this.cache.unsubscribe(this.idForCache)
  }


  private async process(page: IPage) {
    for (let tick of page.ticks) {
      if ( isNaN(safeParseInt(tick.name)) )
        continue


      let text = await this.noteManager.getText(page.file.path)
      const regExp = new RegExp(`\\[t::\\s*${tick.name}(,[^\\]]*|)\\]`, "gm")

      await this.noteManager.setText(
        page.file.path,
        text.replace(regExp, `[t::${tick.name}_$1]`)
      )

      new Notice(`${MSG_PLG_NAME}: change tickname in ${page.file.name}: ${tick.name}`)
    }

  }

  renameFile(newPage: IPage, oldPage: IPage): void {}
  deleteFile(page: IPage): void {}
  addFile(page: IPage): void {}
  changeFile(newPage: IPage, oldPage: IPage): void {}
  reset(): void {}

}
