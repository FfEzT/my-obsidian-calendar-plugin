import { ItemView, Platform, WorkspaceLeaf, Notice, Modal, App, Setting, Menu, Component } from 'obsidian';
import MyPlugin from "../main"
import { MSG_PLG_NAME, TEXT_DONE, VIEW_TYPE } from '../constants';
import { CalendarEvent, CalendarSettings, IEvent, IPage, ISubscriber, Src } from '../types';
import { CalendarEventToIDate, getColourFromPath, IDateToCalendarEvent, millisecToString, pageToEvents, templateIDTick, templateNameTick, timeAdd } from '../util';
import { renderCalendar } from 'lib/obsidian-full-calendar/calendar';
import { Calendar } from '@fullcalendar/core';
import { Cache } from 'src/cache';
import FileManager from 'src/fileManager';

export class CalendarView extends ItemView implements ISubscriber {
  // private parrentPointer: MyPlugin

  private cache: Cache

  private calendar: Calendar | null = null

  private idForCache: number

  private event_src: Src[]

  private localStorage: Map<string, IPage[]>

  private selectedSrcPaths: Set<string> = new Set()

  private fileManager: FileManager

  private calendarSettings: CalendarSettings

  // private srcCheckboxContainer: HTMLElement | null = null
  private placeForCreatingNote: string

  constructor(
    leaf: WorkspaceLeaf,
    cache: Cache,
    idForCache: number,
    event_src: Src[],
    calendarSettings: CalendarSettings,
    fileManager: FileManager,
    placeForCreatingNote: string,
    // parrentPointer: MyPlugin,
    // backGroundEvents:
  ) {
    super(leaf)

    this.cache = cache
    this.idForCache = idForCache
    this.event_src = event_src
    this.fileManager = fileManager
    this.calendarSettings = calendarSettings
    this.placeForCreatingNote = placeForCreatingNote

    for (let src of event_src) {
      this.selectedSrcPaths.add(src.path)
    }
  }

  public getViewType() {return VIEW_TYPE}

  public getDisplayText() {return "Calendar"}

  public async onOpen() {
    if (Platform.isMobile)
      this.containerEl.style.height = "95vh"

    const { containerEl } = this
    const container = containerEl.children[1] // TODO что за дети (что в других индексах?)
    container.empty()
    const calendarContainer = container.createDiv(/*{cls: 'class'}*/)
    const checkBoxContainer = container.createDiv(/*{cls: 'class'}*/)

    // Создаем контейнер для чекбоксов
    // this.srcCheckboxContainer = container.createDiv({cls: 'calendar-src-checkboxes'})

    this.render(calendarContainer)
    .then(
      () => this.renderSrcCheckboxes(checkBoxContainer)
    )
  }

  public onResize() {
    this.calendar?.render();
  }

  public addFile(page: Src): void {
    // Проверяем, соответствует ли путь страницы выбранным источникам
    if (!this.isPageInSelectedSrc(page.file.path)) {
      return
    }

    const events = pageToEvents(page)
    for (let event of events)
      this.calendar?.addEvent(event)
  }

  public changeFile(newPage: Src, oldPage: Src): void {
    this.calendar?.pauseRendering()
    this.deleteFile(oldPage)
    this.addFile(newPage)
    this.calendar?.resumeRendering()
  }

  public renameFile(newPage: Src, oldPage: Src): void {
    this.changeFile(newPage, oldPage)
  }

  public deleteFile(page: Src): void {
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
    this.cache.unsubscribe(this.idForCache)
  }

  private renderSrcCheckboxes(srcCheckboxContainer: HTMLElement) {
    srcCheckboxContainer.empty()
    srcCheckboxContainer.addClass("calendar-src-checkboxes")

    for (let src of this.event_src) {
      const checkboxContainer = srcCheckboxContainer!.createDiv({cls: 'src-checkbox-item'})

      const checkbox = checkboxContainer.createEl('input', {
        type: 'checkbox',
        attr: {
          id: `src-checkbox-${src.path}`,
          checked: this.selectedSrcPaths.has(src.path) ? 'checked' : null
        }
      })

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedSrcPaths.add(src.path)
        } else {
          this.selectedSrcPaths.delete(src.path)
        }
        this.refreshCalendar()
      })

      checkboxContainer.createEl('label', {
        text: src.path,
        attr: {for: `src-checkbox-${src.path}`}
      })
    }
  }

  private isPathInSrc(pagePath: string): boolean {
    // TODO здесь не учитываются исключения
    for (const srcPath of this.selectedSrcPaths) {
      if (pagePath.startsWith(srcPath)) {
        return true
      }
    }
    return false
  }

  private async refreshCalendar() {
    if (!this.calendar)
      return

    this.calendar.removeAllEvents()

    const events: IEvent[] = []
    for (let [key, val] of this.localStorage) {
      if ( !this.isPathInSrc(key) )
        continue

      for (let page of val)
        events.push( ...pageToEvents(page) )
    }

    this.calendar
    events.forEach(event => this.calendar?.addEvent(event))
  }

  private async render(container: Element)  {
    this.localStorage = new Map

    const subscribedData = await this.cache.subscribe(this.idForCache, this.event_src, this)
    for (let data of subscribedData) {
      this.localStorage.set(data.src.path, data.pages)
    }

    const events: IEvent[] = []
    for (const data of subscribedData) {
      if (!this.selectedSrcPaths.has(data.src.path))
        continue

      for (let page of data.pages) {
        events.push( ...pageToEvents(page) )
      }
    }

    this.calendar = renderCalendar(
      container as HTMLElement,
      {
        //@ts-ignore // TODO remove
        events: [
          ...this.calendarSettings.restTime,
          ...events
        ]
      },// as EventSource,
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

      // TODO remove any
      eventClick: (arg: any) => {
        const {event, jsEvent} = arg
        this.fileManager.openNote(event)
      },

      // TODO remove any
      modifyEvent: async (newPos: any, oldPos: any) => {
        const props = newPos.extendedProps

        const event: CalendarEvent = {
          start: newPos.start,
          end: newPos.end,
          allDay: newPos.allDay
        }

        if (props.notePath) {
          const page = this.cache.getPage(props.notePath)

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

          if (tick.ff_duration && oldPos.allDay && !newPos.allDay) {
            event.end = timeAdd(newPos.start, tick.ff_duration)
            newPos.setEnd(event.end)
          }

          const newProp = CalendarEventToIDate(event)
          if (newPos.allDay) {
            newProp['ff_duration'] = millisecToString(
              tick.ff_duration?.as("milliseconds")
            )
          }

          this.fileManager.changeTickFile(props.notePath, props.tickName, newProp)
        }
        else {
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
          if (newPos.allDay) {
            newProp['ff_duration'] = millisecToString(
              page.ff_duration?.as("milliseconds")
            )
          }

          this.fileManager.changePropertyFile(newPos.id, newProp)
        }

        return true
      },
      select: (start: Date, end: Date, allDay: boolean, __viewMode: any) => {
        new nameModal(
          this.app,
          async (nameOfFile: string) => {
            try {
              if (!nameOfFile)
                throw 1

              const pathOfFile = this.placeForCreatingNote + `/${nameOfFile}.md`
              await this.fileManager.createFile(pathOfFile)

              setTimeout(
                () => this.fileManager.changePropertyFile(
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
      slotDuration: this.calendarSettings.slotDuration
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
        .onClick(async () => this.fileManager.openNote(event))
    )

    menu.showAtMouseEvent(mouseEvent)
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
