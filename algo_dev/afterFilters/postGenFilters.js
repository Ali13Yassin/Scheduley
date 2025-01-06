export function numOfDaysFilter(schedules) {
    const classifications = {};

    for (const schedule of schedules) {
        const uniqueDays = new Set(schedule.map(session => session.day));
        const daysCount = uniqueDays.size;

        if (daysCount >= 1 && daysCount <= 5) {
            const daysKey = `days${daysCount}`;
            if (!classifications[daysKey]) {
                classifications[daysKey] = [];
            }
            classifications[daysKey].push(schedule);
        } else {
            console.log("Classes are spread over more than five days.");
            console.log(schedule);
        }
    }
    return classifications;
}

export function findSchedulesWithGaps(schedules) {
    // Helper function to convert time strings to minutes
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Check for no back-to-back sessions in a single schedule
    const hasNoBackToBack = (schedule) => {
        // Group sessions by day
        const sessionsByDay = {};
        schedule.forEach((session) => {
            if (!sessionsByDay[session.day]) {
                sessionsByDay[session.day] = [];
            }
            sessionsByDay[session.day].push(session);
        });

        // Check for gaps within each day
        for (const day in sessionsByDay) {
            const sessions = sessionsByDay[day];
            // Sort sessions by start time
            sessions.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

            // Check if any two sessions are back-to-back
            for (let i = 1; i < sessions.length; i++) {
                // const prevEnd = timeToMinutes(sessions[i - 1].end);
                const prevEnd = sessions[i - 1].end;
                // const currentStart = timeToMinutes(sessions[i].start);
                const currentStart = sessions[i].start;
                console.log(sessions[i - 1],sessions[i],  prevEnd, currentStart);
                if (currentStart == prevEnd) {
                    return false; // Found a back-to-back session
                }
            }
        }
        return true; // No back-to-back sessions found
    };

    // Filter schedules with no back-to-back sessions
    return schedules.filter(hasNoBackToBack);
}