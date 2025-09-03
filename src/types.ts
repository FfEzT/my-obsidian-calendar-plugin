import { DURATION_TYPES } from "obsidian-dataview"

export class Src {
  constructor(path: string) {
    this._path = path;
    this._excludes = [];
  }

  public addExcludes(excludes: string[]): boolean {
    const isOk = excludes.every(
      exclude => {
        if (!exclude.startsWith(this._path))
          return false

        if (exclude !== this._path)
          return false

        return true
      }
    )

    if (!isOk)
      return false

    this._excludes.push(...excludes)
    this._excludes = this._excludes.unique()

    return true
  }

  public includes(path: string): boolean {
    if ( !path.startsWith(this._path) ) {
      return false
    }

    if (!this._excludes.length)
      return true

    return this._excludes.some(
      exclude => {
        path.startsWith(exclude)
      }
    )
  }

  private _path: string;

  get path(): string {
    return this._path;
  }

  private _excludes: string[];

  get excludes(): string[] {
    return structuredClone(this._excludes);
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
        daysOfWeek:any,
        display:any
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
  addFile(_: IPage): void
  deleteFile(_: IPage): void
  changeFile(newPage: IPage, oldPage: IPage): void
  renameFile(newPage: IPage, oldPage: IPage): void
}

export interface ITasks {
  done: number,
  all: number
}
