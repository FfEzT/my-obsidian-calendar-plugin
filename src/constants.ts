const COLOUR_REST  = '#305B60'
const COLOUR_SLEEP = '#cc0000'
export const COLOUR_FREQUENCY = "#8A1717"
export const COLOUR_DONE      = "#008E04"
export const COLOUR_TICK      = "#457E7E"

export const TEXT_DONE = "🟢done"

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
        min: 10,
        max: 100
    },
    lightness: {
        shift: 0,
        min: 60,
        max: 100
    }
}

const daysOfWeek = [ '1','2','3','4','5','6','0' ] // these recurrent events move separately
const display = 'background'

export const REST_TIME = [
  {daysOfWeek,display,
      startTime: '0:00:00',
      endTime: '7:00:00',
      color: COLOUR_SLEEP,
  },
  {daysOfWeek,display,
      startTime: '23:00:00',
      endTime: '24:00:00',
      color: COLOUR_SLEEP,
  },
  {daysOfWeek,display,
      startTime: '0:00:00',
      endTime: '8:30:00',
      color: COLOUR_REST,
  },
  {daysOfWeek,display,
      startTime: '22:00:00',
      endTime: '24:00:00',
      color: COLOUR_REST,
  }
]

const MillisecsInSecond = 1000
const SecsInMinute = 60
const MinutesInHour = 60
export const HoursInDay = 24
export const MillisecsInMinute = MillisecsInSecond * SecsInMinute
export const MillisecsInHour = MillisecsInMinute * MinutesInHour
export const MillisecsInDay = MillisecsInHour * HoursInDay
export const DEFAULT_ADD_IN_MILLISEC = DEFAULT_ADD.d * MillisecsInDay + DEFAULT_ADD.h * MillisecsInHour + DEFAULT_ADD.m * MillisecsInMinute