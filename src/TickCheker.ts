import { App, Notice } from "obsidian";
import MyPlugin from "./main";
import { IPage } from "./types"
import { MSG_PLG_NAME } from "./constants";
import { safeParseInt } from "./util";

export class TickChecker {
  private parent: MyPlugin

  private idForCache: number


  constructor(idForCache: number, event_src: string[], ptr: MyPlugin) {
    this.parent = ptr
    this.idForCache = idForCache

    this.parent.cache.subscribe(idForCache, event_src, this)
      .then(data => this.process(data))
  }


  private async process(pages: IPage[]) {
    console.log(pages)
    for (let page of pages) {
      for (let tick of page.ticks) {
        if ( isNaN(safeParseInt(tick.name)) )
          continue


        let text = await this.parent.fileManager.getText(page.file.path)
        const regExp = new RegExp(`\\[t::\\s*${tick.name}(,[^\\]]*|)\\]`, "gm")

        await this.parent.fileManager.setText(
          page.file.path,
          text.replace(regExp, `[t::${tick.name}_$1]`)
        )

        new Notice(MSG_PLG_NAME + `change tickname in ${page.file.name}: ${tick.name}`)
      }
    }

    this.parent.cache.unsubscribe(this.idForCache)
  }

  renameFile(newPage: IPage, oldPage: IPage): void {}
  deleteFile(page: IPage): void {}
  addFile(page: IPage): void {}
  changeFile(newPage: IPage, oldPage: IPage): void {}
  reset(): void {}

}
