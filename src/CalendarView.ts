import { ItemView, Platform, WorkspaceLeaf, Notice, Modal, App, Setting, Menu, Component } from 'obsidian';
import MyPlugin from "./main"
import { MSG_PLG_NAME, PLACE_FOR_CREATING_NOTE, TEXT_DONE } from './constants';
import { CalendarEvent, IEvent, IPage, MyView } from './types';
import { CalendarEventToIDate, getColourFromPath, IDateToCalendarEvent, millisecToString, templateIDTick, templateNameTick, timeAdd } from './util';
import { renderCalendar } from 'lib/obsidian-full-calendar/calendar';
import { Calendar } from '@fullcalendar/core';

export const VIEW_TYPE = "my-obsidian-calendar-plugin"

export class CalendarView extends ItemView implements MyView {
  private parrentPointer: MyPlugin
  private calendar: Calendar | null = null
  private idForCache: number
  private event_src: string[]

  constructor(leaf: WorkspaceLeaf, idForCache: number, event_src: string[], parrentPointer: MyPlugin) {
    super(leaf)
    this.parrentPointer = parrentPointer
    this.idForCache = idForCache
    this.event_src = event_src
  }

  public getViewType() {return VIEW_TYPE}

  public getDisplayText() {return "Calendar"}

  // #1
  public async onOpen() {
    if (Platform.isMobile)
      this.containerEl.style.height = "95vh"

    const container = this.containerEl.children[1]
    container.empty()

    this.render(container)
  }

  public onResize() {
    this.calendar?.render();
  }

  public addFile(page: IPage): void {
    const events = this.pageToEvents(page)
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
    if (!this.calendar)
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

    this.calendar.destroy();
    this.calendar = null;
    this.parrentPointer.cache.unsubscribe(this.idForCache)
  }

