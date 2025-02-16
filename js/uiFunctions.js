export function renderSchedule(schedule, containerId, customColors={}) {
    // Get the container element
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id ${containerId} not found`);
        return;
    }

    // Clear all previously rendered blocks in this specific container
    container.querySelectorAll('.class-block').forEach(block => block.remove());

    schedule.forEach(session => {
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
        const duration = endTime - startTime;
        
        const block = document.createElement("div");
        block.className = "class-block";
        block.style.top = `${(startTime - 8) * 50}px`; // Adjust 8 to match your dayStart time
        block.style.height = `${duration * 50}px`;
        // block.textContent = `${session.course} - ${session.class} (${session.location})`;
        block.innerHTML = `
            <div class="course-name">${session.course}</div>
            <div class="location">${session.location}</div>
            <div class="time">${session.start} - ${session.end}</div>
        `;
        // block.innerHTML = `
        //     <div class="course-name">${session.course}</div>
        //     <div class="class-type">${session.class}</div>
        //     <div class="location">${session.location}</div>
        //     <div class="time">${startTime}:00 - ${endTime}:00</div>
        //     <div class="lecturer">${session.lecturer || 'TBA'}</div>
        // `;
        block.style.display = 'flex';
        block.style.flexDirection = 'column';

        if (customColors[session.course]){
            block.style.backgroundColor = customColors[session.course][0];
            block.style.color = customColors[session.course][1];
        }
        dayColumn.appendChild(block);
    });
}