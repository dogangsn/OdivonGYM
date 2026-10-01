import { BehaviorSubject, Subject } from 'rxjs';
import { accessLiveTicks } from './admin-access-control.service';

describe('accessLiveTicks', () => {
  it('polls only while the setting is on and the devices are online', () => {
    const setting$ = new BehaviorSubject(false);
    const online$ = new BehaviorSubject(false);
    const poll$ = new Subject<number>();
    const pollStarts = jasmine.createSpy('pollStarts');
    const active: boolean[] = [];
    const ticks: unknown[] = [];

    accessLiveTicks(setting$, online$, () => (pollStarts(), poll$), (a) => active.push(a)).subscribe((t) => ticks.push(t));

    poll$.next(1); // setting off: nothing subscribed to the poll
    expect(pollStarts).not.toHaveBeenCalled();

    setting$.next(true); // on, but device offline
    expect(pollStarts).not.toHaveBeenCalled();

    online$.next(true); // agent + device online -> polling starts
    poll$.next(2);
    poll$.next(3);
    expect(ticks).toEqual([2, 3]);

    online$.next(false); // device went offline -> polling stops
    poll$.next(4);
    online$.next(true);
    poll$.next(5);
    setting$.next(false); // switched off -> stops even if online
    poll$.next(6);

    expect(ticks).toEqual([2, 3, 5]);
    expect(pollStarts).toHaveBeenCalledTimes(2);
    expect(active).toEqual([false, true, false, true, false]);
  });
});
