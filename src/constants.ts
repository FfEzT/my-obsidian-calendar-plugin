import { IPluginSettings } from "./types"

export const MSG_PLG_NAME = "MyCalendar"

const daysOfWeek = [ '1','2','3','4','5','6','0' ] // these recurrent events move separately
const display = 'background'
export const COLOUR_REST  = '#305B60'
export const COLOUR_SLEEP = '#cc0000'

export const DEFAULT_SETTINGS: IPluginSettings = {
  statusCorrector: {
    isOn: true,
    startOnStartUp: true
  },
  calendar: {
    slotDuration: "00:30:00",
    colours: {
      frequency: "#8A1717",
      done     : "#008E04",
      tick     : "#457E7E",
      default  : "#5e3fa8",
    },
    restTime: [
      {daysOfWeek,display,
          startTime: '0:00:00',
          endTime: '8:00:00',
          color: COLOUR_SLEEP,
      },
      {daysOfWeek,display,
          startTime: '24:00:00',
          endTime: '24:00:00',
          color: COLOUR_SLEEP,
      },
      {daysOfWeek,display,
          startTime: '0:00:00',
          endTime: '8:30:00',
          color: COLOUR_REST,
      },
      {daysOfWeek,display,
          startTime: '23:00:00',
          endTime: '24:00:00',
          color: COLOUR_REST,
      }
    ]
  }
}

export enum CACHE_ID {
  CALENDAR = 1,
  STATUS_CORRECTOR,
  TICK_CHECKER
}


// TODO переделать в TEXT = {DONE...BLOCKED}
export const TEXT_DONE = "🟢done"
export const TEXT_IN_PROGRESS = "🔵in progress"
export const TEXT_SOON = "🟣soon"
export const TEXT_CHILD_IN_PROGRESS = "🟡🟦child in progress"
export const TEXT_BLOCKED = "🟡blocked"

export const EVENT_SRC = "databases"
export const PLACE_FOR_CREATING_NOTE = "databases"

export const FORMAT_DEFAULT_ADD = 'x'
export const FORMAT_DAY = 'd'
export const FORMAT_HOUR = 'h'
export const FORMAT_MINUTE = 'm'
export const DEFAULT_ADD = {
  d: 0,
  h: 1,
  m: 30
}

export const BACKGROUND_COLOUR = {
    hue: {
        shift: 0,
        min: 0,
        max: 360
    },
    saturation: {
        shift: 0,
        min: 70,
        max: 90
    },
    lightness: {
        shift: 0,
        min: 30,
        max: 50
    }
}


const MillisecsInSecond = 1000
const SecsInMinute = 60
const MinutesInHour = 60
export const HoursInDay = 24
export const MillisecsInMinute = MillisecsInSecond * SecsInMinute
export const MillisecsInHour = MillisecsInMinute * MinutesInHour
export const MillisecsInDay = MillisecsInHour * HoursInDay
export const DEFAULT_ADD_IN_MILLISEC = DEFAULT_ADD.d * MillisecsInDay + DEFAULT_ADD.h * MillisecsInHour + DEFAULT_ADD.m * MillisecsInMinute
