import { DURATION_TYPES } from "obsidian-dataview"

// TODO interface -> type
export interface IPluginSettings {
  statusCorrector: {
    isOn: boolean,
    startOnStartUp: boolean
  },
  calendar: {
    slotDuration: string,
    colours: {
      frequency: string,
      done     : string,
      tick     : string,
      default  : string,
    },
    restTime: {
        startTime: string,
        endTime: string,
        color: string,

        daysOfWeek:any,display:any,
    }[]
  }
}

export interface IDate {
  // TODO date может и не быть (см. fileManager.ts/getPage)
  ff_date: Date
  ff_timeStart: DURATION_TYPES
  ff_duration: DURATION_TYPES
}

export interface ITick extends IDate {
  name: string
}

export interface IPage extends IDate {
  file: {
    path: string,
    name: string
  },
  ticks: ITick[]
  ff_frequency?: string
  ff_status?: string
}

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

export interface CalendarEvent {
  start: Date
  allDay: boolean
  end?: Date
}

// INFO это интерфейс для Cache
export interface MyView {
  addFile(_:IPage): void
  changeFile(newPage: IPage, oldPage: IPage): void
  renameFile(newPage: IPage, oldPage: IPage): void
  deleteFile(_: IPage): void
  reset(): void
}

export interface ISubscriber {
  renameFile(newPage: IPage, oldPage: IPage): void
  deleteFile(page: IPage): void
  addFile(page: IPage): void
  changeFile(newPage: IPage, oldPage: IPage): void
  reset(): void
}

export interface ITasks {
  done: number,
  all: number
}
