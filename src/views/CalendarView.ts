import { ItemView, Platform, WorkspaceLeaf, Notice, Modal, App, Setting, Menu, Component } from 'obsidian'
import { MSG_PLG_NAME, TEXT_DONE, CALENDAR_VIEW_TYPE, CALENDAR_TAB_NAME } from '../constants'
import { CalendarEvent, CalendarSettings, IPage, ISubscriber, Src } from '../types'
import { CalendarEventToIDate, getColourFromPath, IDateToCalendarEvent, millisecToString, templateIDTick, templateNameTick, timeAdd } from '../util'
import { renderCalendar } from 'lib/obsidian-full-calendar/calendar'
import { Calendar } from '@fullcalendar/core'
import { Cache } from 'src/cache'
import NoteManager from 'src/NoteManager'
import { BaseSrcView } from './BaseSrcView'

export interface IEvent {
  start: Date
  end?: Date
  id: string
  title: string
  allDay: boolean
  color?: string
  borderColor: string
  editable: boolean
  extendedProps?: {
    tickName: string
    notePath: string
  }
}

export class CalendarView extends BaseSrcView implements ISubscriber {
  private cache: Cache

  private calendar: Calendar | null = null

  private idForCache: number

  private noteManager: NoteManager

  private calendarSettings: CalendarSettings

  private localStorage: IPage[]

  private placeForCreatingNote: string

  constructor(
    leaf: WorkspaceLeaf,
    idForCache: number,
    eventSrc: Src[],
    calendarSettings: CalendarSettings,
    cache: Cache,
    noteManager: NoteManager,
    placeForCreatingNote: string,
  ) {
    super(leaf, eventSrc)

    this.cache = cache
    this.idForCache = idForCache
    this.noteManager = noteManager
    this.calendarSettings = calendarSettings
    this.placeForCreatingNote = placeForCreatingNote
  }

  public getViewType() { return CALENDAR_VIEW_TYPE }

  public getDisplayText() { return CALENDAR_TAB_NAME }

  public async onOpen() {
    if (Platform.isMobile)
      this.containerEl.style.height = '95vh'

    const { containerEl } = this
    const container = containerEl.children[1]
    container.empty()
    const checkBoxContainer = container.createDiv()
    const calendarContainer = container.createDiv()

    this.render(calendarContainer)
    this.renderSrcCheckboxes(checkBoxContainer)
  }

  public onResize() {
    this.calendar?.render()
  }

  public addFile(data: IPage): void {
    this.localStorage.push(data)
    if (!this.isPathInActiveSrc(data.file.path)) {
      return
    }

    const events = this.pageToEvents(data)

    for (let event of events)
      this.calendar?.addEvent(event)
  }

