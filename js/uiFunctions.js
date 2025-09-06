export function renderSchedule(schedule, containerId, customColors={}) {
    // Get the container element
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id ${containerId} not found`);
        return;
    }

    // Ensure schedule is an array
    if (!Array.isArray(schedule)) {
        console.error('renderSchedule expected an array for schedule, got:', schedule);
        return;
    }

    // Clear all previously rendered blocks in this specific container
    container.querySelectorAll('.class-block').forEach(block => block.remove());

    // Safely read course details metadata
    let details = undefined;
    try {
        const raw = localStorage.getItem('courseDetails');
        details = raw ? JSON.parse(raw) : undefined;
    } catch (e) {
        console.warn('Failed to parse courseDetails from localStorage:', e);
        details = undefined;
    }

    schedule.forEach(session => {
        if (!session || !session.day) {
            console.warn('Skipping invalid session entry:', session);
            return;
        }
        const dayColumn = container.querySelector(`.day-column[data-day="${session.day}"]`);
        
        if (!dayColumn) {
            console.error(`No column found for day: ${session.day} in container ${containerId}`);
            return;
        }

        const startTime = typeof session.start === 'string' ? 
            parseFloat(session.start.split(':').reduce((h, m) => parseFloat(h) + parseFloat(m)/60)) : 
            session.start;
        const endTime = typeof session.end === 'string' ? 
        parseFloat(session.end.split(':').reduce((h, m) => parseFloat(h) + parseFloat(m)/60)) : 
        session.end;
        const duration = (endTime ?? 0) - (startTime ?? 0);

        // Resolve session/course name with safe fallbacks
        const courseKey = session.course;
        const meta = (details && courseKey) ? details[courseKey] : undefined;
        const sessionName = (meta && meta.courseName) ? meta.courseName : (courseKey || 'Unknown Course');

        const block = document.createElement("div");
        block.className = "class-block";
        block.style.top = `${((startTime ?? 8) - 8) * 50}px`; // Adjust 8 to match your dayStart time
        block.style.height = `${(duration > 0 ? duration : 0.5) * 50}px`;
        block.innerHTML = `
            <div class="course-name">${sessionName}</div>
            <div class="course-name">${session.lecturer || 'TBA'}</div>
            <div class="location">${session.location || ''}</div>
            <div class="time">${session.start ?? ''} - ${session.end ?? ''}</div>
        `;
        block.style.display = 'flex';
        block.style.flexDirection = 'column';

        if (customColors && courseKey && customColors[courseKey]){
            const [bg, fg] = customColors[courseKey];
            if (bg) block.style.backgroundColor = bg;
            if (fg) block.style.color = fg;
        }
        dayColumn.appendChild(block);
    });
}