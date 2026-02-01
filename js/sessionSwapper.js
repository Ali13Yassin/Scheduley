// ===================================
// SESSION SWAPPER MODULE
// Drag-Drop Swap Functionality
// VERSION: IN-PLACE-STACK-V2
// ===================================

console.log("%c SessionSwapper Loaded: IN-PLACE-STACK-V2 ", "background: #222; color: #bada55");

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

    // SVG location icon for consistent styling
    const locationIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0; opacity:0.7;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

    // 1. Collect all ghost entries
    const ghostEntries = [];
    alternatives.forEach((alt, index) => {
        alt.group.forEach(session => {
            ghostEntries.push({
                alt,
                index,
                session,
                key: `${session.day}-${session.start}-${session.end}`
            });
        });
    });

    // 2. Group by time slot
    const slotGroups = {};
    ghostEntries.forEach(entry => {
        if (!slotGroups[entry.key]) slotGroups[entry.key] = [];
        slotGroups[entry.key].push(entry);
    });

    // 3. Render: ONE card per slot, with "+N" badge if multiple options
    Object.values(slotGroups).forEach(group => {
        const firstEntry = group[0];
        const { session } = firstEntry;
        const dayCol = container.querySelector(`.day-column[data-day="${session.day}"]`);
        if (!dayCol) return;

        const start = parseTime(session.start);
        const end = parseTime(session.end);
        const duration = Math.max(end - start, 0.5);
        const top = (start - DAY_START) * PX_PER_HOUR;
        const height = Math.max(duration * PX_PER_HOUR, 35);

        const hasMultiple = group.length > 1;
        const validOptions = group.filter(e => e.alt.isValid);
        const invalidCount = group.length - validOptions.length;

        // Create main ghost container
        const ghostContainer = document.createElement('div');
        ghostContainer.className = 'drop-zone-ghost-container';

        Object.assign(ghostContainer.style, {
            position: 'absolute',
            left: '3px',
            right: '3px',
            top: `${top}px`,
            minHeight: `${height}px`,
            zIndex: '200' // High z-index to appear above class blocks
        });

        // Primary card (first valid option or first option)
        const primaryEntry = validOptions.length > 0 ? validOptions[0] : group[0];
        const primaryAlt = primaryEntry.alt;
        const primarySession = primaryEntry.session;

        const primaryCard = document.createElement('div');
        primaryCard.className = `drop-zone-ghost ${primaryAlt.isValid ? 'valid' : 'invalid'}`;
        primaryCard.dataset.altIndex = primaryEntry.index;
        primaryCard.dataset.className = primaryAlt.className;
        primaryCard.dataset.course = primarySession.course;

        // Fix 5: Mark if this has a popover (prevents direct drop on primary)
        if (hasMultiple) {
            primaryCard.dataset.hasPopover = 'true';
        }

        Object.assign(primaryCard.style, {
            position: 'relative',
            width: '100%',
            height: `${height}px`,
            borderRadius: '8px',
            border: primaryAlt.isValid ? '2px dashed #22C55E' : '2px dashed #EF4444',
            background: primaryAlt.isValid
                ? 'rgba(236, 253, 245, 0.92)' // Light green tint, less white
                : 'rgba(254, 242, 242, 0.92)', // Light red tint
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '8px 12px',
            boxSizing: 'border-box',
            cursor: primaryAlt.isValid ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        });

        // Primary card content
        const lecturer = primarySession.lecturer
            ? primarySession.lecturer.split(' ').slice(0, 2).join(' ')
            : '';
        const location = primarySession.location || '';

        primaryCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <div style="flex:1;">
                    <div style="font-size:12px; font-weight:600; color:${primaryAlt.isValid ? '#166534' : '#DC2626'};">
                        ${primaryAlt.className}
                    </div>
                    ${lecturer ? `<div style="font-size:10px; color:#666; margin-top:2px;">${lecturer}</div>` : ''}
                    ${location ? `<div style="font-size:9px; color:#888; margin-top:1px; display:flex; align-items:center; gap:2px;">${locationIcon} ${location}</div>` : ''}
                </div>
                ${hasMultiple ? `
                    <div style="background:${validOptions.length > 1 ? '#22C55E' : '#888'}; color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; white-space:nowrap;">
                        +${group.length - 1} more
                    </div>
                ` : ''}
            </div>
        `;

        ghostContainer.appendChild(primaryCard);

        // --- In-Place Stack (The "Split" Design) ---
        if (hasMultiple) {
            // Ensure ghost container allows overflow for the stack
            ghostContainer.style.overflow = 'visible';
            ghostContainer.style.zIndex = '100'; // Bring to front

            let stackOverlay = null;
            let hideTimeout = null;

            const createStack = () => {
                if (stackOverlay) return; // Already created

                stackOverlay = document.createElement('div');
                stackOverlay.className = 'ghost-stack-overlay';

                // USER REQUEST: Inside the container itself.
                ghostContainer.appendChild(stackOverlay);

                Object.assign(stackOverlay.style, {
                    position: 'absolute',
                    top: '-5px', // Slight overlap to cover
                    left: '-5px',
                    width: 'calc(100% + 10px)', // Slightly wider to cover borders
                    height: 'auto',
                    maxHeight: '300px',
                    zIndex: '9999',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                });

                // Render ALL options as cards in the stack
                group.forEach((entry, idx) => {
                    const { alt, session: sess } = entry;
                    const optionCard = document.createElement('div');

                    const optLecturer = sess.lecturer ? sess.lecturer.split(' ').slice(0, 2).join(' ') : 'TBA';
                    const optLocation = sess.location || '';

                    Object.assign(optionCard.style, {
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: alt.isValid ? '#f0fdf4' : '#fef2f2',
                        border: alt.isValid ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        cursor: alt.isValid ? 'pointer' : 'not-allowed',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'transform 0.1s ease',
                        flexShrink: 0,
                        position: 'relative' // For z-index context
                    });

                    optionCard.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-size:11px; font-weight:600; color:${alt.isValid ? '#166534' : '#DC2626'};">
                                    ${alt.className}
                                </div>
                                <div style="font-size:9px; color:#666; margin-top:1px;">
                                    ${optLecturer}${optLocation ? ` • ${optLocation}` : ''}
                                </div>
                            </div>
                            ${alt.isValid ? '' : '<span style="font-size:10px; color:#EF4444;">✗</span>'}
                        </div>
                    `;

                    // Hover/Drag effects
                    const highlight = () => { optionCard.style.transform = 'scale(1.02)'; optionCard.style.background = '#dcfce7'; optionCard.style.zIndex = '10'; };
                    const unhighlight = () => { optionCard.style.transform = 'scale(1)'; optionCard.style.background = '#f0fdf4'; optionCard.style.zIndex = '1'; };

                    optionCard.addEventListener('mouseenter', highlight);
                    optionCard.addEventListener('mouseleave', unhighlight);

                    // Drag Events for Dropping
                    optionCard.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        highlight();
                    });
                    optionCard.addEventListener('dragleave', unhighlight);

                    optionCard.addEventListener('drop', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window._dragContext && window._dragContext.active) {
                            const ctx = window._dragContext;

                            // Dispatch to main container to trigger swap
                            const dropEvent = new CustomEvent('manual-drop', {
                                detail: { className: alt.className }
                            });
                            if (ctx.container) ctx.container.dispatchEvent(dropEvent);

                            removeStack();
                        }
                    });

                    stackOverlay.appendChild(optionCard);
                });

                // Interaction Logic
                stackOverlay.addEventListener('mouseleave', scheduleRemoval);
                stackOverlay.addEventListener('mouseenter', cancelRemoval);
                stackOverlay.addEventListener('dragenter', cancelRemoval);
                stackOverlay.addEventListener('dragover', (e) => { e.preventDefault(); cancelRemoval(); });
            };

            const removeStack = () => {
                if (stackOverlay) {
                    stackOverlay.remove();
                    stackOverlay = null;
                }
            };

            const scheduleRemoval = () => {
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(removeStack, 100);
            };

            const cancelRemoval = () => {
                clearTimeout(hideTimeout);
            };

            // Triggers on the Base Ghost
            ghostContainer.addEventListener('mouseenter', createStack);
            ghostContainer.addEventListener('dragenter', (e) => {
                e.preventDefault();
                createStack();
            });
        }

        // --- Hover effect for primary card (single option) ---
        if (!hasMultiple) {
            primaryCard.addEventListener('mouseenter', () => {
                if (primaryAlt.isValid) {
                    primaryCard.style.transform = 'scale(1.02)';
                    primaryCard.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.2)';
                }
            });
            primaryCard.addEventListener('mouseleave', () => {
                primaryCard.style.transform = 'scale(1)';
                primaryCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            });
            // Single card also needs drag events for hover effect
            primaryCard.addEventListener('dragenter', () => {
                if (primaryAlt.isValid) primaryCard.style.transform = 'scale(1.02)';
            });
            primaryCard.addEventListener('dragleave', () => {
                primaryCard.style.transform = 'scale(1)';
            });
        }

        dayCol.appendChild(ghostContainer);
    });
}

/**
 * Clear all ghost blocks from container
 * @param {HTMLElement} container 
 */
export function clearGhosts(container) {
    if (!container) return;

    // Remove local ghosts
    const ghosts = container.querySelectorAll('.drop-zone-ghost-container');
    ghosts.forEach(g => g.remove());

    // Remove Portal Popovers (tracked in container property)
    if (container._activePopovers) {
        container._activePopovers.forEach(p => p.remove());
        container._activePopovers = [];
    }

    // Fallback: Remove any stray popovers/stacks
    document.querySelectorAll('.ghost-options-popover').forEach(p => p.remove());
    document.querySelectorAll('.ghost-stack-overlay').forEach(p => p.remove()); // New UI removal
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
