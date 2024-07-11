import { ItemView, Platform, WorkspaceLeaf, Notice, Modal, App, Setting } from 'obsidian';
import MyPlugin from "./main"
import { REST_TIME, EVENT_SRC, PLACE_FOR_CREATING_NOTE } from './constants';
import { CalendarEvent, IEvent, IPage, MyView } from './types';
import { pageToEvents } from './util';

export const VIEW_TYPE = "my-obsidian-calendar-plugin"

export class CalendarView extends ItemView implements MyView {
  private parrentPointer: MyPlugin
  private calendar = null

  constructor(leaf: WorkspaceLeaf, parrentPointer: MyPlugin) {
    super(leaf)
    this.parrentPointer = parrentPointer
  }

  public getViewType() {return VIEW_TYPE}

  public getDisplayText() {return "Calendar"}

  // TODO функционал с выбором папки и исключениями
  public async onOpen() {
    if (Platform.isMobile)
      this.containerEl.style.height = "95vh"

    const container = this.containerEl.children[1]
    container.empty()

    this.render(container)
  }

  public onResize() {
    // @ts-ignore
    this.calendar?.render();
  }

  // TODO
  public addFile(page: IPage) {}
  // TODO сначала попробовать удалять все события, а потом добавлять их
  public changeFile(newPage: IPage, oldPage: IPage): void {}
  // TODO
  public deleteFile(page: IPage) {}

  public reset() {
    this.onunload()
    this.onOpen()
  }

  onunload() {
    if (this.calendar) {
      // @ts-ignore
      this.calendar.destroy();
      this.calendar = null;
      this.parrentPointer.cache.unsubscribe(EVENT_SRC)
    }
  }

  private async render(container: Element) {
    // @ts-ignore
    const {renderCalendar} = this.app.plugins.plugins["obsidian-full-calendar"]
    const events: IEvent[] = []

    for (let page of this.parrentPointer.cache.subscribe(EVENT_SRC, this)) {
      events.push(...pageToEvents(page))
    }

    this.calendar = renderCalendar(
        container,
        {events: [...REST_TIME, ...events]},
        this.getSettingsCalendar(),
    )
    // @ts-ignore
    this.calendar.setOption('weekNumbers', true)

    // NOTE to fix bug first render
    window.setTimeout(
      (_: any) => {
        if (Platform.isMobile)
          // @ts-ignore
          this.calendar.changeView('timeGrid3Days')
        else
          // @ts-ignore
          this.calendar.changeView('timeGridWeek')
      }, 1
    )
    // @ts-ignore
    this.calendar.render()
  }

  private getSettingsCalendar() {
    return {
      firstDay: 1,
      weekNumbers: true,
      timeFormat24h: true,

      eventClick: ({event}:any) => {
          // NOTE сначала проверяет тик ли это, а потом переходит к id
          const tFile = this.app.metadataCache.getFirstLinkpathDest(
            event.extendedProps.notePath || event.id, ''
          )

          // false = open in the current tab
          const leaf = this.app.workspace.getLeaf(true)
          tFile && leaf.openFile(tFile)
      },
      // TODO по идее самому ничего не надо создавать, ибо есть cache, который сам обновит, но для "оптимизации" можно было бы добавить
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
        // TODO return true
        return false
      },
      // TODO по идее самому ничего не надо создавать, ибо есть cache, который сам обновит, но для "оптимизации" можно было бы добавить
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
      }
    }
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