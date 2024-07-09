import { DURATION_TYPES } from "obsidian-dataview"

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
  color: string
  borderColor?: string
  editable: boolean
  extendedProps?: {
    // tickName: string
    notePath: string
  }
}