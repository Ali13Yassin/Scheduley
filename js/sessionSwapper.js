// ===================================
// SESSION SWAPPER MODULE
// Drag-Drop Swap Functionality
// ===================================

/**
 * Get session type from class name
 * @param {string} className - e.g., "Lecture 02", "Lab 01", "Tutorial 03"
 * @returns {string} - "lectures", "labs", or "tutorials"
 */
export function getSessionType(className) {
    if (!className) return 'lectures';
    const lower = className.toLowerCase();
    if (lower.includes('lec')) return 'lectures';
    if (lower.includes('lab')) return 'labs';
    if (lower.includes('tut')) return 'tutorials';
    return 'lectures';
}

/**
 * Check if two sessions overlap in time
 * @param {Object} session1 
 * @param {Object} session2 
 * @returns {boolean}
 */
export function timesOverlap(session1, session2) {
    if (session1.day !== session2.day) return false;
    // Parse times
    const parseTime = (t) => {
        if (!t) return 0;
        if (typeof t === 'number') return t;
        const [h, m] = t.toString().split(':').map(Number);
        return h + (m || 0) / 60;
    };
    const s1Start = parseTime(session1.start);
    const s1End = parseTime(session1.end);
    const s2Start = parseTime(session2.start);
    const s2End = parseTime(session2.end);

    return !(s1End <= s2Start || s2End <= s1Start);
}

/**
 * Check if a session group conflicts with existing sessions
 * @param {Array} newGroup - Array of session objects
 * @param {Array} existingSessions - Array of session objects
 * @returns {boolean} - true if conflict exists
 */
export function hasConflict(newGroup, existingSessions) {
    return newGroup.some(newSession =>
        existingSessions.some(existing => timesOverlap(newSession, existing))
    );
}

/**
 * Get all alternative session groups for a course/type
 * @param {string} courseKey - Course identifier
 * @param {string} sessionType - "lectures", "labs", or "tutorials"
 * @param {string} currentClassName - Current class name to exclude
 * @param {Array} currentSchedule - Current schedule to check conflicts against
 * @returns {Array} - Array of {group, isValid, className}
 */
export function getAlternatives(courseKey, sessionType, currentClassName, currentSchedule) {
    const coursesData = JSON.parse(localStorage.getItem('coursesData') || '{}');
    const courseData = coursesData[courseKey];

    if (!courseData || !courseData[sessionType]) {
        return [];
    }

    const allGroups = courseData[sessionType];
    const alternatives = [];

    // Filter out ALL sessions from same course + same type (not just exact className)
    // This prevents false conflicts when checking multi-day sessions
    const otherSessions = currentSchedule.filter(s => {
        if (s.course !== courseKey) return true; // Keep other courses
        // Remove sessions of same type (lectures, labs, tutorials)
        const sType = getSessionType(s.class);
        return sType !== sessionType;
    });

    allGroups.forEach(group => {
        if (!Array.isArray(group) || group.length === 0) return;

        const groupClassName = group[0].class;

        // Skip current group
        if (groupClassName === currentClassName) return;

        // Check for conflicts
        const isValid = !hasConflict(group, otherSessions);

        alternatives.push({
            group,
            isValid,
            className: groupClassName
        });
    });

    // Limit to 10 alternatives for performance
    return alternatives.slice(0, 10);
}

/**
 * Perform a session swap
 * Removes ALL sessions of the same course + sessionType, then adds the new group
 * This prevents duplicates (e.g., having 2 different lectures for the same course)
 * 
 * @param {Array} currentSchedule - Current schedule array
 * @param {string} courseKey - Course identifier
 * @param {string} oldClassName - Class to remove (used to determine sessionType)
 * @param {Array} newGroup - New session group to add
 * @returns {Object} - {success, newSchedule, error}
 */
