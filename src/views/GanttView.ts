import { WorkspaceLeaf } from 'obsidian';
import Gantt from '../../lib/frappe-gantt/src/index'
import { GANTT_VIEW_TYPE, GANTT_TAB_NAME, MillisecsInDay } from '../constants';
import { GanttSettings, IPage, ISubscriber, Src } from '../types';
import { getBlockers, getProgress } from '../util';
import { Cache } from 'src/cache';
import NoteManager from 'src/NoteManager';
import { BaseSrcView } from './BaseSrcView';

const DEFAULT_OFFSET_DAY = 14 // TODO 7 is constant


// TODO
const enumToCustomClass = {
  FULL: 'full',
  ONLY_DEADLINE: 'only-deadline', // TODO gradient document
  ONLY_START: 'only-do-days', // TODO orange document
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

export class GanttView extends BaseSrcView implements ISubscriber {
  static CONTAINER_ID = 'gantt'

  private cache: Cache

  private idForCache: number

  private noteManager: NoteManager

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
    super(leaf, eventSrc)

    this.cache = cache
    this.idForCache = idForCache
    this.noteManager = noteManager

    this.localStorage = new Graph(cache, noteManager)
  }

  public getViewType() { return GANTT_VIEW_TYPE }

  public getDisplayText() { return GANTT_TAB_NAME }

  public async onOpen() {
    const { containerEl } = this
    const container = containerEl.children[1]
    container.empty()

    const checkBoxContainer = container.createDiv()
    const htmlContainer = container.createDiv(/*{cls: 'class'}*/)
    const legendContainter = container.createDiv(/*{cls: 'class'}*/)

    this.render(htmlContainer)
    this.renderLegend(legendContainter)
    this.renderSrcCheckboxes(checkBoxContainer)
  }

  public addFile(page: IPage): void {
    this.localStorage.addPage(page)

    if (!this.isPathInActiveSrc(page.file.path))
      return

    this.refreshView()
  }

  public async changeFile(newPage: IPage, oldPage: IPage) {
    this.localStorage.addPage(newPage)
    const newEvents = (await this.localStorage.getEvents())
      .filter(
        event => this.isPathInActiveSrc(event.extra.path)
      )

    const mapping: Map<string, IEvent> = new Map()
    for (let event of newEvents) {
      mapping.set(event.extra.path, event)
    }

    const events = this.gantt.tasks as Array<IEvent>
    for (let [i, event] of events.entries()) {
      const newEvent = mapping.get(event.extra.path)
      if (!newEvent)
        continue

      this.gantt.update_task(event.id, newEvent)
      mapping.delete(newEvent.extra.path)
    }
    for (let [key, val] of mapping.entries()) {
      this.gantt.add_tasks([val])
    }
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {
    // TODO del + add
    // this.localStorage.getEvents()
    // .then(
    //   events => {
    //       const filtered = events.filter(
    //         event => this.isPathInActiveSrc(event.extra.path)
    //       )
    //   }
    // )
  }

  public async deleteFile(page: IPage): Promise<void> {
    this.localStorage.deletePage(page)
    if (!this.isPathInActiveSrc(page.file.path))
      return

    await this.refreshView()
  }

  public reset() {
    this.onunload()
    this.onOpen()
  }

  onunload() { }

  protected override async refreshView() {
    const events = (await this.localStorage.getEvents())
      .filter(
        event => this.isPathInActiveSrc(event.extra.path)
      )
    this.gantt.refresh(events)
  }

  private async render(container: Element) {
    container.id = GanttView.CONTAINER_ID

    const subscribedData = await this.cache.subscribe(this.idForCache, this.eventSrc, this)
    for (let page of subscribedData) {
      this.localStorage.addPage(page)
    }

    const events = await this.localStorage
      .getEvents().then(
        events => events.filter(
          event => this.isPathInActiveSrc(event.extra.path)
        )
      )

    this.gantt = new Gantt(`#${GanttView.CONTAINER_ID}`, events, this.getGanttSettings())

  }

  private getGanttSettings() {
    const date = new Date
    date.setTime(date.getTime() - 7 * MillisecsInDay)

    // TODO смена тем
    // TODO перенести либу ганта себе в репо + пропатчить css-стили
    return {
      infinite_padding: false,
      move_dependencies: false,
      readonly_progress: true,
      // readonly: true,
      scroll_to: date,

      on_date_change: async (task: IEvent, start: Date, end: Date) => {
        // ! для ISO (он переводит в гринвич мое время)
        // я тут говорю, что я в гринвиче
        start.setMinutes(
          start.getMinutes() - start.getTimezoneOffset()
        )
        end.setMinutes(
          end.getMinutes() - end.getTimezoneOffset() + 1 // +1 for next day
        )

        await this.noteManager.changePropertyFile(
          task.extra.path,
          property => {
            property['ff_date'] = start.toISOString().slice(0, -14)
            property['ff_deadline'] = end.toISOString().slice(0, -14)
          }
        )
      },
      // on_click: (event: IEvent) => {console.log(event); this.noteManager.openNote(event.extra.path);}
    }
  }

  private renderLegend(container: HTMLElement) {
    const legend = container.createDiv({ cls: 'gantt-legend' });

    const legendItems = [
      { className: 'full', label: 'Full data (start and end)' },
      { className: 'only-deadline', label: 'Only end (deadline)' },
      { className: 'only-do-days', label: 'Only start' },
      { className: 'nothing', label: 'No data' }
    ];

    for (let item of legendItems) {
        const itemEl = legend.createDiv({ cls: 'gantt-legend-item' });
        itemEl.createDiv({ cls: `gantt-legend-color ${item.className}` });
        itemEl.createSpan({ text: item.label });
    }
}
}


type GraphEvent = {
  id: string
  name?: string,
  start?: Date,
  end?: Date,
}

type Node = {
  to: Set<string> // paths
  from: Set<string>
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

    const resSet = new Set<string>()
    const res: IEvent[] = []
    for (let node of roots) {
      const events = await this.calcEvents([node])

      for (let event of events) {
        if (resSet.has(event.id))
          continue

        res.push(event)
        resSet.add(event.id)
      }
    }

    res
      .sort(
        (a, b) => a.end.getTime() - b.end.getTime()
      )
      .sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      )

    return res
  }

  public addPage(page: IPage) {
    const event = convertToGraphEvent(page)

    const blockers = getBlockers(page.file.path)
    for (let path of blockers) {
      const blockNode = this.hashTable.get(path)
      if (blockNode) {
        blockNode.to.add(event.id)

        continue
      }

      const blocker: Node = {
        event: {
          id: path,
        },
        to: new Set([event.id]),
        from: new Set
      }
      this.hashTable.set(path, blocker)
    }

    const node = this.hashTable.get(event.id)
    if (node) {
      node.event = event

      for (let block of blockers)
        node.from.add(block)
      return
    }

    this.hashTable.set(
      event.id,
      { event, to: new Set, from: new Set(blockers) }
    )
  }

  public deletePage(page: IPage) {
    this.hashTable.delete(page.file.path)

    for (let [key, val] of this.hashTable.entries()) {
      val.to.delete(page.file.path)
      val.from.delete(page.file.path)
    }
  }

  private async calcEvents(history: Node[]): Promise<IEvent[]> {
    const { event, from, to } = history[0]
    if (!event.name) {
      throw Error('unreachable')
    }

    const children: IEvent[][] = await Promise.all(
      Array.from(to)
        .map(path => this.hashTable.get(path))
        .map(node => node as Node)
        .map(
          async (node) => await this.calcEvents([node, ...history])
        )
        .filter(Boolean)
    )

    let start: Date, end: Date, colour: string, toSkip = false
    if (event.end && event.start) {
      end = event.end
      if (event.start < event.end) {
        colour = enumToCustomClass.FULL
        start = event.start
      }
      else {
        colour = enumToCustomClass.ONLY_DEADLINE
        start = new Date(end)
        start.setTime(
          end.getTime() - MillisecsInDay
        )
      }
    }
    else if (event.end) {
      colour = enumToCustomClass.ONLY_DEADLINE
      end = event.end
      start = new Date(event.end)
      start.setTime(
        start.getTime() - DEFAULT_OFFSET_DAY * MillisecsInDay
      )
    }
    else if (event.start) {
      colour = enumToCustomClass.ONLY_START
      start = event.start
      end = new Date(start)
      end.setTime(
        end.getTime() + DEFAULT_OFFSET_DAY * MillisecsInDay
      )
    }
    else {
      colour = enumToCustomClass.NOTHING
      const [end_, isOk] = await getMinDateFromChild(children, [...history], this.cache, this.noteManager)
      if (!isOk)
        toSkip = true

      end = end_
      start = new Date(end)
      start.setTime(
        end.getTime() - DEFAULT_OFFSET_DAY * MillisecsInDay
      )
    }

    const tasks = await getProgress(this.cache, this.noteManager, event.id)
    const progress = Math.floor(tasks.done / tasks.all * 100)

    const result = [...children.flat()]
    if (progress != 100 && !toSkip) {
      result.unshift({
        // @ts-ignore
        id: event.id.replaceAll('/', '-'),
        name: event.name,
        start,
        end,
        progress,
        dependencies: Array.from(from).map(el =>
          // @ts-ignore
          el.replaceAll('/', '-'))
          .join(),
        custom_class: colour,
        extra: {
          path: event.id
        }
      })
    }

    return result
  }

  private getRoots(): Node[] {
    const roots = []
    for (let [key, node] of this.hashTable.entries()) {
      if (node.from.size != 0)
        continue

      if (node.to.size == 0 && !node.event.end)
        continue

      roots.push(node)
    }

    return roots
  }
}

