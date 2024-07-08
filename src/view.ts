import { ItemView, Platform, WorkspaceLeaf, App } from 'obsidian';
import MyPlugin from "./main"
import { REST_TIME } from './constants';

export const VIEW_TYPE = "my-obsidian-calendar-plugin"

export class CalendarView extends ItemView {
  private parrentPointer: MyPlugin
  public calendar = null

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

  onunload() {
    if (this.calendar) {
      // @ts-ignore
      this.calendar.destroy();
      this.calendar = null;
    }
  }

  private async render(container: Element) {
    // @ts-ignore
    const {renderCalendar} = this.app.plugins.plugins["obsidian-full-calendar"]
    this.calendar = renderCalendar(
        container,
        // TODO
        // {events: [...await getEvents(), ...REST_TIME]},
        {events: [...REST_TIME]},
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

      // eventClick: info => {
      //     const notePath = info.event.extendedProps.notePath
    
      //     const tFile = MDCache.getFirstLinkpathDest(
      //         notePath
      //         ? notePath
      //         : info.event.id,
      //         ''
      //     )
    
      //     // false = open in the current tab
      //     const leaf = this.app.workspace.getLeaf(true)
      //     leaf.openFile(tFile)
      // },
      // modifyEvent: async (newPos, oldPos) => {
      //     const props = newPos.extendedProps
      //     if (props.notePath)
      //         await changeProperty(props.notePath, newPos.start, newPos.end, newPos.allDay, props.tickName)
      //     else
      //         await changeProperty(newPos.id, newPos.start, newPos.end, newPos.allDay)
    
      //     // true for update place in Calendar
      //     return 1
      // },
      // select: (start, end, allDay, __viewMode) => {
      //     new nameModal(
      //         this.app,
      //         async nameOfFile => {
      //             // ! hehe vuln
      //             const pathOfFile = `databases/tasks/${nameOfFile}.md`
      //             try {
      //                 if (!nameOfFile)
      //                     throw 1
    
      //                 await app.vault.create(pathOfFile,'')
      //                 setTimeout(
      //                     () => changeProperty(pathOfFile, start, end, allDay),
      //                     1500
      //                 )
      //                 new Notice("Created " + pathOfFile)
      //             }
      //             catch (e) {
      //                 console.error(e)
      //                 new Notice("Hm... error...")
      //             }
      //         }
      //     ).open()
      // }
    }
  }

}