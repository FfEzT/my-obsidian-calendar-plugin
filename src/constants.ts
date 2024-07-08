const COLOUR_REST  = '#305B60'
const COLOUR_SLEEP = '#cc0000'

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