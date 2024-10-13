import { DURATION_TYPES } from "obsidian-dataview"

// TODO записать сюда цвета и другие параметры
// + разбиение сетки (5 минут, 10)
export interface IPluginSettings {
  
}

export interface IDate {
  date: Date
  timeStart: DURATION_TYPES
  duration: DURATION_TYPES
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
  frequency?: string
  status?: string
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