export function performSwap(currentSchedule, courseKey, oldClassName, newGroup) {
    try {
        // Determine the session type from the oldClassName
        const sessionType = getSessionType(oldClassName);

        // Remove ALL sessions of the same course AND same type
        // This prevents duplicates (e.g., having Lec 04 AND Lec 05 for same course)
        const filteredSchedule = currentSchedule.filter(s => {
            if (s.course !== courseKey) return true; // Keep other courses
            const sType = getSessionType(s.class);
            return sType !== sessionType; // Remove if same type
        });

        // Check for conflicts with the rest of the schedule
        if (hasConflict(newGroup, filteredSchedule)) {
            return { success: false, error: 'Conflict detected' };
        }

        // Add new sessions
        const newSchedule = [...filteredSchedule, ...newGroup];

        console.log('[performSwap] Removed', currentSchedule.length - filteredSchedule.length,
            'sessions, added', newGroup.length, 'sessions');

        return { success: true, newSchedule };
    } catch (e) {
        console.error('[performSwap] Error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Find a matching schedule in allSchedules
 * @param {Array} targetSchedule - Schedule to find
 * @param {Array} allSchedules - All available schedules
 * @returns {number} - Index of matching schedule, or -1 if not found
 */
export function findMatchingScheduleIndex(targetSchedule, allSchedules) {
    // Create a signature for the target schedule
    const getSignature = (schedule) => {
        return schedule
            .map(s => `${s.course}-${s.class}-${s.day}-${s.start}`)
            .sort()
            .join('|');
    };

    const targetSig = getSignature(targetSchedule);

    for (let i = 0; i < allSchedules.length; i++) {
        if (getSignature(allSchedules[i]) === targetSig) {
            return i;
        }
    }

    return -1;
}

/**
 * Render ghost blocks for valid drop zones
 * @param {Array} alternatives - Array of alternative objects
 * @param {HTMLElement} container - Calendar container
 * @param {Object} customColors - Color assignments
 */
export function renderGhosts(alternatives, container, customColors = {}) {
    // Clear existing ghosts
    clearGhosts(container);

    const DAY_START = 8;
    const PX_PER_HOUR = 65;

    const parseTime = (t) => {
        if (!t) return DAY_START;
        if (typeof t === 'number') return t;
        const [h, m] = t.toString().split(':').map(Number);
        return h + (m || 0) / 60;
    };

    alternatives.forEach((alt, index) => {
        alt.group.forEach(session => {
            const dayCol = container.querySelector(`.day-column[data-day="${session.day}"]`);
            if (!dayCol) return;

            const start = parseTime(session.start);
            const end = parseTime(session.end);
            const duration = Math.max(end - start, 0.5);
            const top = (start - DAY_START) * PX_PER_HOUR;
            const height = Math.max(duration * PX_PER_HOUR, 35);

            const ghost = document.createElement('div');
            ghost.className = `drop-zone-ghost ${alt.isValid ? 'valid' : 'invalid'}`;
            ghost.dataset.altIndex = index;
            ghost.dataset.className = alt.className;
            ghost.dataset.course = session.course;

            Object.assign(ghost.style, {
                position: 'absolute',
                left: '3px',
                right: '3px',
                top: `${top}px`,
                height: `${height}px`,
                borderRadius: '6px',
                border: alt.isValid ? '2px dashed #22C55E' : '2px dashed #EF4444',
                background: alt.isValid
                    ? 'repeating-linear-gradient(45deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.1) 4px, rgba(34, 197, 94, 0.05) 4px, rgba(34, 197, 94, 0.05) 8px)'
                    : 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.1) 4px, rgba(239, 68, 68, 0.05) 4px, rgba(239, 68, 68, 0.05) 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: '600',
                color: alt.isValid ? '#16A34A' : '#DC2626',
                zIndex: '50',
                cursor: alt.isValid ? 'pointer' : 'not-allowed',
                transition: 'transform 0.15s, box-shadow 0.15s'
            });

            ghost.innerHTML = alt.isValid
                ? `<span>📍 ${alt.className}</span>`
                : `<span>⚠️ Conflict</span>`;

            // Hover effect
            ghost.addEventListener('mouseenter', () => {
                if (alt.isValid) {
                    ghost.style.transform = 'scale(1.02)';
                    ghost.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                }
            });
            ghost.addEventListener('mouseleave', () => {
                ghost.style.transform = 'scale(1)';
                ghost.style.boxShadow = 'none';
            });

            dayCol.appendChild(ghost);
        });
    });
}

/**
 * Clear all ghost blocks from container
 * @param {HTMLElement} container 
 */
export function clearGhosts(container) {
    if (!container) return;
    container.querySelectorAll('.drop-zone-ghost').forEach(g => g.remove());
}

// Expose to window for global access
window.sessionSwapper = {
    getSessionType,
    timesOverlap,
    hasConflict,
    getAlternatives,
    performSwap,
    findMatchingScheduleIndex,
    renderGhosts,
    clearGhosts
};
