import { App, FileManager, MetadataCache, Notice, TFile, Vault, Workspace } from "obsidian";
import { IPage, ITasks, IDate } from "./types";
import { CalendarEventToIDate, dv, getTicksFromText } from "./util";
import { MSG_PLG_NAME } from "./constants";

export default class NoteManager {
  private vault: Vault

  private metadataCache: MetadataCache

  private fileManager: FileManager

  private workspace: Workspace

  constructor(
    vault: Vault,
    metadataCache: MetadataCache,
    fileManager: FileManager,
    workspace: Workspace
  ) {
    this.vault = vault
    this.metadataCache = metadataCache
    this.fileManager = fileManager
    this.workspace = workspace
  }

  public async createFile(path: string) {
    await this.vault.create(path, '')
    new Notice(MSG_PLG_NAME + "created " + path)
  }

  public async changePropertyFile(path: string, callback: ((properies: any) => void)) {
    // NOTE это отправит сигнал cache
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.fileManager.processFrontMatter(tFile, callback)
  }

  public async changeStatusFile(path: string, status: string) {
    // NOTE это отправит сигнал cache
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '') as TFile
    await this.fileManager.processFrontMatter(
      tFile,
      property => {
        property['ff_status'] = status
      }
    )
  }

  public async changeTickFile(path: string, tickname:string, event: IDate) {
    // NOTE это отправит сигнал cache
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '') as TFile

    // ! мб, поменять с использованием другой либы (см. плагин другой с видоса YouTube)
    const text = await this.vault.read(tFile)
    const regExp = new RegExp(`\\[t::\\s*${tickname}(,[^\\]]*|)\\]`, "gm")

    const date = event["ff_date"]?.toISOString().slice(0,-14)
    const newString = `[t::${tickname},${date},${event["ff_timeStart"]},${event['ff_duration']}]`

    await this.vault.modify(
      tFile,
      text.replace(regExp, newString)
    )
  }

  public openNote(path: string) {
    // NOTE сначала проверяет тик ли это, а потом переходит к id
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '')

    // false = open in the current tab
    const leaf = this.workspace.getLeaf(true)
    tFile && leaf.openFile(tFile)
  }

  public async getPage(file: TFile): Promise<IPage> {
    const result: IPage = {
      file: {
        path: file.path,
        name: file.basename
      },
      ticks: getTicksFromText(await this.vault.cachedRead(file)),
      ff_duration: "",
      ff_timeStart: ""
    }

    const property = this.metadataCache.getFileCache(file)?.frontmatter
    if (!property) {
      // bad way, cause it may haven't expected fields
      // TODO throw Error("unreachable")
      return result
    }

    const added = {
      ff_duration: dv.duration(property.ff_duration),
      ff_timeStart: dv.duration(property.ff_timeStart),
      ff_date: dv.date(property.ff_date)?.toJSDate(),
      ff_deadline: dv.date(property.ff_deadline)?.toJSDate()
    }

    return {
      ...result,
      ...property,
      ...added
    }
  }

  public getTaskCount(page: IPage): ITasks {
    const result = {
      done: 0,
      all: 0
    }

    const tFile = this.vault.getFileByPath(page.file.path)

    if (!tFile)
      return result

    const items = this.metadataCache.getFileCache(tFile)?.listItems

    if (items) for (let item of items) {
      if (item.task == undefined)
        continue

      if (item.task !== ' ') {
        ++result.done
      }
      ++result.all
    }

    return result
  }

  public async getText(path: string): Promise<string> {
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '') as TFile
    const text = await this.vault.read(tFile)

    return text
  }

  public async setText(path: string, text: string) {
    const tFile = this.metadataCache.getFirstLinkpathDest(path, '') as TFile

    await this.vault.modify(tFile, text)
  }

}