  public changeFile(newPage: IPage, oldPage: IPage): void {
    this.calendar?.pauseRendering()
    this.deleteFile(oldPage)
    this.addFile(newPage)
    this.calendar?.resumeRendering()
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {
    this.changeFile(newPage, oldPage)
  }

  public deleteFile(page: IPage): void {
    const el = this.localStorage.find(
      value => page.file.path == value.file.path
    )
    if (el)
      this.localStorage.remove(el)

    if (!this.calendar)
      return

    if (!this.isPathInActiveSrc(page.file.path))
      return

    this.calendar.getEventById(page.file.path)?.remove()

    for (let tick of page.ticks) {
      this.calendar.getEventById(
        templateIDTick(page.file.path, tick.name)
      )?.remove()
    }
  }

  public reset() {
    this.onunload()
    this.onOpen()
  }

  onunload() {
    if (!this.calendar)
      return

    this.calendar.destroy()
    this.calendar = null
    this.cache.unsubscribe(this.idForCache)
  }

  protected override async refreshView() {
    if (!this.calendar)
      return

    this.calendar.pauseRendering()

    this.calendar.removeAllEvents()

    // @ts-ignore
    const events: IEvent[] = [...this.calendarSettings.restTime]
    for (let page of this.localStorage) {
      if (!this.isPathInActiveSrc(page.file.path))
        continue

      events.push(...this.pageToEvents(page))
    }

    for (let event of events) {
      this.calendar.addEvent(event)
    }

    this.calendar.resumeRendering()
  }

  private pageToEvents(page: IPage): IEvent[] {
    const result: IEvent[] = []

    const colours = this.calendarSettings.colours

    const structureTemplate = {
      id: '',
      title: '',
      borderColor: colours.default,
      color: getColourFromPath(page.file.path),
      editable: true,
    }

    if (page.ff_date) {
      const event = IDateToCalendarEvent(page)
      if (!event)
        throw 'unreachable'

      const structure: IEvent = {
        ...structureTemplate,
        id: page.file.path,
        title: page.file.name,
        ...event,
      }
      if (page.ff_frequency)
        structure.borderColor = colours.frequency
      if (page.ff_status == TEXT_DONE)
        structure.borderColor = colours.done
      else if (!page.ff_status)
        structure.borderColor = colours.noStatus

      result.push(structure)
    }
    for (let tick of page.ticks) {
      const event = IDateToCalendarEvent(tick)
      console.log(event)
      if (!event)
        continue

      const structure: IEvent = {
        ...structureTemplate,
        id: templateIDTick(page.file.path, tick.name),
        title: templateNameTick(page.file.name, tick.name),
        borderColor: colours.tick,
        extendedProps: {
          tickName: tick.name,
          notePath: page.file.path,
        },
        ...event,
      }
      result.push(structure)
    }

    return result
  }

  private async render(container: Element) {
    const subscribedData = await this.cache.subscribe(this.idForCache, this.eventSrc, this)
    this.localStorage = subscribedData

    const events: IEvent[] = []
    for (const page of subscribedData) {
      if (!this.isPathInActiveSrc(page.file.path))
        continue

      events.push(...this.pageToEvents(page))
    }

    this.calendar = renderCalendar(
      container as HTMLElement,
      {
        //@ts-ignore // TODO remove
        events: [
          ...this.calendarSettings.restTime,
          ...events,
        ],
      }, // as EventSource,
      this.getSettingsCalendar(),
    )
    this.calendar.setOption('weekNumbers', true)

    // NOTE to fix bug first render
    window.setTimeout(
      (_: any) => {
        if (Platform.isMobile)
          this.calendar?.changeView('timeGrid3Days')
        else
          this.calendar?.changeView('timeGridWeek')
      }, 1,
    )
    this.calendar.render()
  }

  private getSettingsCalendar() {
    const result = {
      firstDay: 1,
      weekNumbers: true,
      timeFormat24h: true,

      eventClick: (arg: any) => {
        const { event, jsEvent } = arg
        this.noteManager.openNote(getPathFromEvent(event))
      },

      modifyEvent: async (newPos: any, oldPos: any) => {
        const props = newPos.extendedProps

        const event: CalendarEvent = {
          start: newPos.start,
          end: newPos.end,
          allDay: newPos.allDay,
        }

        if (props.notePath) {
          const page = this.cache.getPage(props.notePath)

          if (!page) {
            console.warn(`${MSG_PLG_NAME}: can't find page by Event. eventID: ${props.notePath}`)
            return false
          }

          const tick = page.ticks.find(
            el => el.name == props.tickName,
          )
          if (!tick) {
            console.warn(`${MSG_PLG_NAME}: can't find tick by page. Page - tickName: ${props.notePath} - ${props.tickName}`)
            return false
          }

          if (tick.ff_duration && oldPos.allDay && !newPos.allDay) {
            event.end = timeAdd(newPos.start, tick.ff_duration)
            newPos.setEnd(event.end)
          }

          const newProp = CalendarEventToIDate(event)
          if (newPos.allDay && !oldPos.allDay) {
            newProp['ff_duration'] = millisecToString(
              tick.ff_duration?.as('milliseconds'),
            )
          }

          this.noteManager.changeTickFile(props.notePath, props.tickName, newProp)
        } else {
          const page = this.cache.getPage(newPos.id)

          if (!page) {
            console.warn(`${MSG_PLG_NAME}: can't find page by Event. eventID: ${newPos.id}`)
            return false
          }

          if (page.ff_duration && oldPos.allDay && !newPos.allDay) {
            event.end = timeAdd(newPos.start, page.ff_duration)
            newPos.setEnd(event.end)
          }

          const newProp = CalendarEventToIDate(event)
          if (newPos.allDay && !oldPos.allDay) {
            newProp['ff_duration'] = millisecToString(
              page.ff_duration?.as('milliseconds') || 0,
            )
          }

          this.noteManager.changePropertyFile(
            newPos.id,
            property => {
              property['ff_date'] = newProp['ff_date']?.toISOString().slice(0, -14)
              property['ff_timeStart'] = newProp['ff_timeStart']
              property['ff_duration'] = newProp['ff_duration']
            },
          )
        }

        return true
      },
      select: (start: Date, end: Date, allDay: boolean, __viewMode: any) => {
        new NameModal(
          this.app,
          async (nameOfFile: string) => {
            try {
              if (!nameOfFile)
                throw 1

              const pathOfFile = this.placeForCreatingNote + `${nameOfFile}.md`
              await this.noteManager.createFile(pathOfFile)

              setTimeout(
                () => this.noteManager.changePropertyFile(
                  pathOfFile,
                  property => {
                    const newProp = CalendarEventToIDate({ start, end, allDay })

                    property['ff_date'] = newProp['ff_date']?.toISOString().slice(0, -14)
                    property['ff_timeStart'] = newProp['ff_timeStart']
                    property['ff_duration'] = newProp['ff_duration']
                  },
                ),
                1500,
              )
            }
            catch (e) {
              console.error(e)
              new Notice('Hm... error...')
            }
          },
        ).open()
      },
      openContextMenuForEvent: (e: IEvent, mouseEvent: MouseEvent) => {
        this.contextMenuForEvent(e, mouseEvent)
      },
      slotDuration: this.calendarSettings.slotDuration,
    }

    if (Platform.isMobile) {
      result.eventClick = (arg: any) => {
        const { event, jsEvent } = arg
        this.contextMenuForEvent(event, jsEvent)
      }
      result.openContextMenuForEvent = (_: IEvent, __: MouseEvent) => {}
    }

    return result
  }

  private contextMenuForEvent(event: IEvent, mouseEvent: MouseEvent) {
    const menu = new Menu

    menu.addItem(
      (item) => item.setTitle(event.id)
        .onClick(
          () => this.noteManager.openNote(getPathFromEvent(event)),
        ),
    )

    menu.showAtMouseEvent(mouseEvent)
  }
}


class NameModal extends Modal {
  private result: string
  private onSubmit: Function

  constructor(app: App, onSubmit: Function) {
    super(app)
    this.onSubmit = onSubmit
  }

  onOpen() {
    const { contentEl } = this

    contentEl.createEl('h1', { text: 'Name of task' })

    new Setting(contentEl)
      .setName('Name')
      .addText(
        text => text.onChange(value => this.result = value),
      )

    new Setting(contentEl)
      .addButton(
        (btn) => btn.setButtonText('Submit')
          .setCta()
          .onClick(() => {
            this.close()
            this.onSubmit(this.result)
          }),
      )
  }

  onClose() {
    this.contentEl.empty()
  }
}

function getPathFromEvent(event: IEvent): string {
  return event?.extendedProps?.notePath || event.id
}
