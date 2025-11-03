import { ItemView, WorkspaceLeaf } from 'obsidian';
import Gantt from 'frappe-gantt'
import { GANTT_VIEW_TYPE, GANTT_TAB_NAME, MillisecsInDay } from '../constants';
import {GanttSettings, IPage, ISubscriber, Src } from '../types';
import { CalendarEventToIDate, getBlockers as getBlockersPath, getColourFromPath, getProgress, IDateToCalendarEvent, millisecToString, templateIDTick, templateNameTick, throttle, timeAdd } from '../util';
import { Cache } from 'src/cache';
import NoteManager from 'src/NoteManager';

// TODO сделать папку

const DEFAULT_OFFSET_DAY = 14 // TODO 7 is constant

// TODO отображать ff_date для задачи

// TODO
const enumToCustomClass = {
  FULL: "full",
  ONLY_DEADLINE: 'only-deadline', // TODO gradient document
  ONLY_DO_DAYS: 'only-do-days', // TODO orange document
  NOTHING: 'nothing' // TODO red document
}

type IEvent = {
  id: string,
  name: string,
  start: Date,
  end: Date,
  progress: number, // progress in %
  dependencies: string,
  custom_class: string,
  extra: {
    path: string
  }
}

export class GanttView extends ItemView implements ISubscriber {
  static CONTAINER_ID = 'gantt'

  private cache: Cache

  private idForCache: number

  private eventSrc: Src[]

  private selectedSrcPaths: Set<string> = new Set()

  private noteManager: NoteManager

  // TODO зачем?
  private ganttSettings: GanttSettings

  private localStorage: Graph

  private gantt: Gantt

  constructor(
    leaf: WorkspaceLeaf,
    idForCache: number,
    eventSrc: Src[],
    ganttSettings: GanttSettings,
    cache: Cache,
    noteManager: NoteManager,
  ) {
    super(leaf)

    this.cache = cache
    this.idForCache = idForCache
    this.eventSrc = eventSrc
    this.noteManager = noteManager
    this.ganttSettings = ganttSettings

    this.localStorage = new Graph(cache, noteManager)

    for (let src of eventSrc) {
      this.selectedSrcPaths.add(src.path)
    }
  }

  public getViewType() {return GANTT_VIEW_TYPE}

  public getDisplayText() {return GANTT_TAB_NAME}

  public async onOpen() {
    const { containerEl } = this
    const container = containerEl.children[1]
    container.empty()

    // TODO DRY (calendar)
    const checkBoxContainer = container.createDiv({cls: 'gantt-src-checkboxes'})

    const htmlContainer = container.createDiv(/*{cls: 'class'}*/)

    this.renderSrcCheckboxes(checkBoxContainer)
    this.render(htmlContainer)
      // .then(
      //   () =>
      // )
  }

  // public onResize() {}

  public addFile(data: IPage): void {
    this.localStorage.addPage(data)

    this.localStorage
      .getEvents()
      .then(
        events => {
          events = events.filter(
            event => this.isPathInActiveSrc(event.id)
          )

          this.gantt.clear()
          this.gantt.refresh(events)
        }
      )
  }

  public changeFile(newPage: IPage, oldPage: IPage): void {
    this.localStorage.deletePage(oldPage)
    // TODO если изменяемая задача блокирует кого-либо, то потеряется связь
    this.localStorage.addPage(newPage)

    this.refresh()
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {
    this.changeFile(newPage, oldPage)
  }

  public deleteFile(page: IPage): void {
    this.localStorage.deletePage(page)

    this.refresh()
  }

  public reset() {
    this.onunload()
    this.onOpen()
  }

  onunload() { }

  private async refresh() {
    const events = await this.localStorage
      .getEvents()

    const events_ = events.filter(
        event => this.isPathInActiveSrc(event.id)
      )
    this.gantt.refresh(events_)
  }



  // TODO это повторяется в CalendarView надо черех ооп делать
  // TODO что будет, если ResetStorage
  private renderSrcCheckboxes(srcCheckboxContainer: HTMLElement) {
    srcCheckboxContainer.empty()
    srcCheckboxContainer.addClass("gantt-src-checkboxes")

    for (let src of this.eventSrc) {
      const checkboxContainer = srcCheckboxContainer!.createDiv({cls: 'src-checkbox-item'})

      const checkbox = checkboxContainer.createEl('input', {
        type: 'checkbox',
        attr: {
          id: `src-checkbox-${src.path}`,
          checked: this.selectedSrcPaths.has(src.path) ? 'checked' : null
        }
      })

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
          this.selectedSrcPaths.add(src.path)
        } else {
          this.selectedSrcPaths.delete(src.path)
        }
        await this.refresh()
      })

      checkboxContainer.createEl('label', {
        text: src.path,
        attr: {for: `src-checkbox-${src.path}`}
      })
    }
  }

  private isPathInActiveSrc(pagePath: string): boolean {
    const eventSrc = this.eventSrc.filter(
      el => this.selectedSrcPaths.has(el.path)
    )
    return eventSrc.some(
      src => src.isIn(pagePath)
    )
  }

  private async render(container: Element)  {
    container.id = GanttView.CONTAINER_ID

    const subscribedData = await this.cache.subscribe(this.idForCache, this.eventSrc, this)
    for (let page of subscribedData) {
      this.localStorage.addPage(page)
    }

    const events = await this.localStorage
      .getEvents().then(
        events => events.filter(
          event => this.isPathInActiveSrc(event.id)
        )
      )

    this.gantt = new Gantt(`#${GanttView.CONTAINER_ID}`, events, this.getGanttSettings())

  }

  private getGanttSettings() {
    const date = new Date
    date.setTime(date.getTime() - 7*MillisecsInDay)
    // const throttled_on_date_change = throttle(
    //   async (task: IEvent, start: Date, end: Date) => {
    //     await this.noteManager.changePropertyFile(
    //       task.extra.path,
    //       property => {
    //         property['ff_deadline'] = end.toISOString().slice(0,-14)
    //         property['ff_doDays'] = Math.floor(
    //           (end.getTime() - start.getTime()) / MillisecsInDay
    //         )
    //       }
    //     )
    //   },
    //   500
    // )

    // TODO смена тем
    // TODO перенести либу ганта себе в репо + пропатчить css-стили
    return {
      infinite_padding: false,
      move_dependencies: false,
      readonly: true,
      scroll_to: date,

      // on_mouseup: throttled_on_date_change,
      on_click: (event: IEvent) => {console.log(event); this.noteManager.openNote(event.extra.path);}
    }
  }
}


