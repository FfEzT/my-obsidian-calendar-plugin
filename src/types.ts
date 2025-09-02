import { DURATION_TYPES } from "obsidian-dataview"

export class Src {
  constructor(path:string) {
    this._path = path
  }

  public addExcludes(excludes: string[]): boolean {
    // TODO перед добавлением проверять, что exclude внутри path
    return true
  }

  private _path: string

  get path() {
    return this._path
  }

  private _excludes: string[]

  get excludes(): string[] {
    return structuredClone(this._excludes)
  }
}

export type CalendarSettings = {
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

        // TODO remove any
        daysOfWeek:any,display:any,
    }[]
  }

export type PluginSettings = {
  statusCorrector: {
    isOn: boolean,
    startOnStartUp: boolean
  },
  calendar: CalendarSettings,
  source: {
    noteSources: Src[],

    // NOTE default path where note will be created
    defaultCreatePath: string
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
export interface ISubscriber {
  reset(): void
  addFile(_: Src): void
  deleteFile(_: Src): void
  changeFile(newPage: Src, oldPage: Src): void
  renameFile(newPage: Src, oldPage: Src): void
}

export interface ITasks {
  done: number,
  all: number
}
