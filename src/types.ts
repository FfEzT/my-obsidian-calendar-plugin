import { DURATION_TYPES } from "obsidian-dataview"

export class Src {
  private _path: string;

  get path(): string {
    return this._path;
  }

  private _excludes: string[];

  get excludes(): string[] {
    return structuredClone(this._excludes);
  }


  constructor(path: string) {
    this._path = path;
    this._excludes = [];
  }

  static fromSrcJson(src: SrcJSON): Src|null {
    const result = new Src(src.path)
    if ( result.addExcludes(src.excludes) )
      return result

    return null
  }

  public toSrcJson(): SrcJSON {
    return {
      path: this._path,
      excludes: [...this._excludes]
    }
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

  public isIn(path: string): boolean {
    if ( !path.startsWith(this._path) ) {
      return false
    }

    if (!this._excludes.length)
      return true

    return this._excludes.some(
      exclude => path.startsWith(exclude)
    )
  }
}

export type SrcJSON = {
  path: string,
  excludes: string[]
}

// TODO перенести
export type CalendarSettings = {
  slotDuration: string,
  colours: {
    frequency: string,
    done     : string,
    tick     : string,
    default  : string,
    noStatus: string
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

export type GanttSettings = {}

export type PluginSettings = {
  statusCorrector: {
    isOn: boolean,
    startOnStartUp: boolean
  },
  calendar: CalendarSettings,
  source: {
    noteSources: SrcJSON[],

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

  // TODO все названия этих полей брать из настроек
  ff_frequency?: string
  ff_status?: string,
  ff_dateStart?: Date,
  ff_deadline?: Date,
  ff_doDays: number
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