  private async render(container: Element) {
    const events: IEvent[] = []

    for (let page of
              await this.parrentPointer.cache.subscribe(this.idForCache, this.event_src, this)) {
      events.push(...this.pageToEvents(page))
    }

    this.calendar = renderCalendar(
      container as HTMLElement,
      {
        // @ts-ignore
          events: [
            ...this.parrentPointer.getSettings().calendar.restTime,
            ...events
          ]
        },
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
      }, 1
    )
    this.calendar.render()
  }

  private getSettingsCalendar() {
    const result = {
      firstDay: 1,
      weekNumbers: true,
      timeFormat24h: true,

      eventClick: (arg: any) => {
        const {event, jsEvent} = arg
        this.parrentPointer.fileManager.openNote(event)
      },

      modifyEvent: async (newPos: any, oldPos: any) => {
        const props = newPos.extendedProps

        const event: CalendarEvent = {
          start: newPos.start,
          end: newPos.end,
          allDay: newPos.allDay
        }

        // TODO can refactor this with:
        // const noteName = props.notePath || newPos.id
        // const page = ...getPage(noteName)
        if (props.notePath) {
          const page = this.parrentPointer.cache.getPage(props.notePath)

          if (!page) {
            console.warn(`${MSG_PLG_NAME}: can't find page by Event. eventID: ${props.notePath}`)
            return false
          }

          const tick = page.ticks.find(
            el => el.name == props.tickName
          )
          if (!tick) {
            console.warn(`${MSG_PLG_NAME}: can't find tick by page. Page - tickName: ${props.notePath} - ${props.tickName}`)
            return false
          }

          if (tick.duration && oldPos.allDay && !newPos.allDay) {
            event.end = timeAdd(newPos.start, tick.duration)
            newPos.setEnd(event.end)
          }

          const newProp = CalendarEventToIDate(event)
          if (newPos.allDay) {
            newProp['duration'] = millisecToString(
              tick.duration.as("milliseconds")
            )
          }

          this.parrentPointer.fileManager.changeTickFile(props.notePath, props.tickName, newProp)
        }
        else {
          const page = this.parrentPointer.cache.getPage(newPos.id)

          if (!page) {
            console.warn(`${MSG_PLG_NAME}: can't find page by Event. eventID: ${newPos.id}`)
            return false
          }

          if (page.duration && oldPos.allDay && !newPos.allDay) {
            event.end = timeAdd(newPos.start, page.duration)
            newPos.setEnd(event.end)
          }

          const newProp = CalendarEventToIDate(event)
          if (newPos.allDay) {
            newProp['duration'] = millisecToString(
              page.duration?.as("milliseconds")
            )
          }

          this.parrentPointer.fileManager.changePropertyFile(newPos.id, newProp)
        }

        // true for update place in Calendar
        return true
      },
      select: (start: Date, end: Date, allDay: boolean, __viewMode: any) => {
        new nameModal(
          this.app,
          async (nameOfFile: string) => {
            try {
              if (!nameOfFile)
                throw 1

              const pathOfFile = PLACE_FOR_CREATING_NOTE + `/${nameOfFile}.md`
              await this.parrentPointer.fileManager.createFile(pathOfFile)

              // TODO подумать, как убрать TimeOut
              setTimeout(
                () => this.parrentPointer.fileManager.changePropertyFile(
                  pathOfFile,
                  CalendarEventToIDate({start, end, allDay})
                ),
                1500
              )
            }
            catch (e) {
              console.error(e)
              new Notice("Hm... error...")
            }
          }
        ).open()
      },
      openContextMenuForEvent: (e: IEvent, mouseEvent: MouseEvent) => {
        this.contextMenuForEvent(e, mouseEvent)
      },
      slotDuration: this.parrentPointer.getSettings().calendar.slotDuration
    }

    if (Platform.isMobile) {
      result.eventClick = (arg: any) => {
        const {event, jsEvent} = arg
        this.contextMenuForEvent(event, jsEvent)
      }
      result.openContextMenuForEvent = (_:IEvent, __:MouseEvent) => {}
    }

    return result
  }

  private contextMenuForEvent(event: IEvent, mouseEvent: MouseEvent) {
    const menu = new Menu

    menu.addItem(
      (item) => item.setTitle(event.id)
        .onClick(async () => this.parrentPointer.fileManager.openNote(event))
    )
    // menu.addSeparator()


    menu.showAtMouseEvent(mouseEvent)
  }

  private pageToEvents(page: IPage): IEvent[] {
    const result: IEvent[] = []

    const colours = this.parrentPointer.getSettings().calendar.colours

    const structureTemplate = {
      id: "",
      title: "",
      borderColor: colours.default,
      color: getColourFromPath(page.file.path),
      editable: true,
    }

    if (page.date) {
      const structure: IEvent = {
        ...structureTemplate,
        id: page.file.path,
        title: page.file.name,
        ...IDateToCalendarEvent(page)
      }
      if (page.ff_frequency)
        structure.borderColor = colours.frequency
      if (page.status == TEXT_DONE)
          structure.borderColor = colours.done

      result.push(structure)
    }
    for (let tick of page.ticks) {
      const structure: IEvent = {
        ...structureTemplate,
        id: templateIDTick(page.file.path, tick.name),
        title: templateNameTick(page.file.name, tick.name),
        borderColor: colours.tick,
        extendedProps: {
          tickName: tick.name,
          notePath: page.file.path
        },
        ...IDateToCalendarEvent(tick)
      }
      result.push(structure)
    }

    return result
  }
}

class nameModal extends Modal {
  private result: string
  private onSubmit: Function

  constructor(app: App, onSubmit: Function) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this

    contentEl.createEl("h1", { text: "Name of task" })

    new Setting(contentEl)
    .setName("Name")
    .addText(
      text => text.onChange(value => this.result = value)
    )

    new Setting(contentEl)
    .addButton(
      (btn) => btn.setButtonText("Submit")
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.result);
        }));
  }

  onClose() {
    this.contentEl.empty();
  }
}
