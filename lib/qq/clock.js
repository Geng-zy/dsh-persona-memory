export function localClock(now, timeZone) {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now)).replace(/^24/, '00');
    }
    catch {
        return new Date(now).toISOString().slice(11, 16);
    }
}
export function logicalDay(now, boundaryHour, timeZone) {
    const shifted = new Date(now - boundaryHour * 3_600_000);
    try {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
    }
    catch {
        return shifted.toISOString().slice(0, 10);
    }
}
