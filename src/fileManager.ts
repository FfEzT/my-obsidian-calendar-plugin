import { App, Notice, TFile } from "obsidian";
import MyPlugin from "./main";
import { IEvent, IPage, ITasks, IDate } from "./types";
import { CalendarEventToIDate, dv, getTicksFromText } from "./util";
import { MSG_PLG_NAME } from "./constants";

export default class FileManager {
  constructor(plg: MyPlugin) {
    this.app = plg.app
  }

  public async createFile(path: string) {
    await this.app.vault.create(path, '')
    new Notice(MSG_PLG_NAME + "created " + path)
  }

  public async changePropertyFile(path: string, event: IDate) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
        property['ff_date']      = event['ff_date'].toISOString().slice(0,-14)
        property['ff_timeStart'] = event['ff_timeStart']
        property['ff_duration']  = event['ff_duration']
      }
    )
  }

  public async changeStatusFile(path: string, status: string) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
        property['ff_status'] = status
      }
    )
  }

  public async changeTickFile(path: string, tickname:string, event: IDate) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile

    // ! мб, поменять с использованием другой либы (см. плагин другой с видоса YouTube)
    const text = await this.app.vault.read(tFile)
    const regExp = new RegExp(`\\[t::\\s*${tickname}(,[^\\]]*|)\\]`, "gm")

    const date = event["ff_date"].toISOString().slice(0,-14)
    const newString = `[t::${tickname},${date},${event["ff_timeStart"]},${event['ff_duration']}]`

    await this.app.vault.modify(
      tFile,
      text.replace(regExp, newString)
    )
  }

  public openNote(event: IEvent) {
    // NOTE сначала проверяет тик ли это, а потом переходит к id
    const tFile = this.app.metadataCache.getFirstLinkpathDest(
      event?.extendedProps?.notePath || event.id, ''
    )

    // false = open in the current tab
    const leaf = this.app.workspace.getLeaf(true)
    tFile && leaf.openFile(tFile)
  }

  public async getPage(file: TFile): Promise<IPage> {
    const result: IPage = {
      file: {
        path: file.path,
        name: file.basename
      },
      ticks: getTicksFromText(await this.app.vault.cachedRead(file)),
      ff_duration: "",
      ff_timeStart: "",
      ff_date: new Date,
    }

    const property = this.app.metadataCache.getFileCache(file)?.frontmatter
    if (!property) {
      // bad way, cause it may haven't expected fields
      return result
      // TODO throw Error("unreachable")
    }

    const added = {
      ff_duration: dv.duration(property.ff_duration),
      ff_timeStart: dv.duration(property.ff_timeStart),
      ff_date: dv.date(property.ff_date),
    }

    return {
      ...result,
      ...added
    }
  }

  public getTaskCount(page: IPage): ITasks {
    const result = {
      done: 0,
      all: 0
    }

    const tFile = this.app.vault.getFileByPath(page.file.path)

    if (!tFile)
      return result

    const items = this.app.metadataCache.getFileCache(tFile)?.listItems

    if (items) for (let item of items) {
      if (item.task == undefined)
        continue

      if (item.task == 'x') {
        ++result.done
      }
      ++result.all
    }

    return result
  }

  public async getText(path: string): Promise<string> {
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    const text = await this.app.vault.read(tFile)

    return text
  }

  public async setText(path: string, text: string) {
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile

    await this.app.vault.modify(tFile, text)
  }

  private app: App
}
