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

    // Ensure a reusable tooltip exists per container (results and mySchedule screens)
    const enableTooltip = (containerId === 'schedule-details-container' || containerId === 'schedule-container');
    const tooltipId = `class-tooltip-${containerId}`;
    let tooltip = enableTooltip ? container.querySelector(`#${tooltipId}`) : null;
    if (enableTooltip) {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = tooltipId;
            tooltip.style.position = 'fixed';
            tooltip.style.display = 'none';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.background = '#fff';
            tooltip.style.color = '#111';
            tooltip.style.border = '1px solid #e5e7eb';
            tooltip.style.borderRadius = '10px';
            tooltip.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
            tooltip.style.padding = '10px 12px';
            tooltip.style.fontSize = '14px';
            tooltip.style.lineHeight = '1.35';
            tooltip.style.maxWidth = '340px';
            tooltip.style.zIndex = '9999';
            container.appendChild(tooltip);
        } else {
            tooltip.style.display = 'none';
        }
    }

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

        // Detailed hover tooltip for results screen
        const showTooltip = (evt) => {
            if (!enableTooltip || !tooltip) return;
            // Build rich content
            const detailsHtml = `
                <div style="font-weight:700; margin-bottom:4px;">${sessionName}</div>
                <div style="opacity:0.8; margin-bottom:6px;">${session.class || ''}</div>
                <div><strong>Day:</strong> ${session.day || ''}</div>
                <div><strong>Time:</strong> ${session.start ?? ''} - ${session.end ?? ''}</div>
                <div><strong>Lecturer:</strong> ${session.lecturer || 'TBA'}</div>
                <div><strong>Location:</strong> ${session.location || ''}</div>
                <div style="opacity:0.7; margin-top:6px;">${courseKey || ''}</div>
            `;
            tooltip.innerHTML = detailsHtml;

            // Visual accent using colors
            if (customColors && courseKey && customColors[courseKey]) {
                const [bg, fg] = customColors[courseKey];
                tooltip.style.borderColor = bg || '#e5e7eb';
            } else {
                tooltip.style.borderColor = '#e5e7eb';
            }

            // Position near the cursor with viewport clamping
            const padding = 12;
            const { clientX, clientY } = evt;
            tooltip.style.display = 'block';
            // Temporarily position to measure size
            tooltip.style.left = (clientX + padding) + 'px';
            tooltip.style.top = (clientY + padding) + 'px';
            const rect = tooltip.getBoundingClientRect();
            let left = clientX + padding;
            let top = clientY + padding;
            const maxLeft = document.documentElement.clientWidth - rect.width - padding;
            const maxTop = document.documentElement.clientHeight - rect.height - padding;
            if (left > maxLeft) left = maxLeft;
            if (top > maxTop) top = maxTop;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        };

        const moveTooltip = (evt) => {
            if (!enableTooltip || !tooltip || tooltip.style.display !== 'block') return;
            const padding = 12;
            const { clientX, clientY } = evt;
            let left = clientX + padding;
            let top = clientY + padding;
            const rect = tooltip.getBoundingClientRect();
            const maxLeft = document.documentElement.clientWidth - rect.width - padding;
            const maxTop = document.documentElement.clientHeight - rect.height - padding;
            if (left > maxLeft) left = maxLeft;
            if (top > maxTop) top = maxTop;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        };

        const hideTooltip = () => {
            if (!enableTooltip || !tooltip) return;
            tooltip.style.display = 'none';
        };

        if (enableTooltip) {
            block.addEventListener('mouseenter', showTooltip);
            block.addEventListener('mousemove', moveTooltip);
            block.addEventListener('mouseleave', hideTooltip);
        } else {
            // As a fallback, set a simple title for non-results contexts
            block.title = `${sessionName} | ${session.day || ''} ${session.start ?? ''}-${session.end ?? ''} | ${session.lecturer || 'TBA'} | ${session.location || ''}`;
        }
    });
}