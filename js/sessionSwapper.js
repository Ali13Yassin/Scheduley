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

        // --- Expandable Options Popover (only if multiple) ---
        if (hasMultiple) {
            const popover = document.createElement('div');
            popover.className = 'ghost-options-popover';

            Object.assign(popover.style, {
                position: 'absolute',
                top: `${height + 4}px`,
                left: '0',
                right: '0',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                border: '1px solid #d1d5db',
                padding: '6px',
                zIndex: '300', // Very high to appear above everything
                opacity: '0',
                transform: 'translateY(-8px)',
                pointerEvents: 'none',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
                maxHeight: '200px',
                overflowY: 'auto'
            });

            // Add header
            const popoverHeader = document.createElement('div');
            Object.assign(popoverHeader.style, {
                fontSize: '10px',
                fontWeight: '600',
                color: '#6b7280',
                padding: '4px 8px',
                borderBottom: '1px solid #f3f4f6',
                marginBottom: '4px'
            });
            popoverHeader.textContent = `${group.length} options available`;
            popover.appendChild(popoverHeader);

            // Add each option
            group.forEach((entry, idx) => {
                const { alt, session: sess } = entry;
                const optionCard = document.createElement('div');
                optionCard.className = `drop-zone-ghost ${alt.isValid ? 'valid' : 'invalid'}`;
                optionCard.dataset.altIndex = entry.index;
                optionCard.dataset.className = alt.className;
                optionCard.dataset.course = sess.course;

                const optLecturer = sess.lecturer ? sess.lecturer.split(' ').slice(0, 2).join(' ') : 'TBA';
                const optLocation = sess.location || '';

                Object.assign(optionCard.style, {
                    padding: '8px 10px',
                    borderRadius: '6px',
                    marginBottom: idx < group.length - 1 ? '4px' : '0',
                    background: alt.isValid ? '#f0fdf4' : '#fef2f2',
                    border: alt.isValid ? '1px solid #bbf7d0' : '1px solid #fecaca',
                    cursor: alt.isValid ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s ease'
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
                        ${alt.isValid
                        ? `<span style="font-size:10px; color:#22C55E;">✓ Valid</span>`
                        : `<span style="font-size:10px; color:#EF4444;">✗ Conflict</span>`
                    }
                    </div>
                `;

                // Hover effect for option
                if (alt.isValid) {
                    optionCard.addEventListener('mouseenter', () => {
                        optionCard.style.background = '#dcfce7';
                    });
                    optionCard.addEventListener('mouseleave', () => {
                        optionCard.style.background = '#f0fdf4';
                    });
                }

                popover.appendChild(optionCard);
            });

            ghostContainer.appendChild(popover);

            // --- Hover to expand (Mouse + Drag) ---
            let hoverTimeout;
            const expandPopover = () => {
                hoverTimeout = setTimeout(() => {
                    // Calculate if popover would go off-screen (show above if near bottom)
                    const containerRect = container.getBoundingClientRect();
                    const ghostRect = ghostContainer.getBoundingClientRect();
                    const estimatedPopoverHeight = Math.min(group.length * 50 + 40, 200);

                    const spaceBelow = containerRect.bottom - ghostRect.bottom;
                    const spaceAbove = ghostRect.top - containerRect.top;

                    if (spaceBelow < estimatedPopoverHeight && spaceAbove > estimatedPopoverHeight) {
                        // Position ABOVE the card
                        popover.style.top = 'auto';
                        popover.style.bottom = `${height + 4}px`;
                        popover.style.transform = 'translateY(0)';
                    } else {
                        // Position BELOW the card (default)
                        popover.style.bottom = 'auto';
                        popover.style.top = `${height + 4}px`;
                        popover.style.transform = 'translateY(0)';
                    }

                    popover.style.opacity = '1';
                    popover.style.pointerEvents = 'auto';
                    primaryCard.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.2)';
                }, 50); // Faster expansion during drag/interaction
            };

            const hidePopover = () => {
                clearTimeout(hoverTimeout);
                popover.style.opacity = '0';
                popover.style.transform = 'translateY(-8px)';
                popover.style.pointerEvents = 'none';
                primaryCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            };

            ghostContainer.addEventListener('mouseenter', expandPopover);
            ghostContainer.addEventListener('mouseleave', hidePopover);

            // Support expansion during Drag operations
            ghostContainer.addEventListener('dragenter', (e) => {
                e.preventDefault(); // allow drop
                expandPopover();
            });
            ghostContainer.addEventListener('dragover', (e) => {
                e.preventDefault(); // allow drop and keep open
                if (popover.style.opacity !== '1') expandPopover();
            });
            ghostContainer.addEventListener('dragleave', (e) => {
                // Only hide if leaving the main container, not entering a child
                if (!ghostContainer.contains(e.relatedTarget)) {
                    hidePopover();
                }
            });

            // Ensure popover itself keeps it open
            popover.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent bubbling to container which might close it
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
    container.querySelectorAll('.drop-zone-ghost-container').forEach(g => g.remove());
    container.querySelectorAll('.drop-zone-ghost').forEach(g => g.remove());
    container.querySelectorAll('.ghost-options-popover').forEach(g => g.remove());
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
