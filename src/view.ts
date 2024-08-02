import { ItemView, Platform, WorkspaceLeaf, Notice, Modal, App, Setting, Menu } from 'obsidian';
import MyPlugin from "./main"
import { REST_TIME, EVENT_SRC, PLACE_FOR_CREATING_NOTE } from './constants';
import { CalendarEvent, IEvent, IPage, MyView } from './types';
import { pageToEvents, templateIDTick } from './util';
import { renderCalendar } from 'lib/obsidian-full-calendar/calendar';

export const VIEW_TYPE = "my-obsidian-calendar-plugin"

export class CalendarView extends ItemView implements MyView {
  private parrentPointer: MyPlugin
  private calendar: any = null

  constructor(leaf: WorkspaceLeaf, parrentPointer: MyPlugin) {
    super(leaf)
    this.parrentPointer = parrentPointer
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

  public addFile(page: IPage) {
    const events = pageToEvents(page)
    for (let event of events)
      this.calendar.addEvent(event)
  }

  public changeFile(newPage: IPage, oldPage: IPage): void {
    this.deleteFile(oldPage)
    this.addFile(newPage)
  }

  public renameFile(newPage: IPage, oldPage: IPage): void {
    this.changeFile(newPage, oldPage)
  }

  public deleteFile(page: IPage) {
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
    if (this.calendar) {
      this.calendar.destroy();
      this.calendar = null;
      this.parrentPointer.cache.unsubscribe(EVENT_SRC)
    }
  }

  private async render(container: Element) {
    const events: IEvent[] = []

    for (let page of
              await this.parrentPointer.cache.subscribe(EVENT_SRC, this)) {
      events.push(...pageToEvents(page))
    }

    this.calendar = renderCalendar(
        container as HTMLElement,
        // @ts-ignore
        {events: [...REST_TIME, ...events]},
        this.getSettingsCalendar(),
    )
    this.calendar.setOption('weekNumbers', true)

    // NOTE to fix bug first render
    window.setTimeout(
      (_: any) => {
        if (Platform.isMobile)
          this.calendar.changeView('timeGrid3Days')
        else
          this.calendar.changeView('timeGridWeek')
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
          openNote(event)
      },
      modifyEvent: async (newPos: any, oldPos: any) => {
        const props = newPos.extendedProps
        const event: CalendarEvent = {
          start: newPos.start,
          end: newPos.end,
          allDay: newPos.allDay
        }

        if (props.notePath)
          this.parrentPointer.changeTickFile(props.notePath, props.tickName, event)
        else
          this.parrentPointer.changePropertyFile(newPos.id, event)

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

              const pathOfFile = PLACE_FOR_CREATING_NOTE + `/tasks/${nameOfFile}.md`
              await this.parrentPointer.createFile(pathOfFile)

              // TODO подумать, как убрать TimeOut
              setTimeout(
                () => this.parrentPointer.changePropertyFile(pathOfFile, {start, end, allDay}),
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
        contextMenuForEvent(e, mouseEvent)
      }
    }

    if (Platform.isMobile) {
      result.eventClick = (arg: any) => {
        const {event, jsEvent} = arg
        contextMenuForEvent(event, jsEvent)
      }
      result.openContextMenuForEvent = (_:IEvent, __:MouseEvent) => {}
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

function openNote(event: IEvent) {
  // NOTE сначала проверяет тик ли это, а потом переходит к id
  const tFile = this.app.metadataCache.getFirstLinkpathDest(
    event?.extendedProps?.notePath || event.id, ''
  )

  // false = open in the current tab
  const leaf = this.app.workspace.getLeaf(true)
  tFile && leaf.openFile(tFile)
}

function contextMenuForEvent(event: IEvent, mouseEvent: MouseEvent) {
  const menu = new Menu
  menu.addItem(
    (item) => item.setTitle(event.id)
      .onClick(async () => openNote(event))
  )
  // menu.addSeparator()

  menu.showAtMouseEvent(mouseEvent)
}
