import { App, TFile } from "obsidian";
import MyPlugin from "./main";
import { CalendarEvent, IEvent, IPage } from "./types";
import { CalendarEventToIDate, dv, getTicksFromText } from "./util";

export default class FileManager {
  constructor(plg: MyPlugin) {
    this.app = plg.app
  }

  public async createFile(path: string) {
    await this.app.vault.create(path, '')
    this.parentPointer.createNotice("created " + path)
  }

  public async changePropertyFile(path: string, event: CalendarEvent) {
    // NOTE это отправит сигнал cache
    const tFile = this.app.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.app.fileManager.processFrontMatter(
      tFile,
      property => {
          const property_ = CalendarEventToIDate(event)

          property['date']      = property_['date'].toISOString().slice(0,-14)
          property['timeStart'] = property_['timeStart']
          property['duration']  = property_['duration']
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

  async getPage(file: TFile): Promise<IPage> {
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

  private parentPointer: MyPlugin
  private app: App
}