type GraphEvent = {
  id: string
  name?: string,
  doDays?: number,
  end?: Date,
}

type Node = {
  to: Node[]
  from: Node[]
  event: GraphEvent
}

class Graph {
  private hashTable: Map<string, Node> = new Map()

  private noteManager: NoteManager

  private cache: Cache

  constructor(cache: Cache, noteManager: NoteManager) {
    this.cache = cache
    this.noteManager = noteManager
  }

  public async getEvents(): Promise<IEvent[]> {
    const roots = this.getRoots()

    const res: IEvent[] = []

    for (let node of roots) {
      const events = await this.calcEvents([node])
      res.push(...events)
    }

    res.sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    )
    return res
  }

  public addPage(page: IPage) {
    const event = convertToEvent(page)

    let node = this.hashTable.get(event.id)
    if (node) {
      node.event = event
    }
    else {
      node = { event, to: [], from: [] } as Node
      this.hashTable.set(event.id, node)
    }

    const blockers = getBlockersPath(page.file.path).map(
      path => {
        const blockNode = this.hashTable.get(path)
        if (blockNode) {
          blockNode.to.push(node as Node)
          return blockNode
        }

        const blocker: Node = {
          event: {
            id: path,
          },
          to: [node as Node],
          from: []
        }
        this.hashTable.set(blocker.event.id, blocker)

        return blocker
      }
    )

    for (let blocker of blockers) {
      node.from.push(blocker)
    }

  }

  public deletePage(page: IPage) {
    this.hashTable.delete(page.file.path)

    for (let [key, val] of this.hashTable.entries()) {
      val.to   = val.to.filter(el => el.event.id != page.file.path)
      val.from = val.from.filter(el => el.event.id != page.file.path)
    }
  }

  private async calcEvents(history: Node[]): Promise<IEvent[]> {
    const { event, from, to } = history[0]
    if (!event.name) {
      console.error("unreachable") // TODO add exception
      event.name = 'null'
    }

    const children: IEvent[][] = await Promise.all(
      to.map(
        async (node) => await this.calcEvents([node, ...history])
      )
    )

    let start: Date, end: Date, colour: string
    if (event.end && event.doDays) {
      colour = enumToCustomClass.FULL
      end = event.end

      start = new Date(end)
      start.setTime(
        end.getTime() - event.doDays*MillisecsInDay
      )
    }
    else if (event.end) {
      colour = enumToCustomClass.ONLY_DEADLINE
      end = event.end
      start = new Date(event.end)
      start.setTime(
        start.getTime() - DEFAULT_OFFSET_DAY*MillisecsInDay
      )
    }
    else if (event.doDays) {
      colour = enumToCustomClass.ONLY_DO_DAYS
      end = getMinDateFromChild(children, history)
      start = new Date(end)
      start.setTime(
        end.getTime() - event.doDays*MillisecsInDay
      )
    }
    else {
      colour = enumToCustomClass.NOTHING
      end = getMinDateFromChild(children, history)
      start = new Date(end)
      start.setTime(
        end.getTime() - DEFAULT_OFFSET_DAY*MillisecsInDay
      )
    }

    const tasks = await getProgress(this.cache, this.noteManager, event.id)
    const progress = Math.floor(tasks.done / tasks.all * 100)

    const result = [...children.flat()]
    if (progress != 100)
      result.unshift({
        id: event.id,
        name: event.name,
        start,
        end,
        progress,
        dependencies: from.map(el => el.event.id).join(),
        custom_class: colour,
        extra: {
          path: event.id
        }
      })

    return result
  }

  private getRoots(): Node[] {
    const roots = []
    for (let [key, node] of this.hashTable.entries()) {
      if (node.from.length != 0)
        continue

      if (node.to.length == 0 && !node.event.end)
        continue

      roots.push(node)
    }

    return roots
  }
}

function convertToEvent(page: IPage): GraphEvent {
  return {
    id: page.file.path,
    name: page.file.name,
    doDays: page.ff_doDays,
    end: page.ff_deadline
  }

}

function getMinDateFromChild(children: IEvent[][], history: Node[]): Date {
  const startDays = children.filter(Boolean).map(
    el => el[0].start
  )

  if (startDays.length == 0) {
    let offsetDays = 0
    let startChainDate = new Date
    for (let parent of history) {
      offsetDays += parent.event.doDays || DEFAULT_OFFSET_DAY

      if (parent.event.end) {
        startChainDate = parent.event.end
        break
      }
    }

    startChainDate.setTime(
      startChainDate.getTime() + offsetDays*MillisecsInDay
    )
    return startChainDate
  }

  const minDate = startDays.reduce(
    (minDate, currentDate) => {
      if (minDate <= currentDate)
        return minDate
      return currentDate
    },
    startDays[0]
  )

  return minDate
}