function convertToGraphEvent(page: IPage): GraphEvent {
  return {
    id: page.file.path,
    name: page.file.name,
    start: page.ff_date,
    end: page.ff_deadline
  }
}

async function calculateNextStartDate(
  history: Node[],
  cache: Cache,
  noteManager: NoteManager
): Promise<[Date, boolean]>
{
  const curNode = history.shift()
  let offsetDays = DEFAULT_OFFSET_DAY

  let startChainDate = new Date()
  startChainDate.setHours(0, 0, 0, 0)

  for (let [i, parent] of history.entries()) {
    const tasks = await getProgress(cache, noteManager, parent.event.id)
    if (tasks.done == tasks.all) {
      if (i == 0)
        return [new Date, false]

      break
    }

    if (parent.event.end) {
      startChainDate = new Date(parent.event.end)
      break
    }

    offsetDays += DEFAULT_OFFSET_DAY
    if (parent.event.start) {
      startChainDate = new Date(parent.event.start)
      break
    }
  }

  startChainDate.setTime(
    startChainDate.getTime() + offsetDays * MillisecsInDay
  )
  return [startChainDate, true]
}

async function getMinDateFromChild(
  children: IEvent[][],
  history: Node[],
  cache: Cache,
  noteManager: NoteManager
): Promise<[Date, boolean]>
{
  const startDays = children
    .map(
      el => el[0]?.start
    )
    .filter(Boolean)

  if (startDays.length == 0) {
    return await calculateNextStartDate(history, cache, noteManager)
  }

  const minDate = startDays.reduce(
    (minDate, currentDate) => {
      if (minDate <= currentDate)
        return minDate
      return currentDate
    },
    startDays[0]
  )

  return [minDate, true]
}
