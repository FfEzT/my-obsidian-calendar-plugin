import { App, Notice, TFile } from "obsidian";
import MyPlugin from "./main";
import { CalendarEvent, IEvent, IPage, ITasks } from "./types";
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

  public async changePropertyFile(path: string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
          const property_ = CalendarEventToIDate(event)

          property['date']      = property_['date'].toISOString().slice(0,-14)

          if (property['timeStart'] && property['duration']
            && !property_['timeStart'] && !property_['duration']) {
            property['timeStart'] = property_['timeStart']
            // property['duration']  = property_['duration']
          }
          else {
            property['timeStart'] = property_['timeStart']
            property['duration']  = property_['duration']
          }
      }
    )
  }

  public async changeStatusFile(path: string, status: string) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
          property['status'] = status
      }
    )
  }

  public async changeTickFile(path: string, tickname:string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile

    // ! мб, поменять с использованием другой либы (см. плагин другой с видоса YouTube)
    const text = await this.app.vault.read(tFile)
    const property = CalendarEventToIDate(event)
    const date = property["date"].toISOString().slice(0,-14)

    const regExp = new RegExp(`\\[t::\\s*${tickname}(,[^\\]]*|)\\]`, "gm")

    const newString = `[t::${tickname},${date},${property["timeStart"]},${property['duration']}]`

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
    let result: IPage = {
      file: {
        path: "",
        name: ""
      },
      date: new Date,
      timeStart: null,
      duration: null,
      ticks: []
    }

    // const tFile = app.vault.getFileByPath(file.path) as TFile
    const ticks = getTicksFromText(await this.app.vault.cachedRead(file))

    // TODO эту надо оптимизировать
    await this.app.fileManager.processFrontMatter(
      file,
      property => {
        const page = {
        file: {
          path: file.path,
          name: file.basename
        },
        ticks,
        ...property
        }

        const duration = dv.duration(property.duration)
        // NOTE если убрать это, то не будет случай с FORMAT_DEFAULT_ADD
        if (duration)
          page.duration = duration

        page.timeStart = dv.duration(property.timeStart)
        page.date = dv.date(property.date)

        result = page
      }
    )

    return result
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
