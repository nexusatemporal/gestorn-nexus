/**
 * Temporary RRule Mock
 * This is a temporary mock until npm is fixed and we can install the real rrule library
 * TODO: Remove this file once 'rrule' package is properly installed
 */

export enum Frequency {
  YEARLY = 0,
  MONTHLY = 1,
  WEEKLY = 2,
  DAILY = 3,
  HOURLY = 4,
  MINUTELY = 5,
  SECONDLY = 6,
}

export class RRule {
  static readonly DAILY = Frequency.DAILY;
  static readonly WEEKLY = Frequency.WEEKLY;
  static readonly MONTHLY = Frequency.MONTHLY;
  static readonly YEARLY = Frequency.YEARLY;

  // Weekday constants
  static readonly SU = 6;
  static readonly MO = 0;
  static readonly TU = 1;
  static readonly WE = 2;
  static readonly TH = 3;
  static readonly FR = 4;
  static readonly SA = 5;

  options: {
    freq: Frequency;
    interval?: number;
    byweekday?: number[];
    until?: Date;
    count?: number;
    dtstart?: Date;
  };

  constructor(options: any) {
    this.options = options;
  }

  toString(): string {
    // Generate a simple RRULE string
    let rule = 'RRULE:';

    // Frequency
    switch (this.options.freq) {
      case Frequency.DAILY:
        rule += 'FREQ=DAILY';
        break;
      case Frequency.WEEKLY:
        rule += 'FREQ=WEEKLY';
        break;
      case Frequency.MONTHLY:
        rule += 'FREQ=MONTHLY';
        break;
      case Frequency.YEARLY:
        rule += 'FREQ=YEARLY';
        break;
    }

    // Interval
    if (this.options.interval && this.options.interval > 1) {
      rule += `;INTERVAL=${this.options.interval}`;
    }

    // By weekday (for WEEKLY)
    if (this.options.byweekday && this.options.byweekday.length > 0) {
      const days = this.options.byweekday.map(d => {
        switch (d) {
          case 6: return 'SU';
          case 0: return 'MO';
          case 1: return 'TU';
          case 2: return 'WE';
          case 3: return 'TH';
          case 4: return 'FR';
          case 5: return 'SA';
          default: return 'MO';
        }
      });
      rule += `;BYDAY=${days.join(',')}`;
    }

    // Until date
    if (this.options.until) {
      const date = this.options.until;
      const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rule += `;UNTIL=${dateStr}`;
    }

    // Count
    if (this.options.count) {
      rule += `;COUNT=${this.options.count}`;
    }

    return rule;
  }

  all(predicate?: (date: Date, i: number) => boolean): Date[] {
    // Mock implementation - generate up to 5 occurrences for preview
    const occurrences: Date[] = [];
    const start = this.options.dtstart || new Date();
    const maxOccurrences = this.options.count || 5;

    for (let i = 0; i < Math.min(maxOccurrences, 5); i++) {
      const occurrence = new Date(start);

      switch (this.options.freq) {
        case Frequency.DAILY:
          occurrence.setDate(start.getDate() + i * (this.options.interval || 1));
          break;
        case Frequency.WEEKLY:
          occurrence.setDate(start.getDate() + i * 7 * (this.options.interval || 1));
          break;
        case Frequency.MONTHLY:
          occurrence.setMonth(start.getMonth() + i * (this.options.interval || 1));
          break;
        case Frequency.YEARLY:
          occurrence.setFullYear(start.getFullYear() + i * (this.options.interval || 1));
          break;
      }

      if (this.options.until && occurrence > this.options.until) {
        break;
      }

      if (!predicate || predicate(occurrence, i)) {
        occurrences.push(occurrence);
      }
    }

    return occurrences;
  }

  static fromString(rruleString: string): RRule {
    // Mock parser - just return a default rule
    const options: any = {
      freq: Frequency.WEEKLY,
      interval: 1,
    };

    // Parse basic RRULE string
    if (rruleString.includes('FREQ=DAILY')) {
      options.freq = Frequency.DAILY;
    } else if (rruleString.includes('FREQ=WEEKLY')) {
      options.freq = Frequency.WEEKLY;
    } else if (rruleString.includes('FREQ=MONTHLY')) {
      options.freq = Frequency.MONTHLY;
    } else if (rruleString.includes('FREQ=YEARLY')) {
      options.freq = Frequency.YEARLY;
    }

    // Parse interval
    const intervalMatch = rruleString.match(/INTERVAL=(\d+)/);
    if (intervalMatch) {
      options.interval = parseInt(intervalMatch[1]);
    }

    // Parse count
    const countMatch = rruleString.match(/COUNT=(\d+)/);
    if (countMatch) {
      options.count = parseInt(countMatch[1]);
    }

    return new RRule(options);
  }
}

export { Frequency as default };
